
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, User, ThemeMode, OrderStatus } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrdersPage from './components/OrdersPage';
import ShipmentsPage from './components/ShipmentsPage';
import ClientsPage from './components/ClientsPage';
import StoragePage from './components/StoragePage';
import DeliveryPage from './components/DeliveryPage';
import BillingPage from './components/BillingPage';
import SettingsPage from './components/SettingsPage';
import LoginPage from './components/LoginPage';
import PublicCalculatorPage from './components/PublicCalculatorPage'; 
import FinancePage from './components/FinancePage'; 
import { supabase } from './supabaseClient';
import { RefreshCw, Moon, Sun, X, Monitor, WifiOff, RefreshCcw, Search, Store as StoreIcon, Plus, SlidersHorizontal, Clock, CheckCircle2, AlertCircle, FileWarning, Users, BellRing, Sparkles } from 'lucide-react';
import { AuthContext } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { useLanguage } from './contexts/LanguageContext'; 
import FloatingCalculator from './components/FloatingCalculator';
import NotificationCenter from './components/NotificationCenter';
import AIAssistant from './components/AIAssistant';
import { useAppData } from './hooks/useAppData';
import { DEFAULT_EMPLOYEE_PERMISSIONS } from './constants';
import Logo from './components/Logo';
import { NetworkProvider, useNetwork } from './contexts/NetworkContext'; // Import Network Provider
import { SoundProvider } from './contexts/SoundContext';

const CACHE_KEY_PREFIX = 'fast_comand_v4_'; 

const loadFromCache = (key: string): any | null => {
    try {
        const stored = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (!stored) return null;
        const { data } = JSON.parse(stored);
        return data;
    } catch (e) {
        return null;
    }
};

const saveToCache = (key: string, data: any) => {
    try {
        const cachePayload = { timestamp: Date.now(), data };
        localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cachePayload));
    } catch (e) {
        // Ignore
    }
};

// Internal Component to consume Network Context
const OfflineBanner: React.FC = () => {
    const { isOnline, pendingCount } = useNetwork();
    if (isOnline && pendingCount === 0) return null;

    return (
        <div className={`px-4 py-2 text-sm font-bold text-center flex justify-center items-center gap-2 shadow-md z-50 animate-in slide-in-from-top-full ${!isOnline ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
            {!isOnline ? (
                <>
                    <WifiOff size={18} />
                    <span>أنت غير متصل بالإنترنت. يمكنك إضافة الطلبات، وسيتم حفظها عند عودة الاتصال.</span>
                </>
            ) : (
                <>
                    <RefreshCcw size={18} className="animate-spin" />
                    <span>جاري مزامنة {pendingCount} عملية مع الخادم...</span>
                </>
            )}
        </div>
    );
};

// --- Minimal Filter Pill Component for App Header ---
const FilterPill = ({ id, label, icon: Icon, active, onClick, colorClass, count }: any) => (
    <button 
        onClick={onClick}
        className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex-shrink-0 whitespace-nowrap
            ${active 
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' 
                : `bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-50 ${colorClass || ''}`}
        `}
    >
        {Icon && <Icon size={12} className={active ? '' : 'opacity-70'} />}
        <span>{label}</span>
        {count !== undefined && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-white/20 text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-700 text-gray-600'}`}>
                {count}
            </span>
        )}
    </button>
);

export const App: React.FC = () => {
  const isPublicCalculator = window.location.pathname === '/calculator';
  const { dir, t } = useLanguage();

  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromCache('CurrentUser'));
  const [view, setView] = useState<View>(() => (localStorage.getItem('lastActiveView') as View) || 'dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Theme State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
      const savedMode = localStorage.getItem('themeMode');
      if (!savedMode && localStorage.getItem('theme')) {
          return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
      }
      return (savedMode as ThemeMode) || 'system';
  });

  const mainContentRef = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  // --- Smart Scroll Logic ---
  const [isDockVisible, setIsDockVisible] = useState(true);
  const lastScrollY = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const currentScrollY = e.currentTarget.scrollTop;
      const diff = currentScrollY - lastScrollY.current;
      if (diff > 10 && currentScrollY > 50) {
          setIsDockVisible(false);
      } else if (diff < -5 || currentScrollY < 50) {
          setIsDockVisible(true);
      }
      lastScrollY.current = currentScrollY;
  };

  const scrollToTop = () => {
      if (mainContentRef.current) {
          mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          setIsDockVisible(true);
      }
  };

  // Use Custom Hook for Data Logic
  const {
      orders, setOrders,
      clients, setClients,
      stores, setStores,
      shipments, setShipments,
      shippingCompanies, setShippingCompanies,
      drawers, setDrawers,
      currencies, setCurrencies,
      users, setUsers,
      paymentMethods, setPaymentMethods,
      cities, setCities, 
      companyInfo, setCompanyInfo,
      settings, setSettings,
      globalActivityLog,
      isBackgroundUpdating,
      error, setError,
      logAction,
      loadMoreOrders, 
      searchOrders, 
      hasMoreOrders, 
      isOrdersLoading,
      loadMoreClients,
      searchClients,
      hasMoreClients,
      isClientsLoading,
      totalClientsCount,
      dashboardStats 
  } = useAppData(currentUser, isPublicCalculator);

  const [orderFilter, setOrderFilter] = useState<string | null>(null);
  const [shouldOpenNewOrderModal, setShouldOpenNewOrderModal] = useState(false);
  
  // --- Global Orders Filter State ---
  const [ordersSearchTerm, setOrdersSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState<string | 'all'>('all');
  const [smartFilter, setSmartFilter] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // --- Global Delivery State (Lifted from DeliveryPage) ---
  const [deliverySearchTerm, setDeliverySearchTerm] = useState('');
  const [deliveryTab, setDeliveryTab] = useState<'ready' | 'active'>('ready');
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  // --- AI Assistant State ---
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  useEffect(() => {
    if (companyInfo?.logo) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'icon';
      link.href = companyInfo.logo;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [companyInfo?.logo]);

  useEffect(() => {
    localStorage.setItem('lastActiveView', view);
  }, [view]);

  // Handle external filter click (Dashboard widgets)
  useEffect(() => {
      if (orderFilter) {
          setSmartFilter(orderFilter);
          if (['late', 'needs_tracking', 'pending_invoice', 'waiting_weight', 'ready_pickup', 'unpaid_delivered', 'pending_notification'].includes(orderFilter)) {
              setShowAdvancedFilters(true);
          }
      }
  }, [orderFilter]);

  // --- Theme Logic ---
  useEffect(() => {
    const applyTheme = () => {
        const root = document.documentElement;
        let isDark = false;
        if (themeMode === 'system') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
            isDark = themeMode === 'dark';
        }
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    };
    applyTheme();
    localStorage.setItem('themeMode', themeMode);
    if (themeMode === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const toggleTheme = () => {
      setThemeMode(prev => {
          if (prev === 'light') return 'dark';
          if (prev === 'dark') return 'system';
          return 'light';
      });
  };

  const getThemeIcon = () => {
      if (themeMode === 'light') return <Sun size={20} className="text-orange-500" />;
      if (themeMode === 'dark') return <Moon size={20} className="text-blue-400" />;
      return <Monitor size={20} className="text-gray-500 dark:text-gray-400" />; 
  };

  const handleViewChange = (newView: View) => {
    if (mainContentRef.current) scrollPositions.current[view] = mainContentRef.current.scrollTop;
    
    if (view === 'orders' && newView !== 'orders') {
        setShouldOpenNewOrderModal(false);
        setOrdersSearchTerm('');
    }
    
    setView(newView);
    setIsDockVisible(true);
  };

  useLayoutEffect(() => {
    if (mainContentRef.current) mainContentRef.current.scrollTop = scrollPositions.current[view] || 0;
  }, [view]);

  // Auth Status Check
  useEffect(() => {
    if (isPublicCalculator) return;
    const checkAuth = async () => {
        try {
            const { data: { session }, error } = await supabase?.auth.getSession() || { data: { session: null }, error: null };
            
            if (error) {
                throw error;
            }

            if (session && session.user) {
                 if (!currentUser || currentUser.id !== session.user.id) {
                     const { data: profile } = await supabase!.from('Users').select('*').eq('id', session.user.id).maybeSingle();
                     if (profile) {
                         const safeProfile = { 
                            ...profile, 
                            permissions: profile.permissions || DEFAULT_EMPLOYEE_PERMISSIONS 
                         };
                         setCurrentUser(safeProfile as User);
                         saveToCache('CurrentUser', safeProfile);
                     }
                 }
            } else {
                setCurrentUser(null);
            }
        } catch (err: any) {
            console.error("Auth Check Error:", err);
            if (err.message && (err.message.includes("Refresh Token Not Found") || err.message.includes("Invalid Refresh Token"))) {
                await supabase?.auth.signOut();
                localStorage.removeItem(CACHE_KEY_PREFIX + 'CurrentUser');
                setCurrentUser(null);
            }
        }
    };
    checkAuth();

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) checkAuth();
        else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            localStorage.removeItem(CACHE_KEY_PREFIX + 'CurrentUser');
        } else if (event === 'TOKEN_REFRESH_REVOKED') {
            setCurrentUser(null);
            localStorage.removeItem(CACHE_KEY_PREFIX + 'CurrentUser');
        }
    });
    return () => subscription?.unsubscribe();
  }, []);

  const loginDemo = () => { };
  const logout = async () => { 
      if (currentUser) {
          logAction('Logout', 'Auth', currentUser.id, 'User logged out');
      }
      await supabase?.auth.signOut(); 
      setCurrentUser(null); 
      localStorage.removeItem(CACHE_KEY_PREFIX + 'CurrentUser'); 
  };

  // Helper to count orders for pills
  const countByStatus = (status: string) => orders.filter(o => o.status === status).length;
  const countPendingNotification = () => orders.filter(o => (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) && !o.whatsappNotificationSent).length;
  
  // Delivery Counts
  const readyForDeliveryCount = orders.filter(o => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE).length;
  const activeDeliveryCount = orders.filter(o => o.status === OrderStatus.OUT_FOR_DELIVERY).length;

  if (isPublicCalculator) return <PublicCalculatorPage />;

  if (!currentUser) return (
    <AuthContext.Provider value={{ currentUser, logout, loginDemo }}>
        <ToastProvider>
            <LoginPage />
        </ToastProvider>
    </AuthContext.Provider>
  );

  return (
    <AuthContext.Provider value={{ currentUser, logout, loginDemo }}>
      <ToastProvider>
        <SoundProvider>
            <NetworkProvider>
                <div className={`flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans ${dir === 'rtl' ? 'rtl' : 'ltr'}`} dir={dir}>
                
                <Sidebar 
                    currentView={view} 
                    setView={handleViewChange} 
                    isSidebarOpen={false} 
                    companyInfo={companyInfo} 
                    isCollapsed={isSidebarCollapsed}
                    // FIXED: Changed setIsCollapsed prop to use setIsSidebarCollapsed state setter
                    setIsCollapsed={setIsSidebarCollapsed}
                    settings={settings}
                    isDockVisible={isDockVisible}
                    onScrollToTop={scrollToTop}
                />

                <main className="flex-1 flex flex-col h-full relative w-full max-w-full overflow-hidden">
                    {/* Header */}
                    <header className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-sm flex-shrink-0 transition-all duration-300 ${view === 'orders' || view === 'delivery' ? 'h-[64px]' : 'h-[72px]'}`}>
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                            <div className="md:hidden flex-shrink-0">
                                {companyInfo.logo ? (
                                    <div className="w-10 h-10 flex items-center justify-center">
                                        <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
                                    </div>
                                ) : (
                                    <Logo className="w-8 h-8" />
                                )}
                            </div>
                            
                            {/* Dynamic Title / Controls */}
                            {view === 'orders' ? (
                                <div className="flex items-center gap-2 w-full max-w-3xl animate-in fade-in zoom-in-95 duration-200">
                                    {/* Search */}
                                    <div className="relative flex-grow min-w-0">
                                        <input 
                                            type="text" 
                                            value={ordersSearchTerm}
                                            onChange={(e) => {
                                                setOrdersSearchTerm(e.target.value);
                                                if(e.target.value && smartFilter !== 'all') setSmartFilter('all');
                                            }}
                                            placeholder="بحث..."
                                            className="w-full h-10 pl-8 pr-8 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-primary transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                        />
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                                        {ordersSearchTerm && (
                                            <button onClick={() => setOrdersSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                                                <X size={12}/>
                                            </button>
                                        )}
                                    </div>

                                    {/* Store Filter */}
                                    <div className="relative flex-shrink-0 hidden sm:block">
                                        <select 
                                            value={storeFilter} 
                                            onChange={(e) => setStoreFilter(e.target.value)}
                                            className="appearance-none h-10 w-10 bg-white dark:bg-gray-800 border-none rounded-xl shadow-sm text-transparent focus:ring-2 focus:ring-primary cursor-pointer absolute inset-0 z-10 opacity-0"
                                        >
                                            <option value="all">الكل</option>
                                            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                        <div className={`h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center transition-colors ${storeFilter !== 'all' ? 'text-primary bg-blue-50' : 'text-gray-500'}`}>
                                            <StoreIcon size={18} />
                                        </div>
                                    </div>

                                    {/* Advanced Toggle */}
                                    <button 
                                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                        className={`h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${showAdvancedFilters ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        <SlidersHorizontal size={18} />
                                    </button>

                                    {/* Add Button */}
                                    {currentUser?.permissions.orders.create && (
                                        <button 
                                            onClick={() => { setShouldOpenNewOrderModal(true); }} 
                                            className="h-10 px-2.5 md:px-4 bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-all active:scale-95 flex-shrink-0"
                                        >
                                            <Plus size={20}/> <span className="hidden lg:inline font-bold text-sm">{t('newOrder')}</span>
                                        </button>
                                    )}
                                </div>
                            ) : view === 'delivery' ? (
                                <div className="flex items-center gap-2 w-full max-w-4xl animate-in fade-in zoom-in-95 duration-200">
                                    {/* Delivery Tabs */}
                                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex-shrink-0">
                                        <button 
                                            onClick={() => setDeliveryTab('ready')} 
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${deliveryTab === 'ready' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500'}`}
                                        >
                                            <span>جاهز</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${deliveryTab === 'ready' ? 'bg-primary/10 text-primary' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                                                {readyForDeliveryCount}
                                            </span>
                                        </button>
                                        <button 
                                            onClick={() => setDeliveryTab('active')} 
                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${deliveryTab === 'active' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}
                                        >
                                            <span>جاري</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${deliveryTab === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
                                                {activeDeliveryCount}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Delivery Search */}
                                    <div className="relative flex-grow">
                                        <input 
                                            type="text" 
                                            value={deliverySearchTerm}
                                            onChange={(e) => setDeliverySearchTerm(e.target.value)}
                                            placeholder="بحث في التسليم..."
                                            className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-primary transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                        />
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                    </div>

                                    {/* Driver Management Button */}
                                    <button 
                                        onClick={() => setIsDriverModalOpen(true)}
                                        className="h-10 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-all flex-shrink-0"
                                        title="إدارة السائقين"
                                    >
                                        <Users size={18}/>
                                        <span className="hidden lg:inline text-xs">السائقين</span>
                                    </button>
                                </div>
                            ) : (
                                <h1 className="text-lg md:text-xl font-black text-slate-800 dark:text-white block truncate">
                                    {view === 'dashboard' && `مرحباً، ${currentUser.username.split(' ')[0]} 👋`}
                                    {view === 'shipments' && 'حركة الشحن'}
                                    {view === 'finance' && 'التقارير المالية'}
                                    {view === 'settings' && 'الإعدادات'}
                                    {!['dashboard', 'orders', 'shipments', 'finance', 'settings', 'delivery'].includes(view) && companyInfo.name}
                                </h1>
                            )}
                        </div>

                        {/* Right Side Icons */}
                        <div className="flex items-center gap-1.5 md:gap-3 pl-1 md:pl-2">
                            {/* AI Assistant Toggle */}
                            <button 
                                onClick={() => setIsAIAssistantOpen(!isAIAssistantOpen)}
                                className={`p-2 rounded-full transition-colors relative group ${isAIAssistantOpen ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}
                                title="المساعد الذكي"
                            >
                                <Sparkles size={20} />
                                {!isAIAssistantOpen && <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>}
                            </button>

                            <NotificationCenter 
                                orders={orders} 
                                stores={stores} 
                                clients={clients}
                                settings={settings}
                                globalActivityLog={globalActivityLog}
                                currentUser={currentUser}
                                onNavigateToOrder={(id) => {
                                    setOrderFilter(id);
                                    handleViewChange('orders');
                                }}
                            />
                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors flex items-center gap-2">
                                {getThemeIcon()}
                            </button>
                            <FloatingCalculator currencies={currencies} settings={settings} />
                        </div>
                    </header>

                    {/* Secondary Sticky Bar for Orders Filters */}
                    {view === 'orders' && (
                        <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b dark:border-slate-800 shadow-sm px-4 md:px-8 py-2 animate-in slide-in-from-top-2">
                            <div className="flex flex-col gap-2">
                                {/* Row 1: Workflow Status */}
                                <div className="flex overflow-x-auto gap-2 py-1 no-scrollbar items-center">
                                    <FilterPill id="all" label="الكل" active={smartFilter === 'all'} onClick={() => { setOrdersSearchTerm(''); setSmartFilter('all'); }} count={orders.length} />
                                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                                    <FilterPill id={OrderStatus.NEW} label={t('st_new' as any)} active={smartFilter === OrderStatus.NEW} onClick={() => setSmartFilter(OrderStatus.NEW)} count={countByStatus(OrderStatus.NEW)} />
                                    <FilterPill id={OrderStatus.ORDERED} label={t('st_ordered' as any)} active={smartFilter === OrderStatus.ORDERED} onClick={() => setSmartFilter(OrderStatus.ORDERED)} count={countByStatus(OrderStatus.ORDERED)} />
                                    <FilterPill id={OrderStatus.SHIPPED_FROM_STORE} label="بالطريق" active={smartFilter === OrderStatus.SHIPPED_FROM_STORE} onClick={() => setSmartFilter(OrderStatus.SHIPPED_FROM_STORE)} count={countByStatus(OrderStatus.SHIPPED_FROM_STORE)} />
                                    <FilterPill id={OrderStatus.ARRIVED_AT_OFFICE} label={t('st_arrived_at_office' as any)} active={smartFilter === OrderStatus.ARRIVED_AT_OFFICE} onClick={() => setSmartFilter(OrderStatus.ARRIVED_AT_OFFICE)} count={countByStatus(OrderStatus.ARRIVED_AT_OFFICE)} />
                                    <FilterPill id={OrderStatus.STORED} label={t('st_stored' as any)} active={smartFilter === OrderStatus.STORED} onClick={() => setSmartFilter(OrderStatus.STORED)} count={countByStatus(OrderStatus.STORED)} />
                                    <FilterPill id={OrderStatus.COMPLETED} label={t('st_completed' as any)} active={smartFilter === OrderStatus.COMPLETED} onClick={() => setSmartFilter(OrderStatus.COMPLETED)} count={countByStatus(OrderStatus.COMPLETED)} colorClass="text-green-600 border-green-200" />
                                </div>

                                {/* Row 2: Advanced Filters (Expandable) */}
                                {showAdvancedFilters && (
                                    <div className="flex overflow-x-auto gap-2 no-scrollbar animate-in slide-in-from-top-1 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg">
                                        <FilterPill id="pending_notification" label="بانتظار التنبيه" icon={BellRing} active={smartFilter === 'pending_notification'} onClick={() => setSmartFilter(smartFilter === 'pending_notification' ? 'all' : 'pending_notification')} count={countPendingNotification()} colorClass="text-emerald-500 border-emerald-200" />
                                        <FilterPill id="late" label="متأخر" icon={Clock} active={smartFilter === 'late'} onClick={() => setSmartFilter(smartFilter === 'late' ? 'all' : 'late')} colorClass="text-red-500" />
                                        <FilterPill id="ready_pickup" label="جاهز" icon={CheckCircle2} active={smartFilter === 'ready_pickup'} onClick={() => setSmartFilter(smartFilter === 'ready_pickup' ? 'all' : 'ready_pickup')} colorClass="text-green-600" />
                                        <FilterPill id="needs_tracking" label="نقص تتبع" icon={AlertCircle} active={smartFilter === 'needs_tracking'} onClick={() => setSmartFilter(smartFilter === 'needs_tracking' ? 'all' : 'needs_tracking')} colorClass="text-orange-500" />
                                        <FilterPill id="pending_invoice" label="بلا فاتورة" icon={FileWarning} active={smartFilter === 'pending_invoice'} onClick={() => setSmartFilter(smartFilter === 'pending_invoice' ? 'all' : 'pending_invoice')} colorClass="text-purple-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Offline Banner */}
                    <OfflineBanner />

                    {error && (
                        <div className="bg-red-500 text-white px-4 py-2 text-sm font-bold text-center flex justify-between items-center shadow-md z-30 flex-shrink-0">
                            <span>{error}</span>
                            <button onClick={() => setError(null)}><X size={16}/></button>
                        </div>
                    )}

                    <div 
                        ref={mainContentRef} 
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 relative scroll-smooth"
                    >
                    <div className="max-w-[1600px] mx-auto min-h-full pb-28 md:pb-20">
                        {view === 'dashboard' && (
                            <Dashboard 
                                orders={orders} 
                                clients={clients} 
                                stores={stores} 
                                shipments={shipments} 
                                onFilterClick={(filter) => { 
                                    setOrderFilter(filter); 
                                    handleViewChange('orders'); 
                                }} 
                                onSearch={(term) => {
                                    setOrdersSearchTerm(term);
                                    handleViewChange('orders');
                                }}
                                onNewOrder={() => {
                                    setShouldOpenNewOrderModal(true);
                                    handleViewChange('orders');
                                }}
                                settings={settings}
                                currencies={currencies}
                                isLoading={isBackgroundUpdating && orders.length === 0}
                                globalActivityLog={globalActivityLog}
                                dashboardStats={dashboardStats} 
                            />
                        )}
                        {view === 'orders' && (
                            <OrdersPage 
                                orders={orders} 
                                setOrders={setOrders} 
                                clients={clients} 
                                stores={stores} 
                                currencies={currencies} 
                                shippingCompanies={shippingCompanies} 
                                activeFilter={null} 
                                clearFilter={() => {}} 
                                commissionRate={settings.commissionRate} 
                                drawers={drawers} 
                                paymentMethods={paymentMethods} 
                                settings={settings}
                                shouldOpenModal={shouldOpenNewOrderModal}
                                onModalOpenHandled={() => setShouldOpenNewOrderModal(false)}
                                companyInfo={companyInfo}
                                users={users}
                                cities={cities}
                                loadMoreOrders={loadMoreOrders}
                                searchOrders={searchOrders}
                                hasMoreOrders={hasMoreOrders}
                                isOrdersLoading={isOrdersLoading}
                                searchClients={searchClients}
                                logAction={logAction}
                                externalSearchTerm={ordersSearchTerm} 
                                externalStoreFilter={storeFilter} 
                                externalSmartFilter={smartFilter} 
                            />
                        )}
                        {view === 'shipments' && <ShipmentsPage shipments={shipments} setShipments={setShipments} orders={orders} setOrders={setOrders} shippingCompanies={shippingCompanies} settings={settings} clients={clients} stores={stores} />}
                        {view === 'clients' && (
                            <ClientsPage 
                                clients={clients} 
                                setClients={setClients} 
                                orders={orders} 
                                cities={cities}
                                loadMoreClients={loadMoreClients}
                                searchClients={searchClients}
                                hasMoreClients={hasMoreClients}
                                isClientsLoading={isClientsLoading}
                                totalClientsCount={totalClientsCount}
                            />
                        )}
                        {view === 'storage' && <StoragePage drawers={drawers} setDrawers={setDrawers} orders={orders} setOrders={setOrders} clients={clients} settings={settings} stores={stores} companyInfo={companyInfo} cities={cities}/>}
                        {view === 'delivery' && (
                            <DeliveryPage 
                                orders={orders} 
                                clients={clients} 
                                stores={stores} 
                                setOrders={setOrders} 
                                companyInfo={companyInfo} 
                                settings={settings} 
                                cities={cities} 
                                paymentMethods={paymentMethods}
                                // Passed props from App Header state
                                activeTab={deliveryTab}
                                setActiveTab={setDeliveryTab}
                                searchTerm={deliverySearchTerm}
                                isDriverModalOpen={isDriverModalOpen}
                                setIsDriverModalOpen={setIsDriverModalOpen}
                            />
                        )}
                        {view === 'billing' && <BillingPage orders={orders} setOrders={setOrders} clients={clients} stores={stores} currencies={currencies} companyInfo={companyInfo} settings={settings} />}
                        {view === 'settings' && (
                            <SettingsPage 
                                stores={stores} setStores={setStores} 
                                shippingCompanies={shippingCompanies} setShippingCompanies={setShippingCompanies} 
                                currencies={currencies} setCurrencies={setCurrencies} 
                                settings={settings} setSettings={setSettings} 
                                paymentMethods={paymentMethods}
                                onUpdatePaymentMethods={setPaymentMethods}
                                companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} 
                                users={users} setUsers={setUsers} 
                                globalActivityLog={globalActivityLog} logAction={logAction}
                                setView={setView}
                                cities={cities}
                                setCities={setCities}
                                orders={orders} 
                            />
                        )}
                        {view === 'finance' && <FinancePage orders={orders} stores={stores} settings={settings} paymentMethods={paymentMethods} />} 
                    </div>
                    </div>
                </main>
                
                {/* Integrated AIAssistant - Controlled via State */}
                <AIAssistant 
                    isOpen={isAIAssistantOpen}
                    onClose={() => setIsAIAssistantOpen(false)}
                    orders={orders} 
                    shipments={shipments} 
                    clients={clients} 
                    stats={dashboardStats} 
                />
                
                </div>
            </NetworkProvider>
        </SoundProvider>
      </ToastProvider>
    </AuthContext.Provider>
  );
};

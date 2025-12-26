
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, User, ThemeMode } from './types';
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
import { RefreshCw, Moon, Sun, X, Monitor, WifiOff, RefreshCcw } from 'lucide-react';
import { AuthContext } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { useLanguage } from './contexts/LanguageContext'; 
import FloatingCalculator from './components/FloatingCalculator';
import NotificationCenter from './components/NotificationCenter';
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

export const App: React.FC = () => {
  const isPublicCalculator = window.location.pathname === '/calculator';
  const { dir } = useLanguage();

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
    if (newView !== 'orders') setShouldOpenNewOrderModal(false);
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
        const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
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
    };
    checkAuth();

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) checkAuth();
        else if (event === 'SIGNED_OUT') setCurrentUser(null);
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
                    setIsCollapsed={setIsSidebarCollapsed}
                    settings={settings}
                    isDockVisible={isDockVisible}
                    onScrollToTop={scrollToTop}
                />

                <main className="flex-1 flex flex-col h-full relative w-full max-w-full overflow-hidden">
                    {/* Header */}
                    <header className="h-[72px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm flex-shrink-0 transition-transform duration-300">
                        <div className="flex items-center gap-4">
                            <div className="md:hidden flex-shrink-0">
                                {companyInfo.logo ? (
                                    <div className="w-10 h-10 flex items-center justify-center">
                                        <img src={companyInfo.logo} alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
                                    </div>
                                ) : (
                                    <Logo className="w-8 h-8" />
                                )}
                            </div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-white block truncate">
                                {view === 'dashboard' && `مرحباً، ${currentUser.username.split(' ')[0]} 👋`}
                                {view === 'orders' && 'إدارة الطلبات'}
                                {view === 'shipments' && 'حركة الشحن'}
                                {view === 'finance' && 'التقارير المالية'}
                                {view === 'settings' && 'الإعدادات'}
                                {!['dashboard', 'orders', 'shipments', 'finance', 'settings'].includes(view) && companyInfo.name}
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
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
                        style={{ height: 'calc(100vh - 72px)' }}
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
                                activeFilter={orderFilter} 
                                clearFilter={() => setOrderFilter(null)} 
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
                        {view === 'delivery' && <DeliveryPage orders={orders} clients={clients} stores={stores} setOrders={setOrders} companyInfo={companyInfo} settings={settings} cities={cities} paymentMethods={paymentMethods} />}
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
                </div>
            </NetworkProvider>
        </SoundProvider>
      </ToastProvider>
    </AuthContext.Provider>
  );
};

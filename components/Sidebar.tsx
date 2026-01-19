
import React, { useContext, useMemo, useState, useEffect } from 'react';
import { View, CompanyInfo, AppSettings } from '../types';
import { Home, Package, Truck, Archive, Landmark, ReceiptText, LogOut, ChevronLeft, ChevronRight, Users, Settings, PieChart, MoreHorizontal, ArrowUp } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSound } from '../contexts/SoundContext';
import Logo from './Logo';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
  isSidebarOpen: boolean;
  companyInfo: CompanyInfo;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  settings?: AppSettings;
  isDockVisible?: boolean;
  onScrollToTop?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    currentView, 
    setView, 
    isCollapsed, 
    setIsCollapsed, 
    settings,
    isDockVisible = true,
    onScrollToTop,
    companyInfo // Ensure companyInfo is used
}) => {
  const { currentUser, logout } = useContext(AuthContext);
  const { t, dir } = useLanguage();
  const { playSound } = useSound();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const navItems = useMemo(() => [
    { view: 'dashboard', label: t('dashboard'), icon: Home },
    { view: 'orders', label: t('orders'), icon: Package, requiredPermission: p => p?.orders?.view },
    { view: 'shipments', label: t('shipments'), icon: Truck, requiredPermission: p => p?.shipments?.view },
    { view: 'clients', label: t('clients'), icon: Users, requiredPermission: p => p?.clients?.view },
    { view: 'storage', label: t('storage'), icon: Archive, requiredPermission: p => p?.storage?.view },
    { view: 'delivery', label: t('delivery'), icon: Landmark, requiredPermission: p => p?.delivery?.view },
    { view: 'billing', label: t('billing'), icon: ReceiptText, requiredPermission: p => p?.billing?.view },
    { view: 'finance', label: t('finance'), icon: PieChart, requiredPermission: p => p?.canViewFinance },
    { view: 'settings', label: t('settings'), icon: Settings, requiredPermission: p => p?.canAccessSettings },
  ], [t]);

  // 1. Filter by permissions
  const permissionFilteredItems = useMemo(() => {
    return navItems.filter(item => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      if (!currentUser.permissions) return false;
      return !item.requiredPermission || item.requiredPermission(currentUser.permissions);
    });
  }, [navItems, currentUser]);

  // 2. Sort based on settings.viewOrder or Role specific order
  const sortedItems = useMemo(() => {
      // Specific Order for 'viewer' role: Dashboard, Finance, Orders, Billing, Delivery, Shipments...
      if (currentUser?.role === 'viewer') {
          const viewerOrder = ['dashboard', 'finance', 'orders', 'billing', 'delivery', 'shipments', 'clients', 'storage', 'settings'];
          
          return [...permissionFilteredItems].sort((a, b) => {
              const idxA = viewerOrder.indexOf(a.view);
              const idxB = viewerOrder.indexOf(b.view);
              
              // Items not in the specific list go to the end
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              
              return idxA - idxB;
          });
      }

      // Default/Settings based order for others (Admin, Employee)
      if (!settings?.viewOrder || settings.viewOrder.length === 0) return permissionFilteredItems;
      
      return [...permissionFilteredItems].sort((a, b) => {
          const idxA = settings.viewOrder!.indexOf(a.view);
          const idxB = settings.viewOrder!.indexOf(b.view);
          
          // Items not in the list go to the end
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          
          return idxA - idxB;
      });
  }, [permissionFilteredItems, settings?.viewOrder, currentUser?.role]);

  const isRtl = dir === 'rtl';

  const handleNavClick = (view: View) => {
      playSound('click'); 
      setView(view);
      setIsMoreMenuOpen(false); // Close menu if item clicked
  };

  // --- Logic for Splitting Primary Dock Items vs More Menu ---
  const { primaryItems, menuItems } = useMemo(() => {
      // Allow custom dock for Viewer based on their specific order, or fallback to settings
      const preferredViews = currentUser?.role === 'viewer' 
        ? ['dashboard', 'finance', 'orders', 'billing'] 
        : (settings?.mobileDockViews || ['dashboard', 'orders', 'delivery', 'clients']);
      
      const primary: typeof sortedItems = [];
      const menu: typeof sortedItems = [];

      sortedItems.forEach(item => {
          if (preferredViews.includes(item.view)) {
              primary.push(item);
          } else {
              menu.push(item);
          }
      });

      // Sort primary items to match the order in preferredViews if possible
      primary.sort((a, b) => preferredViews.indexOf(a.view) - preferredViews.indexOf(b.view));

      return { primaryItems: primary, menuItems: menu };
  }, [sortedItems, settings?.mobileDockViews, currentUser?.role]);

  // --- Desktop Sidebar (Vertical) ---
  const DesktopSidebar = (
    <aside 
      className={`
        hidden md:flex flex-col
        fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-40
        bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-r
        transition-all duration-300 ease-in-out shadow-sm
        ${isCollapsed ? 'w-[88px]' : 'w-64'} 
        relative translate-x-0
      `}
    >
      {/* Header */}
      <div className="h-[72px] flex items-center justify-between px-6 border-b dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md overflow-hidden">
        <div className={`flex items-center gap-3 min-w-0 transition-all duration-300 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
             {companyInfo?.logo ? (
                <img 
                    src={companyInfo.logo} 
                    alt="Logo" 
                    className="w-full h-full object-contain drop-shadow-md hover:scale-110 transition-transform duration-300" 
                />
             ) : (
                <Logo className="w-10 h-10" />
             )}
          </div>
          {!isCollapsed && (
            <span className="text-lg font-black text-slate-800 dark:text-white truncate animate-in fade-in duration-300 tracking-tight">
              {companyInfo?.name || 'Fast Comand'}
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {sortedItems.map(item => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => handleNavClick(item.view as View)}
              title={isCollapsed ? item.label : ''}
              className={`
                w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 font-bold group
                ${isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]' 
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:text-slate-400 hover:text-primary'}
                ${isCollapsed ? 'justify-center px-0' : ''}
              `}
            >
              <item.icon size={22} className={`flex-shrink-0`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              {isActive && !isCollapsed && <div className="w-1.5 h-1.5 rounded-full bg-white ml-auto"></div>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex w-full items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-400 hover:text-primary transition-all shadow-sm border border-slate-100 dark:border-slate-700"
        >
          {isCollapsed ? (isRtl ? <ChevronLeft /> : <ChevronRight />) : (isRtl ? <ChevronRight /> : <ChevronLeft />)}
        </button>
        
        <button 
          onClick={() => { playSound('pop'); logout(); }}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold ${isCollapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut size={22} className="flex-shrink-0" />
          {!isCollapsed && <span>{t('logout')}</span>}
        </button>
      </div>
    </aside>
  );

  // --- Mobile Smart Dock (Bottom) ---
  const MobileDock = (
    <>
      {/* Scroll To Top Button (Smart Floating) */}
      <button
          onClick={onScrollToTop}
          className={`
            md:hidden fixed z-40 right-4 p-3 bg-primary text-white rounded-full shadow-xl shadow-primary/30 transition-all duration-300 transform border-2 border-white dark:border-slate-800
            ${!isDockVisible ? 'bottom-20 translate-y-0 opacity-100' : 'bottom-4 translate-y-10 opacity-0 pointer-events-none'}
          `}
      >
          <ArrowUp size={24} strokeWidth={3} />
      </button>

      {/* "More" Menu Overlay */}
      {isMoreMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMoreMenuOpen(false)}
          >
              <div 
                className="absolute bottom-20 left-4 right-4 bg-white dark:bg-slate-800 rounded-[2rem] p-4 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200 border border-gray-100 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
              >
                  <div className="grid grid-cols-4 gap-4">
                      {menuItems.map(item => {
                          const isActive = currentView === item.view;
                          return (
                              <button
                                  key={item.view}
                                  onClick={() => handleNavClick(item.view as View)}
                                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                              >
                                  <div className={`p-3 rounded-full ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                      <item.icon size={20} />
                                  </div>
                                  <span className="text-[10px] font-bold truncate w-full text-center">{item.label}</span>
                              </button>
                          );
                      })}
                      
                      {/* Logout in More Menu */}
                      <button 
                          onClick={() => { playSound('pop'); logout(); }}
                          className="flex flex-col items-center gap-2 p-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                          <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                              <LogOut size={20} />
                          </div>
                          <span className="text-[10px] font-bold">خروج</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* The Dock Bar - Optimized Size */}
      <div className={`
          md:hidden fixed bottom-4 left-4 right-4 z-50 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isDockVisible ? 'translate-y-0' : 'translate-y-[150%]'}
      `}>
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-white/20 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 flex items-center justify-around relative">
          
          {/* Render Primary Items */}
          {primaryItems.map(item => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNavClick(item.view as View)}
                className={`
                  flex flex-col items-center justify-center p-2 rounded-xl min-w-[3.5rem] transition-all duration-300 relative
                  ${isActive ? 'bg-primary text-white shadow-lg -translate-y-3 border-2 border-white dark:border-slate-900 scale-110' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}
                `}
              >
                <item.icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <span className="text-[8px] font-bold mt-0.5 absolute -bottom-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-50 animate-in fade-in zoom-in">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
          
          {/* Divider */}
          {menuItems.length > 0 && <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 flex-shrink-0"></div>}
          
          {/* More Button */}
          {menuItems.length > 0 && (
              <button 
                onClick={() => { playSound('click'); setIsMoreMenuOpen(!isMoreMenuOpen); }}
                className={`
                    flex flex-col items-center justify-center p-2 rounded-xl min-w-[3.5rem] transition-all duration-300 relative
                    ${isMoreMenuOpen ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white' : 'text-slate-400 hover:bg-slate-100'}
                `}
              >
                <MoreHorizontal size={20} />
              </button>
          )}

        </div>
      </div>
    </>
  );

  return (
    <>
      {DesktopSidebar}
      {MobileDock}
    </>
  );
};

export default Sidebar;

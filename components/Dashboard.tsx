
import React, { useContext, useState, useMemo, useEffect, useRef } from 'react';
import type { Order, Client, Store, Shipment, Currency, AppSettings, GlobalActivityLog, DashboardStats } from '../types';
import { OrderStatus, ShipmentStatus, ShippingType } from '../types';
import { 
    ResponsiveContainer, 
    AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar, Legend, BarChart, PieChart, Pie, Cell
} from 'recharts';
import { 
    TrendingUp, Package, Truck, Wallet, Calculator,
    Plus, Search, AlertCircle, CircleDashed, Clock, 
    PackageCheck, Zap, Activity, ShoppingCart, CheckCircle2, ChevronUp, ChevronDown, Loader2, FileWarning, X, Command, ArrowRight, Users, Store as StoreIcon, ScrollText, Scale, Calendar, PieChart as PieIcon, DollarSign, BellRing, Weight
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import QuickCalculator from './QuickCalculator';
import HelpIcon from './HelpIcon';
import { HELP_CONTENT } from '../utils/helpContent';

const fmtCurrency = (num: number) => Math.round(num).toLocaleString('en-US');

const KPI_Card: React.FC<{ 
    title: string; 
    value: number | string; 
    icon: any; 
    color: string; 
    subtitle?: string; 
    onClick?: () => void; 
    loading?: boolean;
    isCurrency?: boolean;
    suffix?: string;
    helpKey: keyof typeof HELP_CONTENT;
}> = ({ title, value, icon: Icon, color, subtitle, onClick, loading, isCurrency = true, suffix = 'MRU', helpKey }) => (
    <div 
        onClick={onClick}
        className="min-w-[260px] md:min-w-0 flex-1 bg-white dark:bg-slate-800 p-5 rounded-[1.5rem] shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden snap-start"
    >
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-[0.08] -mr-8 -mt-8 rounded-full group-hover:scale-125 transition-transform duration-500`}></div>
        <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex justify-between items-start mb-2">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                    <Icon size={20} />
                </div>
                <div className="flex items-center gap-1.5">
                    {subtitle && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-slate-500 dark:text-slate-300 font-bold">{subtitle}</span>}
                    <HelpIcon content={HELP_CONTENT[helpKey]} />
                </div>
            </div>
            <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
                <div className="flex items-baseline gap-1">
                    {loading ? (
                        <Loader2 className="animate-spin text-slate-300" size={20}/>
                    ) : (
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white font-mono tracking-tight">
                            {typeof value === 'number' && isCurrency ? fmtCurrency(value) : value.toLocaleString()}
                        </h3>
                    )}
                    <span className="text-[10px] font-bold text-slate-400">{isCurrency ? 'MRU' : suffix}</span>
                </div>
            </div>
        </div>
    </div>
);

const StatGridItem: React.FC<{ label: string; value: number; icon: any; colorClass: string; onClick?: () => void; helpKey?: keyof typeof HELP_CONTENT }> = ({ label, value, icon: Icon, colorClass, onClick, helpKey }) => (
    <div onClick={onClick} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-gray-700 flex items-center justify-between shadow-sm active:scale-95 transition-transform cursor-pointer relative group">
        <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} ${colorClass} bg-opacity-20`}>
                <Icon size={18} />
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xl font-black font-mono text-slate-800 dark:text-white">{value}</span>
            {helpKey && <HelpIcon content={HELP_CONTENT[helpKey]} className="opacity-0 group-hover:opacity-100" />}
        </div>
    </div>
);

const UrgentActionChip: React.FC<{ label: string; count: number; icon: any; color: string; onClick: () => void }> = ({ label, count, icon: Icon, color, onClick }) => {
    if (count === 0) return null;
    return (
        <button onClick={onClick} className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all hover:scale-105 active:scale-95 shadow-sm flex-shrink-0 min-w-[160px] ${color}`}>
            <div className="p-2 bg-white/20 rounded-full">
                <Icon size={20} />
            </div>
            <div className="text-right">
                <span className="block font-black text-xl leading-none mb-1">{count}</span>
                <span className="text-xs font-bold opacity-90">{label}</span>
            </div>
        </button>
    );
};

const ActivityFeedItem: React.FC<{ log: GlobalActivityLog }> = ({ log }) => {
    const isCreate = log.action.toLowerCase().includes('create') || log.action.includes('new');
    const isUpdate = log.action.toLowerCase().includes('update') || log.action.includes('status');
    const isDelete = log.action.toLowerCase().includes('delete');
    
    let color = 'bg-blue-100 text-blue-600';
    let icon = <Activity size={14} />;

    if (isCreate) { color = 'bg-green-100 text-green-600'; icon = <Plus size={14} />; }
    if (isUpdate) { color = 'bg-orange-100 text-orange-600'; icon = <Zap size={14} />; }
    if (isDelete) { color = 'bg-red-100 text-red-600'; icon = <X size={14} />; }

    return (
        <div className="flex gap-3 items-start p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors">
            <div className={`p-2 rounded-full ${color} mt-0.5 shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">
                    <span className="text-primary">{log.user}:</span> {log.details}
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
};

const Dashboard: React.FC<{
    orders: Order[];
    clients: Client[];
    stores: Store[];
    shipments: Shipment[];
    onFilterClick: (filter: string) => void;
    onSearch?: (term: string) => void;
    onNewOrder: () => void;
    settings: AppSettings;
    currencies: Currency[];
    isLoading: boolean;
    globalActivityLog: GlobalActivityLog[];
    dashboardStats: DashboardStats | null;
}> = ({ orders, shipments, onFilterClick, onSearch, onNewOrder, settings, currencies, isLoading, dashboardStats, stores, clients, globalActivityLog }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [searchValue, setSearchValue] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);
    
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const handleSearchSubmit = () => {
        if (onSearch) {
            onSearch(searchValue);
        } else {
            onFilterClick(searchValue);
        }
    };

    const showFinancials = currentUser?.permissions.canViewFinance;

    const displayStats = dashboardStats || {
        profit: 0,
        revenue: 0,
        debt: 0,
        cash: 0,
        totalOrders: 0,
        readyOrders: 0,
        transitOrders: 0,
        chartData: []
    };

    const isStatsLoading = isLoading || (!dashboardStats && orders.length > 0);

    const urgentStats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        
        return {
            lateOrders: orders.filter(o => (o.status === OrderStatus.ORDERED || o.status === OrderStatus.SHIPPED_FROM_STORE) && o.expectedArrivalDate && o.expectedArrivalDate < today).length,
            needsTracking: orders.filter(o => o.status === OrderStatus.ORDERED && !o.trackingNumber).length,
            waitingWeight: orders.filter(o => o.status === OrderStatus.ARRIVED_AT_OFFICE && (!o.weight || o.weight === 0)).length,
            pendingInvoice: orders.filter(o => o.status === OrderStatus.ORDERED && !o.isInvoicePrinted).length,
            pendingNotification: orders.filter(o => (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) && !o.whatsappNotificationSent).length,
            newOrders: orders.filter(o => o.status === OrderStatus.NEW).length,
        };
    }, [orders]);

    const completedOrdersCount = orders.filter(o => o.status === OrderStatus.COMPLETED).length;
    const orderedCount = orders.filter(o => o.status === OrderStatus.ORDERED).length;

    const adminAnalytics = useMemo(() => {
        if (!showFinancials) return null;
        const statusDist = [
            { name: 'جديد/قيد المعالجة', value: orders.filter(o => [OrderStatus.NEW, OrderStatus.ORDERED].includes(o.status)).length, color: '#3B82F6' },
            { name: 'في الشحن', value: orders.filter(o => o.status === OrderStatus.SHIPPED_FROM_STORE).length, color: '#F59E0B' },
            { name: 'وصل المكتب', value: orders.filter(o => o.status === OrderStatus.ARRIVED_AT_OFFICE || o.status === OrderStatus.STORED).length, color: '#10B981' },
            { name: 'توصيل/مكتمل', value: orders.filter(o => o.status === OrderStatus.OUT_FOR_DELIVERY || o.status === OrderStatus.COMPLETED).length, color: '#8B5CF6' },
        ].filter(i => i.value > 0);

        const storeStats: Record<string, { profit: number, count: number }> = {};
        orders.forEach(o => {
            if (o.status !== OrderStatus.CANCELLED && o.storeId) {
                if (!storeStats[o.storeId]) storeStats[o.storeId] = { profit: 0, count: 0 };
                const comm = Number(o.commission || 0);
                const fee = Number(o.transactionFee || 0);
                storeStats[o.storeId].profit += (comm - fee);
                storeStats[o.storeId].count += 1;
            }
        });

        const topStores = Object.entries(storeStats)
            .map(([id, data]) => ({ 
                name: stores.find(s => s.id === id)?.name || 'Unknown', 
                profit: data.profit, 
                count: data.count 
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);

        return { statusDist, topStores };
    }, [orders, showFinancials, stores]);

    const operationalStats = useMemo(() => {
        const activeOrders = orders.filter(o => o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED).length;
        const activeShipments = shipments.filter(s => s.status !== ShipmentStatus.RECEIVED && s.status !== ShipmentStatus.ARRIVED).length;
        const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED).length;
        const readyForPickup = orders.filter(o => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE).length;
        const totalWeight = orders.reduce((sum, o) => sum + (Number(o.weight) || 0), 0);
        
        const storeVolume: Record<string, { count: number, totalProducts: number }> = {};
        orders.forEach(o => {
            if (o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.NEW) {
                if(!storeVolume[o.storeId]) storeVolume[o.storeId] = { count: 0, totalProducts: 0 };
                storeVolume[o.storeId].count++;
                storeVolume[o.storeId].totalProducts += (o.quantity || 1);
            }
        });
        
        const topStores = Object.entries(storeVolume)
            .map(([id, data]) => ({ 
                name: stores.find(s => s.id === id)?.name || 'Unknown', 
                count: data.count,
                products: data.totalProducts
            }))
            .sort((a,b) => b.products - a.products)
            .slice(0, 5);

        return { activeOrders, activeShipments, completedOrders, readyForPickup, totalWeight, topStores };
    }, [orders, shipments, stores]);

    return (
        <div className="space-y-6 pb-24 md:pb-10 max-w-full overflow-x-hidden font-sans">
            
            {/* Top Bar */}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className={`relative group transition-all duration-300 flex-grow z-20 ${isSearchFocused ? 'scale-[1.01]' : ''}`}>
                    <div className="relative h-12 md:h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center overflow-hidden">
                        <div className={`pl-4 pr-3 transition-colors duration-300 ${isSearchFocused ? 'text-primary' : 'text-slate-400'}`}>
                            <Search size={20} />
                        </div>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            value={searchValue}
                            onChange={e => setSearchValue(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
                            placeholder="بحث ذكي: رقم الطلب، العميل، الهاتف..."
                            className="w-full h-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400 placeholder:font-normal"
                        />
                        {searchValue && (
                            <button onClick={() => setSearchValue('')} className="p-2 text-slate-400 hover:text-red-500">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    {currentUser?.permissions.orders.create && (
                        <button 
                            onClick={onNewOrder} 
                            className="flex-1 lg:flex-none h-12 md:h-14 px-6 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold shadow-lg shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Plus size={20} strokeWidth={3} /> {t('newOrder')}
                        </button>
                    )}
                    
                    <button 
                        onClick={() => setShowCalculator(!showCalculator)} 
                        className={`h-12 md:h-14 w-12 md:w-14 rounded-2xl flex items-center justify-center transition-all ${showCalculator ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                    >
                        <Calculator size={20}/>
                    </button>
                </div>
            </div>

            {showCalculator && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                    <QuickCalculator currencies={currencies} settings={settings} />
                </div>
            )}

            {/* KPI Cards */}
            <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory no-scrollbar">
                    {showFinancials ? (
                        <>
                            <KPI_Card title="صافي الأرباح" value={displayStats.profit} icon={TrendingUp} color="from-emerald-400 to-green-600" loading={isStatsLoading} subtitle="Net Profit" helpKey="profit" />
                            <KPI_Card title="إجمالي الأوزان" value={operationalStats.totalWeight.toFixed(1)} icon={Weight} color="from-cyan-400 to-sky-600" loading={isStatsLoading} isCurrency={false} suffix="KG" subtitle="Total Payload" helpKey="payload" />
                            <KPI_Card title="الديون المستحقة" value={displayStats.debt} icon={AlertCircle} color="from-rose-400 to-red-600" loading={isStatsLoading} subtitle="Debt" helpKey="debt" />
                            <KPI_Card title="السيولة المستلمة" value={displayStats.cash} icon={Wallet} color="from-amber-400 to-orange-600" loading={isStatsLoading} subtitle="Cash Flow" helpKey="cash" />
                        </>
                    ) : (
                        <>
                            <KPI_Card title="الطلبات النشطة" value={operationalStats.activeOrders} icon={Package} color="from-blue-400 to-blue-600" loading={isStatsLoading} isCurrency={false} suffix="طلب" subtitle="Active Orders" helpKey="active_orders" />
                            <KPI_Card title="إجمالي الأوزان" value={operationalStats.totalWeight.toFixed(1)} icon={Weight} color="from-cyan-400 to-sky-600" loading={isStatsLoading} isCurrency={false} suffix="KG" subtitle="Total Payload" helpKey="payload" />
                            <KPI_Card title="جاهز للتسليم" value={operationalStats.readyForPickup} icon={Clock} color="from-orange-400 to-amber-600" loading={isStatsLoading} isCurrency={false} suffix="طلب" subtitle="Ready for Pickup" onClick={() => onFilterClick('ready_pickup')} helpKey="active_orders" />
                            <KPI_Card title="طلبات مكتملة" value={operationalStats.completedOrders} icon={CheckCircle2} color="from-teal-400 to-emerald-600" loading={isStatsLoading} isCurrency={false} suffix="طلب" subtitle="Completed Orders" onClick={() => onFilterClick(OrderStatus.COMPLETED)} helpKey="active_orders" />
                        </>
                    )}
                </div>
            </div>

            {/* Action Center (Urgent Chips) */}
            {(urgentStats.lateOrders > 0 || urgentStats.needsTracking > 0 || urgentStats.waitingWeight > 0 || urgentStats.pendingInvoice > 0 || urgentStats.pendingNotification > 0 || urgentStats.newOrders > 0) && (
                <div>
                    <h3 className="text-sm font-black text-slate-500 mb-3 px-1 flex items-center gap-2 uppercase tracking-widest">
                        <AlertCircle size={16}/> إجراءات عاجلة
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 custom-scrollbar snap-x">
                        <UrgentActionChip 
                            label="طلبات جديدة" 
                            count={urgentStats.newOrders} 
                            icon={CircleDashed} 
                            color="bg-blue-500 text-white shadow-lg shadow-blue-500/30 border-blue-400" 
                            onClick={() => onFilterClick(OrderStatus.NEW)} 
                        />
                        <UrgentActionChip 
                            label="بانتظار التنبيه" 
                            count={urgentStats.pendingNotification} 
                            icon={BellRing} 
                            color="bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border-emerald-400" 
                            onClick={() => onFilterClick('pending_notification')} 
                        />
                        <UrgentActionChip 
                            label="طلبات متأخرة" 
                            count={urgentStats.lateOrders} 
                            icon={Clock} 
                            color="bg-red-500 text-white shadow-lg shadow-red-500/30 border-red-400" 
                            onClick={() => onFilterClick('late')} 
                        />
                        <UrgentActionChip 
                            label="نقص تتبع" 
                            count={urgentStats.needsTracking} 
                            icon={AlertCircle} 
                            color="bg-orange-500 text-white shadow-lg shadow-orange-500/30 border-orange-400" 
                            onClick={() => onFilterClick('needs_tracking')} 
                        />
                        <UrgentActionChip 
                            label="وصول بلا وزن" 
                            count={urgentStats.waitingWeight} 
                            icon={Scale} 
                            color="bg-pink-500 text-white shadow-lg shadow-pink-500/30 border-pink-400" 
                            onClick={() => onFilterClick('waiting_weight')} 
                        />
                        <UrgentActionChip 
                            label="بانتظار الفوترة" 
                            count={urgentStats.pendingInvoice} 
                            icon={FileWarning} 
                            color="bg-purple-600 text-white shadow-lg shadow-purple-600/30 border-purple-500" 
                            onClick={() => onFilterClick('pending_invoice')} 
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white flex flex-col justify-center items-center text-center relative overflow-hidden border border-slate-700 shadow-md">
                    <div className="relative z-10">
                        <PackageCheck className="text-emerald-400 mb-2 mx-auto" size={28} />
                        <p className="text-4xl font-black font-mono my-1">{displayStats.totalOrders}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إجمالي الطلبات</p>
                    </div>
                    <CheckCircle2 size={100} className="absolute -bottom-4 -right-4 opacity-5 text-white pointer-events-none"/>
                </div>

                <StatGridItem label="بانتظار الشحن" value={orderedCount} icon={ShoppingCart} colorClass="text-purple-600" onClick={() => onFilterClick(OrderStatus.ORDERED)} helpKey="active_orders"/>
                <StatGridItem label="شحنات بالطريق" value={displayStats.transitOrders} icon={Truck} colorClass="text-blue-600" onClick={() => onFilterClick(OrderStatus.SHIPPED_FROM_STORE)} helpKey="active_orders"/>
                <StatGridItem label="واصل / بالمخزن" value={displayStats.readyOrders} icon={Clock} colorClass="text-orange-600" onClick={() => onFilterClick('ready_pickup')} helpKey="active_orders"/>
                <StatGridItem label="طلبات مكتملة" value={completedOrdersCount} icon={CheckCircle2} colorClass="text-green-600" onClick={() => onFilterClick(OrderStatus.COMPLETED)} helpKey="active_orders"/>
            </div>

            {showFinancials ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <TrendingUp className="text-primary" size={20} /> {t('weeklyPerformance')}
                                </h3>
                            </div>
                        </div>
                        <div className="h-64 md:h-80 w-full">
                            {isStatsLoading ? (
                                <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-300"/></div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={displayStats.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                                        <Tooltip 
                                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.95)', fontSize: '12px'}} 
                                        />
                                        <Area type="monotone" dataKey="val" name="الربح" fillOpacity={1} fill="url(#colorVal)" stroke="#4F46E5" strokeWidth={3} />
                                        <Bar dataKey="count" name="العدد" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={20} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1 min-h-[250px]">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-2">
                                <PieIcon className="text-purple-500" size={20} /> توزيع الطلبات
                            </h3>
                            <div className="h-48 w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={adminAnalytics?.statusDist || []}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {(adminAnalytics?.statusDist || []).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xs text-gray-400 font-bold uppercase">إجمالي</span>
                                    <span className="text-xl font-black text-slate-800 dark:text-white">{orders.length}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 mt-2">
                                {adminAnalytics?.statusDist.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1 text-[10px]">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-slate-600 dark:text-slate-400">{item.name} ({item.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex-1">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                                <StoreIcon className="text-orange-500" size={20} /> الأكثر ربحية
                            </h3>
                            <div className="space-y-3">
                                {adminAnalytics?.topStores.map((store, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{store.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono font-bold text-green-600 text-xs block">{store.profit.toLocaleString()} MRU</span>
                                        </div>
                                    </div>
                                ))}
                                {(!adminAnalytics?.topStores || adminAnalytics.topStores.length === 0) && (
                                    <p className="text-center text-gray-400 text-xs py-4">لا توجد بيانات متاجر</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <ScrollText className="text-primary" size={20} /> آخر العمليات في النظام
                            </h3>
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                            {globalActivityLog.slice(0, 8).map((log, idx) => (
                                <ActivityFeedItem key={log.id || idx} log={log} />
                            ))}
                            {globalActivityLog.length === 0 && (
                                <p className="text-center text-gray-400 py-10 text-sm">لا توجد عمليات مسجلة حديثاً</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                            <StoreIcon className="text-orange-500" size={20} /> المتاجر (إجمالي القطع المطلوبة)
                        </h3>
                        <div className="space-y-4">
                            {operationalStats.topStores.map((store, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 max-w-[70%]">
                                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500">
                                            {idx + 1}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{store.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-20 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-orange-500 rounded-full" 
                                                style={{ width: `${Math.min(100, (store.products / Math.max(1, operationalStats.topStores[0].products)) * 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-orange-600">{store.products} <span className="text-[9px] text-gray-400">قطعة</span></span>
                                    </div>
                                </div>
                            ))}
                            {operationalStats.topStores.length === 0 && (
                                <p className="text-center text-gray-400 py-10 text-sm">لا توجد بيانات متاجر</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

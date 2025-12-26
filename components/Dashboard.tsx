
import React, { useContext, useState, useMemo } from 'react';
import type { Order, Client, Store, Shipment, Currency, AppSettings, GlobalActivityLog, DashboardStats } from '../types';
import { OrderStatus, ShipmentStatus, ShippingType } from '../types';
import { 
    ResponsiveContainer, 
    AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar, Legend
} from 'recharts';
import { 
    TrendingUp, Package, Truck, Wallet, Calculator,
    Plus, Search, AlertCircle, CircleDashed, Clock, 
    PackageCheck, Zap, Activity, ShoppingCart, CheckCircle2, ChevronUp, ChevronDown, Loader2, FileWarning
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import QuickCalculator from './QuickCalculator';

const fmtCurrency = (num: number) => Math.round(num).toLocaleString('en-US');

const KPI_Card: React.FC<{ title: string; value: number; icon: any; color: string; subtitle?: string; onClick?: () => void; loading?: boolean }> = ({ title, value, icon: Icon, color, subtitle, onClick, loading }) => (
    <div 
        onClick={onClick}
        className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
    >
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-[0.05] -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-500`}></div>
        <div className="flex justify-between items-start relative z-10">
            <div className="space-y-1">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
                <div className="flex items-baseline gap-1">
                    {loading ? (
                        <Loader2 className="animate-spin text-slate-300" size={24}/>
                    ) : (
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white font-mono">{fmtCurrency(value)}</h3>
                    )}
                    <span className="text-[10px] font-bold text-slate-400">MRU</span>
                </div>
                {subtitle && <p className="text-[10px] text-slate-400 mt-1 font-bold">{subtitle}</p>}
            </div>
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg transform group-hover:rotate-6 transition-transform`}>
                <Icon size={24} />
            </div>
        </div>
    </div>
);

const UrgentActionChip: React.FC<{ label: string; count: number; icon: any; color: string; onClick: () => void }> = ({ label, count, icon: Icon, color, onClick }) => {
    if (count === 0) return null;
    return (
        <button onClick={onClick} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-[11px] font-black transition-all hover:scale-105 active:scale-95 shadow-sm ${color}`}>
            <Icon size={16} />
            <span>{label}</span>
            <span className="bg-white/90 dark:bg-slate-800/90 px-2 py-0.5 rounded-full shadow-inner min-w-[28px]">{count}</span>
        </button>
    );
};

const Dashboard: React.FC<{
    orders: Order[];
    clients: Client[];
    stores: Store[];
    shipments: Shipment[];
    onFilterClick: (filter: string) => void;
    onNewOrder: () => void;
    settings: AppSettings;
    currencies: Currency[];
    isLoading: boolean;
    globalActivityLog: GlobalActivityLog[];
    dashboardStats: DashboardStats | null;
}> = ({ orders, shipments, onFilterClick, onNewOrder, settings, currencies, isLoading, dashboardStats }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [searchValue, setSearchValue] = useState('');
    const [showCalculator, setShowCalculator] = useState(false);

    const isAdmin = currentUser?.role === 'admin';

    // Use server-provided stats if available, otherwise fallback to local calculation (mostly for initial render)
    // Note: Local calc will be inaccurate if data is paginated, so prefer loading state if stats are missing
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

    // If we have orders but no stats yet (initial fetch lag), rely on isLoading
    // If we have 0 orders and no stats, it's either new app or loading
    const isStatsLoading = isLoading || (!dashboardStats && orders.length > 0);

    // Urgent items are calculated from the *latest* orders which are likely in the first page anyway.
    const urgent = {
        notOrdered: orders.filter(o => o.status === OrderStatus.NEW).length,
        noTracking: orders.filter(o => o.status === OrderStatus.ORDERED && !o.trackingNumber).length,
        noWeight: orders.filter(o => o.status === OrderStatus.ARRIVED_AT_OFFICE && (!o.weight || o.weight === 0)).length,
        pendingInvoice: orders.filter(o => o.status === OrderStatus.ORDERED && !o.isInvoicePrinted).length,
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Top Bar: New Order & Smart Search */}
            <div className="flex flex-col md:flex-row gap-5 items-stretch">
                <button onClick={onNewOrder} className="px-10 py-5 bg-primary hover:bg-primary-dark text-white rounded-[1.8rem] font-black shadow-2xl shadow-primary/40 transition-all active:scale-95 flex items-center justify-center gap-3">
                    <Plus size={28} strokeWidth={3} /> {t('newOrder')}
                </button>
                <div className="flex-1 relative group">
                    <input 
                        type="text" 
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onFilterClick(searchValue)}
                        placeholder="ابحث بذكاء (رقم طلب، عميل، تتبع...)"
                        className="w-full h-full py-5 pr-14 pl-8 bg-white dark:bg-slate-800 border-none rounded-[1.8rem] shadow-soft group-focus-within:ring-2 ring-primary/30 transition-all text-base font-bold dark:text-white"
                    />
                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={24} />
                </div>
            </div>

            {/* Quick Calculator */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <Calculator className="text-primary" size={20}/>
                        <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest">أداة التسعير السريعة</h3>
                    </div>
                    <button 
                        onClick={() => setShowCalculator(!showCalculator)} 
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all"
                    >
                        {showCalculator ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                    </button>
                </div>
                
                {showCalculator && (
                    <div className="animate-in slide-in-from-top-4 fade-in duration-500">
                        <QuickCalculator currencies={currencies} settings={settings} />
                    </div>
                )}
            </div>

            {/* Urgent Center */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-1 rounded-full border dark:border-slate-800 flex flex-wrap gap-2 overflow-x-auto custom-scrollbar no-scrollbar shadow-inner">
                <UrgentActionChip label="طلبات جديدة للطلب" count={urgent.notOrdered} icon={CircleDashed} color="bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400" onClick={() => onFilterClick(OrderStatus.NEW)} />
                <UrgentActionChip label="لم ترسل الفاتورة" count={urgent.pendingInvoice} icon={FileWarning} color="bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400" onClick={() => onFilterClick('pending_invoice')} />
                <UrgentActionChip label="نقص رقم التتبع" count={urgent.noTracking} icon={AlertCircle} color="bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400" onClick={() => onFilterClick('needs_tracking')} />
                <UrgentActionChip label="وصول بدون وزن" count={urgent.noWeight} icon={Clock} color="bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400" onClick={() => onFilterClick(OrderStatus.ARRIVED_AT_OFFICE)} />
            </div>

            {/* Main KPIs Section (Admin Only) */}
            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPI_Card title="صافي الأرباح" value={displayStats.profit} icon={TrendingUp} color="from-emerald-400 to-green-600" loading={isStatsLoading} subtitle="بعد خصم الرسوم" />
                    <KPI_Card title="التدفق المالي (إيرادات)" value={displayStats.revenue} icon={Activity} color="from-blue-400 to-indigo-600" loading={isStatsLoading} subtitle="قيمة الفواتير الكلية" />
                    <KPI_Card title="الديون المستحقة" value={displayStats.debt} icon={AlertCircle} color="from-rose-400 to-red-600" loading={isStatsLoading} subtitle="مبالغ لم يتم تحصيلها" />
                    <KPI_Card title="السيولة المستلمة" value={displayStats.cash} icon={Wallet} color="from-amber-400 to-orange-600" loading={isStatsLoading} subtitle="كاش + تحويلات" />
                </div>
            )}

            {/* Analytics & Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Performance Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-soft border border-slate-100 dark:border-slate-700/50">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                <TrendingUp className="text-primary" /> {t('weeklyPerformance')}
                            </h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">تطور الأرباح الصافية وعدد الطلبات</p>
                        </div>
                    </div>
                    <div className="h-72">
                        {isStatsLoading ? (
                            <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-gray-300"/></div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={displayStats.chartData}>
                                    <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                    <Tooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.9)'}} />
                                    <Area type="monotone" dataKey="val" name="صافي الربح" fillOpacity={1} fill="url(#colorVal)" stroke="#4F46E5" strokeWidth={4} />
                                    <Bar dataKey="count" name="عدد الطلبات" fill="#F59E0B" radius={[6, 6, 0, 0]} barSize={40} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Side Summary Block */}
                <div className="flex flex-col gap-4">
                    <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-8 text-white relative overflow-hidden border border-slate-700">
                        <div className="relative z-10">
                            <PackageCheck className="text-emerald-400 mb-4" size={32} />
                            <h4 className="text-lg font-bold text-slate-400 uppercase tracking-widest text-[10px]">إجمالي الطلبات</h4>
                            <p className="text-5xl font-black font-mono my-2">{displayStats.totalOrders}</p>
                            <p className="text-xs text-slate-500 font-bold">جميع الطلبات النشطة في النظام</p>
                        </div>
                        <div className="absolute bottom-0 right-0 p-4 opacity-10">
                            <CheckCircle2 size={120} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Lower Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl text-center border dark:border-slate-700 group hover:border-primary transition-colors">
                    <Package className="mx-auto mb-2 text-primary group-hover:animate-bounce" />
                    <p className="text-2xl font-black font-mono">{displayStats.totalOrders}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الطلبات</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl text-center border dark:border-slate-700 group hover:border-purple-500 transition-colors">
                    <ShoppingCart className="mx-auto mb-2 text-purple-500 group-hover:animate-bounce" />
                    <p className="text-2xl font-black font-mono">{orders.filter(o=>o.status === OrderStatus.ORDERED).length}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase">بانتظار الشحن (محلي)</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl text-center border dark:border-slate-700 group hover:border-blue-500 transition-colors">
                    <Truck className="mx-auto mb-2 text-blue-500 group-hover:animate-bounce" />
                    <p className="text-2xl font-black font-mono">{displayStats.transitOrders}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase">شحنات بالطريق</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl text-center border dark:border-slate-700 group hover:border-orange-500 transition-colors">
                    <Clock className="mx-auto mb-2 text-orange-500 group-hover:animate-bounce" />
                    <p className="text-2xl font-black font-mono">{displayStats.readyOrders}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase">بالمخزن / وصل</p>
                </div>
                <div className="hidden lg:flex bg-white dark:bg-slate-800 p-5 rounded-3xl text-center border dark:border-slate-700 flex-col items-center justify-center">
                    <Activity className="text-slate-200 dark:text-slate-700" size={32} />
                    <span className="text-[10px] text-slate-300 dark:text-slate-600 mt-2 font-black uppercase">النظام مراقب</span>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;


import React, { useState, useMemo } from 'react';
import type { Order, AppSettings, PaymentMethod, Store } from '../types';
import { OrderStatus } from '../types';
import { 
    Activity, TrendingUp, TrendingDown, DollarSign, 
    Filter, Download, Wallet, CreditCard, ShoppingCart, 
    Truck, AlertCircle, PieChart, ArrowUpRight, ArrowDownRight, Layers, Banknote, Coins, Store as StoreIcon, BarChart3, Calculator, Calendar
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    AreaChart, Area, CartesianGrid, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';
import * as XLSX from 'xlsx';

interface FinancePageProps {
    orders: Order[];
    stores: Store[];
    settings?: AppSettings;
    paymentMethods: PaymentMethod[];
}

interface StorePerf {
    revenue: number;
    profit: number;
    count: number;
    name: string;
}

interface PaymentPerf {
    amount: number;
    fees: number;
    count: number;
}

// --- Helper Components ---

const TrendIndicator: React.FC<{ current: number; previous: number; type?: 'currency' | 'number' }> = ({ current, previous, type = 'currency' }) => {
    const diff = current - previous;
    const percentage = previous !== 0 ? (diff / previous) * 100 : 0;
    const isPositive = diff >= 0;
    
    return (
        <div className={`flex items-center gap-1 text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'} bg-white/10 px-2 py-1 rounded-lg`}>
            {isPositive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
            <span>{Math.abs(percentage).toFixed(1)}%</span>
        </div>
    );
};

const StatCard: React.FC<{ 
    title: string; 
    value: number; 
    previousValue?: number;
    icon: any; 
    color: 'blue' | 'emerald' | 'violet' | 'rose' | 'amber' | 'cyan' | 'indigo';
    subtitle: string;
    isCurrency?: boolean;
    suffix?: string;
}> = ({ title, value, previousValue, icon: Icon, color, subtitle, isCurrency = true, suffix = '' }) => {
    const gradients = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        violet: 'from-violet-500 to-purple-600',
        rose: 'from-rose-500 to-red-600',
        amber: 'from-amber-500 to-orange-600',
        cyan: 'from-cyan-500 to-sky-600',
        indigo: 'from-indigo-500 to-blue-700',
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-lg border border-gray-100 dark:border-gray-700 group hover:-translate-y-1 transition-all duration-300`}>
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-gradient-to-br ${gradients[color]} bg-clip-text text-transparent`}>
                <Icon size={80} />
            </div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradients[color]} text-white shadow-md`}>
                        <Icon size={20} />
                    </div>
                    {previousValue !== undefined && <TrendIndicator current={value} previous={previousValue} />}
                </div>
                
                <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-black text-gray-800 dark:text-white font-mono tracking-tight">
                    {value.toLocaleString()} {isCurrency && <span className="text-xs text-gray-400 font-medium">MRU</span>} {suffix}
                </h3>
                <p className="text-[10px] text-gray-400 mt-1 font-medium">{subtitle}</p>
            </div>
        </div>
    );
};

// --- Text Normalization Engine ---
const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[^\w\s\u0600-\u06FF]/g, '')
        .replace(/\s+/g, ' ');
};

// --- Helper to Calculate Fee ---
const calculateFeeForOrder = (order: Order, paymentMethods: PaymentMethod[]): number => {
    const paidAmount = Number(order.amountPaid || 0);
    if (paidAmount <= 0) return 0;

    // 1. Try to find fee based on Settings
    const orderMethodName = normalizeText(order.paymentMethod || '');
    
    if (orderMethodName) {
        const matchedMethod = paymentMethods.find(m => normalizeText(m.name) === orderMethodName);
        const rate = Number(matchedMethod?.feeRate || 0);
        
        if (rate > 0) {
            return (paidAmount * rate) / 100;
        }
    }

    // 2. Fallback: Use stored fee in DB
    const savedFee = Number(order.transactionFee || 0);
    if (savedFee > 0) return savedFee;

    return 0;
};

const FinancePage: React.FC<FinancePageProps> = ({ orders = [], stores = [], paymentMethods = [] }) => {
    // --- State ---
    const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'year' | 'custom'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // --- Financial Logic Engine ---

    // 1. Get Date Ranges (Current vs Previous for Trends)
    const dateRanges = useMemo(() => {
        let currentStart: Date, currentEnd: Date;
        let prevStart: Date, prevEnd: Date;

        const now = new Date();

        if (dateFilter === 'week') {
            // Current Week (Last 7 days logic for performance tracking)
            currentEnd = new Date(now);
            currentEnd.setHours(23, 59, 59, 999);
            currentStart = new Date(now);
            currentStart.setDate(now.getDate() - 6);
            currentStart.setHours(0, 0, 0, 0);

            // Previous Week
            prevEnd = new Date(currentStart);
            prevEnd.setDate(prevEnd.getDate() - 1);
            prevEnd.setHours(23, 59, 59, 999);
            prevStart = new Date(prevEnd);
            prevStart.setDate(prevStart.getDate() - 6);
            prevStart.setHours(0, 0, 0, 0);

        } else if (dateFilter === 'month') {
            const [y, m] = selectedMonth.split('-');
            currentStart = new Date(parseInt(y), parseInt(m) - 1, 1);
            currentEnd = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59);
            
            // Previous Month
            prevStart = new Date(parseInt(y), parseInt(m) - 2, 1);
            prevEnd = new Date(parseInt(y), parseInt(m) - 1, 0, 23, 59, 59);

        } else if (dateFilter === 'year') {
            const y = parseInt(selectedYear);
            currentStart = new Date(y, 0, 1);
            currentEnd = new Date(y, 11, 31, 23, 59, 59);

            prevStart = new Date(y - 1, 0, 1);
            prevEnd = new Date(y - 1, 11, 31, 23, 59, 59);

        } else {
            // Custom
            currentStart = customStartDate ? new Date(customStartDate) : new Date(0); // Epoch if empty
            currentEnd = customEndDate ? new Date(customEndDate) : now;
            currentEnd.setHours(23, 59, 59);

            const duration = currentEnd.getTime() - currentStart.getTime();
            prevEnd = new Date(currentStart.getTime() - 1);
            prevStart = new Date(prevEnd.getTime() - duration);
        }

        return { currentStart, currentEnd, prevStart, prevEnd };
    }, [dateFilter, selectedMonth, selectedYear, customStartDate, customEndDate]);

    // 2. Filter Orders Helper
    const getOrdersForRange = (start: Date, end: Date) => {
        return orders.filter(o => {
            if (o.status === OrderStatus.CANCELLED || o.status === OrderStatus.NEW) return false;
            const d = new Date(o.orderDate);
            return d >= start && d <= end;
        });
    };

    const currentOrders = useMemo(() => getOrdersForRange(dateRanges.currentStart, dateRanges.currentEnd).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()), [orders, dateRanges]);
    const prevOrders = useMemo(() => getOrdersForRange(dateRanges.prevStart, dateRanges.prevEnd), [orders, dateRanges]);

    // 3. Advanced Calculate Stats Helper
    const calculateMetrics = (orderList: Order[]) => {
        let stats = {
            grossRevenue: 0,
            totalCollected: 0,
            totalDebt: 0,
            commission: 0,
            shippingFees: 0, 
            deliveryFees: 0, 
            financialFees: 0, 
            netProfit: 0,
            ordersCount: orderList.length,
            // Deep Analysis
            storePerformance: {} as Record<string, StorePerf>,
            paymentStats: {} as Record<string, PaymentPerf>,
        };

        orderList.forEach(o => {
            const price = Math.round(Number(o.priceInMRU || 0));
            const comm = Math.round(Number(o.commission || 0));
            const ship = Math.round(Number(o.shippingCost || 0));
            const del = Math.round(Number(o.localDeliveryCost || 0));
            const paid = Math.round(Number(o.amountPaid || 0));

            const orderTotal = price + comm + ship + del;
            
            stats.grossRevenue += orderTotal;
            stats.commission += comm;
            stats.shippingFees += ship;
            stats.deliveryFees += del;
            stats.totalCollected += paid;

            if (orderTotal > paid) stats.totalDebt += (orderTotal - paid);

            // Transaction Fee Logic
            const fee = calculateFeeForOrder(o, paymentMethods);
            stats.financialFees += fee;

            // Store Analytics
            if (o.storeId) {
                if (!stats.storePerformance[o.storeId]) {
                    const storeName = stores.find(s => s.id === o.storeId)?.name || 'Unknown';
                    stats.storePerformance[o.storeId] = { revenue: 0, profit: 0, count: 0, name: storeName };
                }
                stats.storePerformance[o.storeId].revenue += orderTotal;
                // Store profit also adjusted to be (Commission - Fee)
                stats.storePerformance[o.storeId].profit += (comm - fee); 
                stats.storePerformance[o.storeId].count += 1;
            }

            // Payment Analytics
            const rawMethod = o.paymentMethod || 'Cash';
            const normalizedRaw = normalizeText(rawMethod);
            const matchedMethod = paymentMethods.find(m => normalizeText(m.name) === normalizedRaw);
            const displayMethodName = matchedMethod ? matchedMethod.name : rawMethod;

            if (!stats.paymentStats[displayMethodName]) {
                stats.paymentStats[displayMethodName] = { amount: 0, fees: 0, count: 0 };
            }
            stats.paymentStats[displayMethodName].amount += paid;
            stats.paymentStats[displayMethodName].fees += fee;
            stats.paymentStats[displayMethodName].count += (paid > 0 ? 1 : 0);
        });

        // Net Profit = Sum(Commission) - Sum(Financial Fees)
        stats.netProfit = stats.commission - stats.financialFees;

        return stats;
    };

    const currentStats = useMemo(() => calculateMetrics(currentOrders), [currentOrders, paymentMethods, stores]);
    const prevStats = useMemo(() => calculateMetrics(prevOrders), [prevOrders, paymentMethods, stores]);

    const aov = currentStats.ordersCount > 0 ? Math.round(currentStats.grossRevenue / currentStats.ordersCount) : 0;
    const prevAov = prevStats.ordersCount > 0 ? Math.round(prevStats.grossRevenue / prevStats.ordersCount) : 0;

    const margin = currentStats.grossRevenue > 0 ? ((currentStats.netProfit / currentStats.grossRevenue) * 100).toFixed(1) : "0";
    const prevMargin = prevStats.grossRevenue > 0 ? ((prevStats.netProfit / prevStats.grossRevenue) * 100).toFixed(1) : "0";

    const trendData = useMemo(() => {
        const grouped: Record<string, { date: string, revenue: number, profit: number }> = {};
        
        currentOrders.forEach(o => {
            const d = new Date(o.orderDate);
            let dateKey = '';

            if (dateFilter === 'year') {
                // For Yearly view, aggregate by Month Name
                dateKey = d.toLocaleDateString('ar-EG', { month: 'long' });
            } else if (dateFilter === 'week') {
                // For Weekly view, aggregate by Day Name
                dateKey = d.toLocaleDateString('ar-EG', { weekday: 'long' });
            } else {
                // For Monthly/Custom view, aggregate by Date
                dateKey = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }

            if (!grouped[dateKey]) grouped[dateKey] = { date: dateKey, revenue: 0, profit: 0 };
            
            const comm = Math.round(Number(o.commission || 0));
            const ship = Math.round(Number(o.shippingCost || 0));
            const del = Math.round(Number(o.localDeliveryCost || 0));
            const fee = calculateFeeForOrder(o, paymentMethods);

            grouped[dateKey].revenue += (Math.round(Number(o.priceInMRU || 0)) + comm + ship + del);
            // Profit is strictly Commission - Fee
            grouped[dateKey].profit += (comm - fee);
        });

        // The orders are sorted Newest to Oldest in currentOrders.
        // grouped keys inserted in order of appearance (Newest first).
        // To show chart Left->Right (Old->New), we need to reverse the values.
        return Object.values(grouped).reverse();
    }, [currentOrders, paymentMethods, dateFilter]);

    const topStoresData = useMemo(() => {
        return (Object.values(currentStats.storePerformance) as StorePerf[])
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);
    }, [currentStats]);

    const paymentChartData = useMemo(() => {
        return Object.entries(currentStats.paymentStats).map(([name, data]) => {
            const perf = data as PaymentPerf;
            return {
                name,
                value: perf.amount,
                fees: perf.fees
            };
        }).sort((a, b) => b.value - a.value);
    }, [currentStats]);

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    const handleExport = () => {
        const data = currentOrders.map(o => {
            const paid = Math.round(Number(o.amountPaid || 0));
            const fee = calculateFeeForOrder(o, paymentMethods);
            const comm = Math.round(Number(o.commission || 0));

            return {
                "رقم الطلب": o.localOrderId,
                "التاريخ": o.orderDate,
                "المتجر": stores.find(s => s.id === o.storeId)?.name || 'N/A',
                "طريقة الدفع": o.paymentMethod || 'نقدي',
                "الخصم المالي (الرسوم)": fee.toFixed(2),
                "صافي الربح": comm - fee, // Added to Export
                "قيمة المنتج": Math.round(Number(o.priceInMRU || 0)),
                "العمولة": comm,
                "الشحن": Math.round(Number(o.shippingCost || 0)),
                "التوصيل": Math.round(Number(o.localDeliveryCost || 0)),
                "الإجمالي": Math.round(Number(o.priceInMRU || 0) + Number(o.commission || 0) + Number(o.shippingCost || 0) + Number(o.localDeliveryCost || 0)),
                "المدفوع": paid,
                "الرصيد": Math.max(0, Math.round(Number(o.priceInMRU || 0) + Number(o.commission || 0) + Number(o.shippingCost || 0) + Number(o.localDeliveryCost || 0) - Number(o.amountPaid || 0)))
            }
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Finance_Report");
        XLSX.writeFile(wb, `Finance_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header & Filter Bar */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                        <Activity className="text-primary" size={32} />
                        الإدارة المالية والمحاسبة
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 font-medium">نظام محاسبي متكامل لحساب الأرباح، خصم رسوم التحويلات، والتدفقات النقدية.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border dark:border-gray-700">
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm border dark:border-gray-700">
                        {(['week', 'month', 'year', 'custom'] as const).map(mode => (
                            <button 
                                key={mode} 
                                onClick={() => setDateFilter(mode)}
                                className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${dateFilter === mode ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                            >
                                {mode === 'week' ? 'أسبوعي' : mode === 'month' ? 'شهري' : mode === 'year' ? 'سنوي' : 'مخصص'}
                            </button>
                        ))}
                    </div>

                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 mx-1"></div>

                    {dateFilter === 'month' && <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm font-bold outline-none focus:ring-2 focus:ring-primary"/>}
                    {dateFilter === 'year' && (
                        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm font-bold w-32 outline-none focus:ring-2 focus:ring-primary">
                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                    {dateFilter === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary"/>
                            <span className="text-gray-400 font-bold">-</span>
                            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary"/>
                        </div>
                    )}
                    {dateFilter === 'week' && (
                        <div className="flex items-center gap-2 px-2 text-sm font-bold text-gray-500">
                            <Calendar size={16}/> <span>الأيام السبعة الماضية</span>
                        </div>
                    )}

                    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95 text-sm ml-2">
                        <Download size={18}/> تصدير
                    </button>
                </div>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard 
                    title="صافي الربح" 
                    value={currentStats.netProfit} 
                    previousValue={prevStats.netProfit} 
                    icon={TrendingUp} 
                    color="emerald" 
                    subtitle="العمولات - الرسوم"
                />
                <StatCard 
                    title="إجمالي الرسوم (خصومات)" 
                    value={currentStats.financialFees} 
                    previousValue={prevStats.financialFees} 
                    icon={AlertCircle} 
                    color="rose" 
                    subtitle="عمولات التطبيقات والبنك"
                />
                <StatCard 
                    title="هامش الربح" 
                    value={parseFloat(margin)} 
                    previousValue={parseFloat(prevMargin)} 
                    icon={Calculator} 
                    color="violet" 
                    subtitle="نسبة الربح من الدخل"
                    isCurrency={false}
                    suffix="%"
                />
                <StatCard 
                    title="متوسط قيمة الطلب (AOV)" 
                    value={aov} 
                    previousValue={prevAov} 
                    icon={ShoppingCart} 
                    color="amber" 
                    subtitle="متوسط السلة"
                />
                <StatCard 
                    title="السيولة المستلمة" 
                    value={currentStats.totalCollected} 
                    previousValue={prevStats.totalCollected} 
                    icon={Wallet} 
                    color="cyan" 
                    subtitle="كاش + تحويلات"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Main Trend Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                            <Layers className="text-indigo-500"/> تحليل الأداء المالي (قبل وبعد الرسوم)
                        </h3>
                        <div className="flex gap-4 text-xs font-bold">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-indigo-500"></div> التدفق الكلي</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-400"></div> صافي الربح</span>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#1f2937', borderRadius: '12px', border: 'none', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'}} 
                                    itemStyle={{color: '#fff'}}
                                    formatter={(value: number, name: string) => [value.toLocaleString(), name === 'revenue' ? 'التدفق' : 'الربح الصافي']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                <Area type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Stores Performance */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <StoreIcon className="text-amber-500"/> أفضل المتاجر (إيرادات)
                    </h3>
                    <div className="flex-grow">
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={topStoresData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1}/>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{borderRadius: '12px', background: '#1f2937', border: 'none', color: '#fff'}}
                                />
                                <Bar dataKey="revenue" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20} name="الإيراد" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Breakdown Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 3. Payment Methods Analysis */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <CreditCard className="text-blue-500"/> تحليل رسوم وسائل الدفع
                    </h3>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-full md:w-1/2 h-64 relative">
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="text-xs text-gray-400">إجمالي الرسوم</span>
                                <span className="text-xl font-black text-red-500">{Math.round(currentStats.financialFees).toLocaleString()}</span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={paymentChartData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value" 
                                        stroke="none"
                                    >
                                        {paymentChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{borderRadius: '12px', background: '#1f2937', border: 'none', color: '#fff'}} />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/2 space-y-3">
                            {paymentChartData.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                                        <div>
                                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 block">{item.name}</span>
                                            <span className="text-[10px] text-gray-400">{((item.value / currentStats.totalCollected) * 100).toFixed(1)}% من السيولة</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-sm font-mono font-bold">{item.value.toLocaleString()}</span>
                                        {item.fees > 0 && <span className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-900/30 px-1.5 rounded">خصم: {Math.round(item.fees)}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4. Profit Composition */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <PieChart className="text-emerald-500"/> مصادر الدخل وتوزيع الأرباح
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-300"><DollarSign size={20}/></div>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-white">العمولات</p>
                                    <p className="text-xs text-gray-500">من قيمة المنتجات</p>
                                </div>
                            </div>
                            <span className="text-xl font-mono font-bold text-emerald-600">{currentStats.commission.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-300"><Truck size={20}/></div>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-white">عائد الشحن</p>
                                    <p className="text-xs text-gray-500">شحن جوي/بحري</p>
                                </div>
                            </div>
                            <span className="text-xl font-mono font-bold text-blue-600">{currentStats.shippingFees.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg text-purple-600 dark:text-purple-300"><Wallet size={20}/></div>
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-white">التوصيل والوكالة</p>
                                    <p className="text-xs text-gray-500">خدمات محلية</p>
                                </div>
                            </div>
                            <span className="text-xl font-mono font-bold text-purple-600">{currentStats.deliveryFees.toLocaleString()}</span>
                        </div>

                        <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/50">
                            <span className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                                <AlertCircle size={16}/> يُخصم: رسوم التحويلات
                            </span>
                            <span className="text-xl font-mono font-black text-red-600 dark:text-red-400">-{currentStats.financialFees.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Ledger (Table) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <Banknote className="text-gray-500"/> سجل العمليات التفصيلي (شامل الخصومات)
                    </h3>
                    <div className="text-xs font-mono text-gray-400">Showing {currentOrders.length} records</div>
                </div>
                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 font-bold border-b dark:border-gray-600 sticky top-0 z-10">
                            <tr>
                                <th className="p-4">رقم الطلب</th>
                                <th className="p-4 text-center">التاريخ</th>
                                <th className="p-4 text-center">المتجر</th>
                                <th className="p-4 text-center">طريقة الدفع</th>
                                <th className="p-4 text-emerald-600">إجمالي الدخل</th>
                                <th className="p-4 text-red-500">الخصم المالي</th>
                                <th className="p-4 font-black">صافي الربح</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {currentOrders.length > 0 ? currentOrders.map(order => {
                                const grossIncome = Math.round(Number(order.commission || 0) + Number(order.shippingCost || 0) + Number(order.localDeliveryCost || 0));
                                const comm = Math.round(Number(order.commission || 0));
                                
                                const feeAmount = calculateFeeForOrder(order, paymentMethods);
                                // Updated Net Profit Calculation
                                const netProfit = comm - feeAmount;
                                const storeName = stores.find(s => s.id === order.storeId)?.name || 'N/A';

                                return (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="p-4 font-mono font-bold text-primary">{order.localOrderId}</td>
                                        <td className="p-4 text-center text-xs text-gray-500 font-mono">{new Date(order.orderDate).toLocaleDateString('en-GB')}</td>
                                        <td className="p-4 text-center text-xs font-bold text-gray-600 dark:text-gray-300">{storeName}</td>
                                        <td className="p-4 text-center">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                                                {order.paymentMethod || 'نقدي'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono font-bold text-emerald-600">{grossIncome.toLocaleString()}</td>
                                        <td className="p-4 font-mono text-red-500">
                                            {feeAmount > 0 ? `- ${Math.round(feeAmount).toLocaleString()}` : '0'}
                                        </td>
                                        <td className="p-4 font-mono font-black text-gray-800 dark:text-white">
                                            {Math.round(netProfit).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                        <Filter size={48} className="mb-2 opacity-20"/>
                                        <p>لا توجد بيانات مالية للفترة المحددة</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinancePage;


import React, { useState, useMemo, useContext } from 'react';
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
import { AuthContext } from '../contexts/AuthContext';
import PasswordConfirmationModal from './PasswordConfirmationModal';

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
    const { currentUser } = useContext(AuthContext);
    const isAdmin = currentUser?.role === 'admin';

    // --- State ---
    const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'year' | 'custom'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    // Secure Export
    const [showExportVerify, setShowExportVerify] = useState(false);

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

    // --- REVISED TREND DATA CALCULATION ---
    // Pre-fill keys to ensure the graph renders even if there are no orders in a specific period
    const trendData = useMemo(() => {
        const map = new Map<string, { date: string, rawDate: string, revenue: number, profit: number }>();

        // Helper to format key YYYY-MM-DD in local time
        const getLocalKey = (date: Date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        // 1. Initialize Map Buckets based on Filter
        if (dateFilter === 'year') {
            // Generate all 12 months for the selected year
            for (let i = 0; i < 12; i++) {
                const d = new Date(parseInt(selectedYear), i, 1);
                // Key format: YYYY-MM
                const key = `${d.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                // Label format: Short Month Name (e.g., Jan, Feb)
                const label = d.toLocaleDateString('ar-EG', { month: 'short' }); 
                map.set(key, {
                    date: label,
                    rawDate: key,
                    revenue: 0,
                    profit: 0
                });
            }
        } else if (dateFilter === 'month') {
            // Generate days for the selected month
            const [y, m] = selectedMonth.split('-');
            const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(parseInt(y), parseInt(m) - 1, i);
                const key = getLocalKey(d);
                const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                map.set(key, {
                    date: label,
                    rawDate: key,
                    revenue: 0,
                    profit: 0
                });
            }
        } else if (dateFilter === 'week') {
             // Generate last 7 days
             const curr = new Date(dateRanges.currentStart);
             // Safety break loop
             let safety = 0;
             while (curr <= dateRanges.currentEnd && safety < 10) {
                 const key = getLocalKey(curr);
                 const label = curr.toLocaleDateString('ar-EG', { weekday: 'long' });
                 map.set(key, {
                     date: label,
                     rawDate: key,
                     revenue: 0,
                     profit: 0
                 });
                 curr.setDate(curr.getDate() + 1);
                 safety++;
             }
        }

        // 2. Fill Data from Current Orders
        currentOrders.forEach(o => {
            const d = new Date(o.orderDate);
            let key = '';

            if (dateFilter === 'year') {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            } else {
                key = getLocalKey(d);
            }

            // Handle Custom Range (Populate sparsely if not pre-filled)
            if (dateFilter === 'custom' && !map.has(key)) {
                 map.set(key, { 
                     date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), 
                     rawDate: key,
                     revenue: 0, 
                     profit: 0 
                 });
            }

            if (map.has(key)) {
                const entry = map.get(key)!;
                const comm = Math.round(Number(o.commission || 0));
                const ship = Math.round(Number(o.shippingCost || 0));
                const del = Math.round(Number(o.localDeliveryCost || 0));
                const fee = calculateFeeForOrder(o, paymentMethods);

                entry.revenue += (Math.round(Number(o.priceInMRU || 0)) + comm + ship + del);
                // Profit is strictly Commission - Fee
                entry.profit += (comm - fee);
            }
        });

        // 3. Convert Map to Array and Sort Chronologically
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(e => e[1]);

    }, [currentOrders, paymentMethods, dateFilter, selectedYear, selectedMonth, dateRanges]);

    const topStoresData = useMemo(() => {
        return (Object.values(currentStats.storePerformance) as StorePerf[])
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);
    }, [currentStats]);

    const paymentChartData = useMemo(() => {
        const data = Object.entries(currentStats.paymentStats).map(([name, data]) => {
            const perf = data as PaymentPerf;
            return {
                name,
                value: perf.amount,
                fees: perf.fees
            };
        }).sort((a, b) => b.value - a.value);
        
        // Ensure at least one data point for Pie Chart to render empty state correctly
        if (data.length === 0) return [{ name: 'لا توجد بيانات', value: 100, fees: 0, isEmpty: true }];
        return data;
    }, [currentStats]);

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    const handleExportConfirm = async () => {
        const data = currentOrders.map(o => {
            const paid = Number(o.amountPaid || 0);
            const total = (Number(o.priceInMRU || 0)) + (Number(o.commission || 0)) + (Number(o.shippingCost || 0));
            const fee = calculateFeeForOrder(o, paymentMethods);
            return {
                'Order ID': o.localOrderId,
                'Date': new Date(o.orderDate).toLocaleDateString(),
                'Total Value': total,
                'Paid': paid,
                'Commission': o.commission,
                'Transaction Fee': fee,
                'Net Profit': (Number(o.commission || 0)) - fee,
                'Method': o.paymentMethod || 'Cash'
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
        XLSX.writeFile(wb, `Finance_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
        setShowExportVerify(false);
    };

    return (
        <div className="space-y-6 pb-20">
            <PasswordConfirmationModal 
                isOpen={showExportVerify} 
                onClose={() => setShowExportVerify(false)} 
                onConfirm={async () => handleExportConfirm()}
                title="تصدير التقرير المالي"
                message="يرجى تأكيد هويتك لتصدير البيانات المالية الحساسة."
                verificationMode="online"
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <Activity className="text-primary"/> التحليل المالي والتقارير
                </h2>
                <div className="flex gap-2">
                    {isAdmin && (
                        <button 
                            onClick={() => setShowExportVerify(true)} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg"
                        >
                            <Download size={18}/> تصدير التقرير
                        </button>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-center">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                    <button onClick={() => setDateFilter('week')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'week' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}>أسبوعي</button>
                    <button onClick={() => setDateFilter('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'month' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}>شهري</button>
                    <button onClick={() => setDateFilter('year')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'year' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}>سنوي</button>
                    <button onClick={() => setDateFilter('custom')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${dateFilter === 'custom' ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}>مخصص</button>
                </div>

                {dateFilter === 'month' && (
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold text-sm" />
                )}
                {dateFilter === 'year' && (
                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="p-2 border rounded-xl dark:bg-gray-700 dark:border-gray-600 font-bold text-sm">
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                )}
                {dateFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="p-2 border rounded-xl text-sm" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="p-2 border rounded-xl text-sm" />
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="صافي الأرباح" 
                    value={currentStats.netProfit} 
                    previousValue={prevStats.netProfit} 
                    icon={TrendingUp} 
                    color="emerald" 
                    subtitle={`${margin}% هامش ربح`} 
                />
                <StatCard 
                    title="إجمالي الدخل" 
                    value={currentStats.grossRevenue} 
                    previousValue={prevStats.grossRevenue} 
                    icon={DollarSign} 
                    color="blue" 
                    subtitle={`${currentStats.ordersCount} طلب`} 
                />
                <StatCard 
                    title="متوسط قيمة الطلب" 
                    value={aov} 
                    previousValue={prevAov} 
                    icon={ShoppingCart} 
                    color="violet" 
                    subtitle="AOV" 
                />
                <StatCard 
                    title="رسوم المعاملات" 
                    value={currentStats.financialFees} 
                    previousValue={prevStats.financialFees} 
                    icon={Banknote} 
                    color="rose" 
                    subtitle="تكاليف بوابات الدفع" 
                />
            </div>

            {/* Main Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <BarChart3 className="text-primary"/> الأداء المالي (إيرادات vs أرباح)
                    </h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5}/>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => value.toLocaleString()}
                                />
                                <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                <Area type="monotone" dataKey="profit" name="الأرباح" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
                                <Legend wrapperStyle={{paddingTop: '20px'}}/>
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <CreditCard className="text-purple-500"/> قنوات الدفع
                    </h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={paymentChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {paymentChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.isEmpty ? '#e5e7eb' : COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: number) => val.toLocaleString() + ' MRU'} />
                            </RePieChart>
                        </ResponsiveContainer>
                        {/* Centered Total */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-gray-400 font-bold uppercase">إجمالي المحصل</span>
                            <span className="text-lg font-black text-gray-800 dark:text-white">{currentStats.totalCollected.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {paymentChartData.filter(d => !d.isEmpty).map((entry, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                    <span className="font-bold text-gray-600 dark:text-gray-300">{entry.name}</span>
                                </div>
                                <div className="flex gap-4">
                                    <span className="font-mono text-gray-800 dark:text-white">{entry.value.toLocaleString()}</span>
                                    {entry.fees > 0 && <span className="text-red-500 font-mono">-{entry.fees.toLocaleString()} (رسوم)</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Stores Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <StoreIcon className="text-orange-500"/> أداء المتاجر (الأعلى دخلاً)
                    </h3>
                    <div className="space-y-4">
                        {topStoresData.map((store, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-gray-800 dark:text-white">{store.name}</p>
                                        <p className="text-[10px] text-gray-500">{store.count} طلبات</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono font-black text-sm text-gray-800 dark:text-white">{store.revenue.toLocaleString()}</p>
                                    <p className="text-[10px] text-green-600 font-bold">+{store.profit.toLocaleString()} ربح</p>
                                </div>
                            </div>
                        ))}
                        {topStoresData.length === 0 && <p className="text-center text-gray-400 text-sm py-4">لا توجد بيانات متاجر</p>}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                        <Coins className="text-blue-500"/> تفاصيل الرسوم التشغيلية
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                            <span className="text-sm font-bold text-red-800 dark:text-red-300">رسوم المعاملات (بوابات الدفع)</span>
                            <span className="font-mono font-black text-red-600">{currentStats.financialFees.toLocaleString()} MRU</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <span className="text-sm font-bold text-blue-800 dark:text-blue-300">تكاليف الشحن الدولي</span>
                            <span className="font-mono font-black text-blue-600">{currentStats.shippingFees.toLocaleString()} MRU</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                            <span className="text-sm font-bold text-purple-800 dark:text-purple-300">تكاليف التوصيل المحلي</span>
                            <span className="font-mono font-black text-purple-600">{currentStats.deliveryFees.toLocaleString()} MRU</span>
                        </div>
                        <div className="mt-4 pt-4 border-t dark:border-gray-700">
                            <p className="text-xs text-gray-500 text-center">
                                * الأرباح الصافية يتم حسابها بعد خصم هذه التكاليف من العمولات المحصلة.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinancePage;

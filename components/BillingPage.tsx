
import React, { useState, useMemo } from 'react';
import type { Order, Client, Store, CompanyInfo, Currency, PaymentMethod } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { 
    Search, Printer, FileText, 
    AlertCircle, DollarSign, 
    Wallet, MessageCircle, Filter, PieChart, CheckCircle2, Clock, User, ChevronRight
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import InvoiceModal from './InvoiceModal';
import { supabase, getErrorMessage } from '../supabaseClient';

// --- Utility Functions for Invoice Generation & Sharing ---

export const generateInvoiceHTML = (
    title: string,
    order: Order,
    date: string,
    client: Client | { name: string; phone: string; address?: string },
    companyInfo: CompanyInfo,
    store: Store | { name: string },
    footerMessage: string,
    lang: 'ar' | 'en' | 'fr'
): string => {
    const isRtl = lang === 'ar';
    const direction = isRtl ? 'rtl' : 'ltr';
    const textAlign = isRtl ? 'right' : 'left';
    
    const productTotal = Math.round(Number(order.priceInMRU || 0) + Number(order.commission || 0));
    const shipping = Math.round(Number(order.shippingCost || 0));
    const delivery = Math.round(Number(order.localDeliveryCost || 0));
    const totalDue = productTotal + shipping + delivery;
    const paid = Number(order.amountPaid || 0);
    const remaining = totalDue - paid;

    return `
        <!DOCTYPE html>
        <html dir="${direction}" lang="${lang}">
        <head>
            <meta charset="UTF-8">
            <title>${title} - ${order.localOrderId}</title>
            <style>
                body { font-family: sans-serif; margin: 0; padding: 20px; color: #333; }
                .container { max-width: 800px; margin: 0 auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
                .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                .company-info h1 { margin: 0 0 5px; color: #1e3a8a; }
                .invoice-details { text-align: ${isRtl ? 'left' : 'right'}; }
                .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .client-info, .order-info { width: 48%; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background: #f8f9fa; padding: 12px; text-align: ${textAlign}; border-bottom: 2px solid #ddd; }
                td { padding: 12px; border-bottom: 1px solid #eee; }
                .totals { width: 300px; margin-${isRtl ? 'right' : 'left'}: auto; }
                .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
                .grand-total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
                .footer { text-align: center; margin-top: 50px; font-size: 0.9em; color: #666; }
                @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .container { border: none; box-shadow: none; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="company-info">
                        ${companyInfo.logo ? `<img src="${companyInfo.logo}" style="height: 60px; margin-bottom: 10px;" />` : ''}
                        <h1>${companyInfo.name}</h1>
                        <p>${companyInfo.address}<br>${companyInfo.phone}</p>
                    </div>
                    <div class="invoice-details">
                        <h2 style="margin: 0; color: #555;">${title}</h2>
                        <p style="font-family: monospace; font-size: 1.2em;">#${order.localOrderId}</p>
                        <p>${date}</p>
                    </div>
                </div>

                <div class="info-section">
                    <div class="client-info">
                        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">${isRtl ? 'العميل' : 'Bill To'}</h3>
                        <p><strong>${client.name}</strong><br>${client.phone}</p>
                    </div>
                    <div class="order-info">
                        <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">${isRtl ? 'تفاصيل الطلب' : 'Order Details'}</h3>
                        <p><strong>${isRtl ? 'المتجر' : 'Store'}:</strong> ${store.name}<br>
                        <strong>${isRtl ? 'الوزن' : 'Weight'}:</strong> ${order.weight || 0} kg</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>${isRtl ? 'الوصف' : 'Description'}</th>
                            <th>${isRtl ? 'الكمية' : 'Qty'}</th>
                            <th>${isRtl ? 'المبلغ' : 'Amount'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${isRtl ? 'قيمة المنتج + العمولة' : 'Product + Commission'}</td>
                            <td>${order.quantity}</td>
                            <td>${productTotal.toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td>${isRtl ? 'رسوم الشحن' : 'Shipping Fees'}</td>
                            <td>-</td>
                            <td>${shipping.toLocaleString()}</td>
                        </tr>
                        ${delivery > 0 ? `
                        <tr>
                            <td>${isRtl ? 'توصيل محلي' : 'Local Delivery'}</td>
                            <td>-</td>
                            <td>${delivery.toLocaleString()}</td>
                        </tr>` : ''}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">
                        <span>${isRtl ? 'الإجمالي' : 'Total'}:</span>
                        <span>${totalDue.toLocaleString()} MRU</span>
                    </div>
                    <div class="total-row" style="color: green;">
                        <span>${isRtl ? 'المدفوع' : 'Paid'}:</span>
                        <span>${paid.toLocaleString()} MRU</span>
                    </div>
                    <div class="total-row grand-total" style="color: ${remaining > 0 ? 'red' : 'green'};">
                        <span>${isRtl ? 'المتبقي' : 'Balance Due'}:</span>
                        <span>${remaining.toLocaleString()} MRU</span>
                    </div>
                </div>

                <div class="footer">
                    <p>${footerMessage}</p>
                    ${companyInfo.invoiceTerms ? `<p style="font-size: 0.8em; margin-top: 10px;">${companyInfo.invoiceTerms}</p>` : ''}
                </div>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;
};

// --- Main Component ---

interface BillingPageProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  clients: Client[];
  stores: Store[];
  currencies: Currency[];
  companyInfo: CompanyInfo;
  settings: any;
}

type PaymentFilter = 'all' | 'paid' | 'partial' | 'unpaid';

const BillingPage: React.FC<BillingPageProps> = ({ orders, setOrders, clients, stores, companyInfo, settings }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
    const { showToast } = useToast();
    const [printOrder, setPrintOrder] = useState<Order | null>(null);

    // 1. Filter Orders: Include everything that is NOT new or cancelled
    const relevantOrders = useMemo(() => {
        return orders.filter(o => 
            o.status !== OrderStatus.NEW && 
            o.status !== OrderStatus.CANCELLED
        ).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [orders]);

    // 2. Enhance Orders with Financial Status (Rounded)
    const enhancedOrders = useMemo(() => {
        return relevantOrders.map(order => {
            const productTotal = Math.round(Number(order.priceInMRU || 0) + Number(order.commission || 0));
            const shipping = Math.round(Number(order.shippingCost || 0));
            const delivery = Math.round(Number(order.localDeliveryCost || 0));
            
            // Correct Total Calculation
            const grandTotal = productTotal + shipping + delivery;
            const paid = Math.round(Number(order.amountPaid || 0));
            const remaining = grandTotal - paid;
            
            let paymentStatus: PaymentFilter = 'unpaid';
            if (remaining <= 0 && grandTotal > 0) paymentStatus = 'paid';
            else if (paid > 0 && remaining > 0) paymentStatus = 'partial';
            else paymentStatus = 'unpaid';

            return { ...order, grandTotal, paid, remaining, paymentStatus };
        });
    }, [relevantOrders]);

    // 3. Apply Filters (Search + Payment Tab)
    const filteredOrders = useMemo(() => {
        return enhancedOrders.filter(o => {
            const matchesSearch = 
                o.localOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                clients.find(c => c.id === o.clientId)?.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesTab = paymentFilter === 'all' || o.paymentStatus === paymentFilter;

            return matchesSearch && matchesTab;
        });
    }, [enhancedOrders, searchTerm, paymentFilter, clients]);

    // 4. Calculate Stats (Based on ALL relevant orders, not just filtered view for accuracy)
    const stats = useMemo(() => {
        return enhancedOrders.reduce((acc, curr) => {
            acc.totalRevenue += curr.grandTotal;
            acc.totalCollected += curr.paid;
            acc.totalOutstanding += Math.max(0, curr.remaining);
            if (curr.paymentStatus === 'paid') acc.countPaid++;
            else if (curr.paymentStatus === 'partial') acc.countPartial++;
            else acc.countUnpaid++;
            return acc;
        }, { totalRevenue: 0, totalCollected: 0, totalOutstanding: 0, countPaid: 0, countPartial: 0, countUnpaid: 0 });
    }, [enhancedOrders]);

    const collectionRate = stats.totalRevenue > 0 
        ? Math.round((stats.totalCollected / stats.totalRevenue) * 100) 
        : 0;

    const handleInvoiceSuccess = async () => {
        if (!printOrder || !supabase) return;
        try {
            await supabase.from('Orders').update({ is_invoice_printed: true }).eq('id', printOrder.id);
            setOrders(prev => prev.map(o => o.id === printOrder.id ? { ...o, isInvoicePrinted: true } : o));
            showToast('تم تحديث حالة الفاتورة (مرسلة)', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    return (
        <div className="space-y-6">
            {printOrder && (
                <InvoiceModal 
                    isOpen={!!printOrder}
                    onClose={() => setPrintOrder(null)}
                    order={printOrder}
                    client={clients.find(c => c.id === printOrder.clientId) || { id: '', name: 'Unknown', phone: '' }}
                    store={stores.find(s => s.id === printOrder.storeId) || { id: '', name: '', estimatedDeliveryDays: 0 }}
                    companyInfo={companyInfo}
                    onSuccess={handleInvoiceSuccess}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">الفوترة والتقارير المالية</h2>
                <div className="text-sm font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    {enhancedOrders.length} فاتورة نشطة
                </div>
            </div>

            {/* Smart Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">إجمالي المستحقات</span>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={18}/></div>
                    </div>
                    <p className="text-2xl font-black font-mono text-gray-800 dark:text-white">{stats.totalRevenue.toLocaleString()}</p>
                    <span className="text-xs text-gray-400">القيمة الكلية للفواتير</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">المحصل الفعلي</span>
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Wallet size={18}/></div>
                    </div>
                    <p className="text-2xl font-black font-mono text-green-600">{stats.totalCollected.toLocaleString()}</p>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-green-500 h-full" style={{width: `${collectionRate}%`}}></div>
                    </div>
                    <span className="text-[10px] text-green-600 font-bold mt-1 block">{collectionRate}% نسبة التحصيل</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">الديون المتبقية</span>
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertCircle size={18}/></div>
                    </div>
                    <p className="text-2xl font-black font-mono text-red-600">{stats.totalOutstanding.toLocaleString()}</p>
                    <span className="text-xs text-gray-400">مبالغ لم يتم سدادها بعد</span>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-500 text-xs font-bold uppercase">توزيع الفواتير</span>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><PieChart size={18}/></div>
                    </div>
                    <div className="flex justify-between text-xs font-semibold mt-2">
                        <span className="text-green-600">{stats.countPaid} مكتمل</span>
                        <span className="text-orange-500">{stats.countPartial} جزئي</span>
                        <span className="text-red-500">{stats.countUnpaid} غير مدفوع</span>
                    </div>
                </div>
            </div>

            {/* Filters & Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                
                {/* Controls */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-gray-900/20">
                    <div className="flex gap-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-xl w-full lg:w-auto overflow-x-auto custom-scrollbar">
                        {(['all', 'paid', 'partial', 'unpaid'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setPaymentFilter(filter)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                                    paymentFilter === filter 
                                    ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' 
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                {filter === 'all' && 'الكل'}
                                {filter === 'paid' && 'مدفوع كلياً'}
                                {filter === 'partial' && 'جزئي'}
                                {filter === 'unpaid' && 'غير مدفوع'}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full lg:w-80">
                        <input 
                            type="text" 
                            placeholder="بحث برقم الفاتورة أو العميل..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border-none rounded-xl bg-white dark:bg-gray-700 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600 focus:ring-2 focus:ring-primary text-gray-700 dark:text-gray-200"
                        />
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                </div>
                
                {/* Table - Desktop */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-bold border-b dark:border-gray-700">
                            <tr>
                                <th className="p-4 text-right">رقم الطلب</th>
                                <th className="p-4 text-right">العميل</th>
                                <th className="p-4 text-center">حالة الطلب</th>
                                <th className="p-4 text-center">حالة الدفع</th>
                                <th className="p-4 text-right">الإجمالي</th>
                                <th className="p-4 text-right">المدفوع</th>
                                <th className="p-4 text-right">المتبقي</th>
                                <th className="p-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredOrders.length > 0 ? filteredOrders.map(order => {
                                const client = clients.find(c => c.id === order.clientId);
                                const progress = Math.min(100, (order.paid / order.grandTotal) * 100);
                                const method = (settings.paymentMethods as PaymentMethod[])?.find(m => m.name === order.paymentMethod);
                                
                                let statusBadgeClass = '';
                                let statusText = '';
                                switch(order.status) {
                                    case OrderStatus.ORDERED: statusBadgeClass = 'bg-purple-100 text-purple-700'; statusText = 'تم الطلب'; break;
                                    case OrderStatus.SHIPPED_FROM_STORE: statusBadgeClass = 'bg-indigo-100 text-indigo-700'; statusText = 'تم الشحن'; break;
                                    case OrderStatus.ARRIVED_AT_OFFICE: statusBadgeClass = 'bg-pink-100 text-pink-700'; statusText = 'وصل المكتب'; break;
                                    case OrderStatus.STORED: statusBadgeClass = 'bg-blue-100 text-blue-700'; statusText = 'بالمخزن'; break;
                                    case OrderStatus.COMPLETED: statusBadgeClass = 'bg-green-100 text-green-700'; statusText = 'مكتمل'; break;
                                    default: statusBadgeClass = 'bg-gray-100 text-gray-700'; statusText = 'قيد المعالجة';
                                }

                                return (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="p-4 text-right">
                                            <span className="font-mono font-bold text-base text-primary block">{order.localOrderId}</span>
                                            <span className="text-xs text-gray-400 font-mono">{new Date(order.orderDate).toLocaleDateString()}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-bold text-gray-700 dark:text-gray-200 block">{client?.name || '---'}</span>
                                            <span className="text-xs text-gray-400 font-mono">{client?.phone}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${statusBadgeClass}`}>{statusText}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-center gap-1">
                                                {order.paymentStatus === 'paid' && <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> مدفوع</span>}
                                                {order.paymentStatus === 'partial' && <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><Clock size={12}/> جزئي</span>}
                                                {order.paymentStatus === 'unpaid' && <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle size={12}/> غير مدفوع</span>}
                                                
                                                {/* Payment Method with Logo */}
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                    {method?.logo && <img src={method.logo} className="w-3 h-3 object-contain" alt=""/>}
                                                    <span>{order.paymentMethod || 'نقدي'}</span>
                                                </div>

                                                <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                                                    <div className={`h-full ${order.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-orange-400'}`} style={{width: `${progress}%`}}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold">{Math.round(order.grandTotal).toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-green-600">{Math.round(order.paid).toLocaleString()}</td>
                                        <td className={`p-4 text-right font-mono font-bold ${order.remaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {Math.round(order.remaining).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => setPrintOrder(order)}
                                                    className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                                                    title="طباعة"
                                                >
                                                    <Printer size={16}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="p-10 text-center text-gray-400">
                                        <FileText size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p>لا توجد فواتير مطابقة للبحث</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Cards - Mobile View */}
                <div className="md:hidden bg-gray-50 dark:bg-black/10 p-4 space-y-4">
                    {filteredOrders.length > 0 ? filteredOrders.map(order => {
                        const client = clients.find(c => c.id === order.clientId);
                        const method = (settings.paymentMethods as PaymentMethod[])?.find(m => m.name === order.paymentMethod);
                        const progress = Math.min(100, (order.paid / order.grandTotal) * 100);

                        return (
                            <div key={order.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                                {/* Header: ID & Status */}
                                <div className="flex justify-between items-center pb-3 border-b dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-lg text-primary">{order.localOrderId}</span>
                                        <span className="text-xs text-gray-400">{new Date(order.orderDate).toLocaleDateString()}</span>
                                    </div>
                                    <button 
                                        onClick={() => setPrintOrder(order)}
                                        className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"
                                    >
                                        <Printer size={18}/>
                                    </button>
                                </div>

                                {/* Client Info */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                                        <User size={20}/>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{client?.name || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500 font-mono">{client?.phone}</p>
                                    </div>
                                </div>

                                {/* Financials Grid */}
                                <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl">
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-400 uppercase">الإجمالي</p>
                                        <p className="font-bold text-sm font-mono">{Math.round(order.grandTotal).toLocaleString()}</p>
                                    </div>
                                    <div className="text-center border-x dark:border-gray-700">
                                        <p className="text-[10px] text-gray-400 uppercase">المدفوع</p>
                                        <p className="font-bold text-sm font-mono text-green-600">{Math.round(order.paid).toLocaleString()}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-gray-400 uppercase">المتبقي</p>
                                        <p className={`font-bold text-sm font-mono ${order.remaining > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {Math.round(order.remaining).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer: Payment Method & Progress */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                                        {method?.logo ? <img src={method.logo} className="w-4 h-4 object-contain"/> : <Wallet size={14}/>}
                                        <span>{order.paymentMethod || 'نقدي'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div className={`h-full ${order.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-orange-400'}`} style={{width: `${progress}%`}}></div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400">{Math.round(progress)}%</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-10 text-gray-400">
                            <FileText size={48} className="mx-auto mb-2 opacity-20"/>
                            <p>لا توجد فواتير</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BillingPage;

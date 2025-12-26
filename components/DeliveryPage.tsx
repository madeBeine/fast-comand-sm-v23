
import React, { useState, useMemo, useContext, useEffect } from 'react';
import type { Order, Client, Store, CompanyInfo, AppSettings, City, PaymentMethod } from '../types';
import { OrderStatus } from '../types';
import { 
    Search, Upload, Check, Loader2, Store as StoreIcon, 
    CheckCircle2, ChevronLeft, X, 
    DollarSign, MapPin, Calculator, Bus, 
    Package, ArrowUp, Layers, AlertCircle, Wallet, ArrowDown, ChevronDown
} from 'lucide-react';
import { supabase, getErrorMessage } from '../supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { STATUS_DETAILS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface DeliveryPageProps {
  orders: Order[];
  clients: Client[];
  stores: Store[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  companyInfo: CompanyInfo;
  settings: AppSettings;
  cities?: City[];
  paymentMethods: PaymentMethod[];
}

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (event) => {
            if (!event.target?.result) return reject("Failed to read file");
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1000;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject("Canvas error");
                
                // FIX: Fill white background to prevent black transparent areas on Mobile/Android
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
        reader.onerror = (err) => reject(err);
    });
};

const DeliveryPage: React.FC<DeliveryPageProps> = ({ orders, clients, stores, setOrders, settings, cities = [], paymentMethods }) => {
  const { currentUser } = useContext(AuthContext);
  const { t } = useLanguage();
  const { showToast } = useToast();
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [receiptImages, setReceiptImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  
  // Mobile UX State
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);
  
  // Financial Configuration
  const [enableTripFee, setEnableTripFee] = useState(false);
  const [tripFeeCost, setTripFeeCost] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  
  // NEW: Payment Input
  const [paymentInput, setPaymentInput] = useState<number | ''>('');

  // Initial Payment Method Selection
  useEffect(() => {
      if (paymentMethods.length > 0 && !paymentMethod) {
          setPaymentMethod(paymentMethods[0].name);
      } else if (!paymentMethod) {
          setPaymentMethod('Cash'); // Fallback default
      }
  }, [paymentMethods, paymentMethod]);

  // --- 1. Client Search & List Logic ---
  const activeClients = useMemo(() => {
      const lowerTerm = searchTerm.toLowerCase().trim();
      const activeOrders = orders.filter(o => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.NEW && o.status !== OrderStatus.COMPLETED);
      
      const clientMap = new Map<string, { ready: number, total: number }>();
      
      activeOrders.forEach(o => {
          const current = clientMap.get(o.clientId) || { ready: 0, total: 0 };
          current.total += 1;
          if (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) {
              current.ready += 1;
          }
          clientMap.set(o.clientId, current);
      });

      return clients
          .filter(c => {
              const stats = clientMap.get(c.id);
              if (!stats && !lowerTerm) return false;
              const matchesName = c.name.toLowerCase().includes(lowerTerm);
              const matchesPhone = c.phone.includes(lowerTerm);
              return matchesName || matchesPhone;
          })
          .map(c => ({
              ...c,
              stats: clientMap.get(c.id) || { ready: 0, total: 0 }
          }))
          .sort((a, b) => b.stats.ready - a.stats.ready);
  }, [orders, clients, searchTerm]);

  // --- 2. Order Selection Logic ---
  const clientOrders = useMemo(() => {
      if (!selectedClient) return [];
      return orders
          .filter(o => o.clientId === selectedClient.id && o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.NEW && o.status !== OrderStatus.COMPLETED)
          .sort((a, b) => {
              const aReady = a.status === OrderStatus.STORED || a.status === OrderStatus.ARRIVED_AT_OFFICE;
              const bReady = b.status === OrderStatus.STORED || b.status === OrderStatus.ARRIVED_AT_OFFICE;
              if (aReady && !bReady) return -1;
              if (!aReady && bReady) return 1;
              return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
          });
  }, [selectedClient, orders]);

  // Reset/Init when client changes
  useEffect(() => {
      if (selectedClient && selectedClient.cityId) {
          const city = cities.find(c => c.id === selectedClient.cityId);
          if (city) {
              if (city.isLocal) {
                  setEnableTripFee(false);
                  setTripFeeCost(100);
              } else {
                  setEnableTripFee(true);
                  setTripFeeCost(city.deliveryCost || 0);
              }
          } else {
              setEnableTripFee(false);
              setTripFeeCost(0);
          }
      } else {
          setEnableTripFee(false);
          setTripFeeCost(0);
      }
      setSelectedOrderIds(new Set());
      setReceiptImages([]);
      setPaymentInput(''); // Reset payment input
      setIsMobileCheckoutOpen(false); 
  }, [selectedClient, cities]);

  const toggleOrder = (id: string) => {
      const newSet = new Set(selectedOrderIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedOrderIds(newSet);
  };

  const selectAllReady = () => {
      const readyIds = clientOrders
          .filter(o => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE)
          .map(o => o.id);
      
      if (selectedOrderIds.size === readyIds.length && readyIds.length > 0) {
          setSelectedOrderIds(new Set());
      } else {
          setSelectedOrderIds(new Set(readyIds));
      }
  };

  // --- 3. Financial Calculation Engine ---
  const batchTotals = useMemo(() => {
      const selected = clientOrders.filter(o => selectedOrderIds.has(o.id));
      
      let totalProduct = 0;
      let totalShipping = 0;
      let totalOldFees = 0;
      let totalPaidPreviously = 0;

      selected.forEach(o => {
          totalProduct += (Number(o.priceInMRU) || 0) + (Number(o.commission) || 0);
          totalShipping += (Number(o.shippingCost) || 0);
          totalOldFees += (Number(o.localDeliveryCost) || 0);
          totalPaidPreviously += (Number(o.amountPaid) || 0);
      });

      const appliedTripFee = enableTripFee ? tripFeeCost : 0;
      const grandTotal = totalProduct + totalShipping + totalOldFees + appliedTripFee;
      const requiredToPay = grandTotal - totalPaidPreviously;

      return {
          count: selected.length,
          totalProduct,
          totalShipping,
          totalOldFees,
          appliedTripFee,
          grandTotal,
          totalPaidPreviously,
          requiredToPay
      };
  }, [clientOrders, selectedOrderIds, enableTripFee, tripFeeCost]);

  // --- 4. Actions ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setIsProcessingImages(true);
          try {
              const files = Array.from(e.target.files) as File[];
              const compressed = await Promise.all(files.map(f => compressImage(f)));
              setReceiptImages(prev => [...prev, ...compressed]);
          } finally {
              setIsProcessingImages(false);
          }
      }
  };

  const handleConfirmDelivery = async () => {
      if (batchTotals.count === 0) return;
      
      const paymentValue = paymentInput === '' ? 0 : paymentInput;
      const remainingDebt = batchTotals.requiredToPay - paymentValue;

      // Strict Check: Must clear debt (allow small floating point tolerance)
      if (remainingDebt > 5) {
          showToast("عفواً، المبلغ المدفوع لا يغطي الدين المستحق. يرجى استلام كامل المبلغ.", "error");
          return;
      }

      setIsSubmitting(true);

      try {
          const selected = clientOrders.filter(o => selectedOrderIds.has(o.id));
          // Sort by date to apply fees to oldest first if needed, though here we apply to first in list for simplicity
          selected.sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());

          const feeRate = (paymentMethods.find(m => m.name === paymentMethod)?.feeRate || 0) / 100;
          const user = currentUser?.username || 'System';
          const timestamp = new Date().toISOString();

          // We distribute payment to cover each order fully since we checked total covers total.
          for (let i = 0; i < selected.length; i++) {
              const order = selected[i];
              const isFirst = i === 0;
              
              const orderTripFee = (isFirst && enableTripFee) ? tripFeeCost : 0;
              const newLocalDeliveryCost = (Number(order.localDeliveryCost) || 0) + orderTripFee;
              
              const orderTotalValue = (Number(order.priceInMRU) || 0) + (Number(order.commission) || 0) + (Number(order.shippingCost) || 0) + newLocalDeliveryCost;
              const paidBefore = Number(order.amountPaid) || 0;
              
              // We assume we pay off this order fully
              const payingForThisOrder = orderTotalValue - paidBefore;
              const txFee = payingForThisOrder > 0 ? Math.round(payingForThisOrder * feeRate) : 0;
              const accumulatedTxFee = (Number(order.transactionFee) || 0) + txFee;

              // Fetch existing receipt images to append
              const { data: latestOrder } = await supabase.from('Orders').select('receipt_images').eq('id', order.id).single();
              const existingReceipts = latestOrder?.receipt_images || [];
              const updatedReceiptImages = [...existingReceipts, ...receiptImages];

              const updates = {
                  status: OrderStatus.COMPLETED,
                  local_delivery_cost: newLocalDeliveryCost,
                  amount_paid: orderTotalValue, // Mark as fully paid
                  withdrawal_date: timestamp,
                  payment_method: paymentMethod,
                  transaction_fee: accumulatedTxFee,
                  receipt_images: updatedReceiptImages,
                  history: [
                      ...(order.history || []), 
                      { timestamp, activity: `Delivered & Paid. Fee: ${orderTripFee}`, user }
                  ]
              };

              const { error } = await supabase.from('Orders').update(updates).eq('id', order.id);
              if (error) throw error;
          }

          setOrders(prev => prev.map(o => selectedOrderIds.has(o.id) ? { ...o, status: OrderStatus.COMPLETED } : o));
          showToast(t('success'), 'success');
          
          setSelectedOrderIds(new Set());
          setReceiptImages([]);
          setPaymentInput('');
          setIsMobileCheckoutOpen(false);
          setSelectedClient(null);

      } catch (err: any) {
          showToast(getErrorMessage(err), 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const isDebtCovered = batchTotals.requiredToPay <= (paymentInput === '' ? 0 : paymentInput) + 5; // +5 tolerance

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden gap-4 p-2 md:p-0 relative">
        
        {/* LEFT PANE: Clients List */}
        <div className={`
            flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300
            ${selectedClient ? 'hidden lg:flex w-1/4' : 'flex w-full lg:w-1/4'}
        `}>
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <h2 className="text-lg font-black text-gray-800 dark:text-white mb-3 px-1">تسليم الطلبات</h2>
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="بحث عن عميل..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary shadow-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {activeClients.map(client => (
                    <button
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between group transition-all duration-200 border-2 ${selectedClient?.id === client.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0 ${selectedClient?.id === client.id ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-right min-w-0">
                                <p className="font-bold text-sm truncate text-gray-800 dark:text-gray-200">{client.name}</p>
                                <p className="text-[10px] font-mono text-gray-400">{client.phone}</p>
                            </div>
                        </div>
                        {client.stats.ready > 0 && (
                            <span className="flex items-center justify-center min-w-[24px] h-6 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-md animate-pulse">
                                {client.stats.ready}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>

        {/* MIDDLE PANE: Orders Grid */}
        <div className={`
            flex-col flex-1 bg-gray-50 dark:bg-black/20 rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800 relative
            ${selectedClient ? 'flex' : 'hidden lg:flex'}
        `}>
            {selectedClient && (
                <>
                    {/* Header */}
                    <div className="p-4 bg-white dark:bg-gray-800 shadow-sm flex justify-between items-center z-10">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedClient(null)} className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><ChevronLeft/></button>
                            <div>
                                <h3 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                                    {selectedClient.name}
                                    <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md text-gray-500">{clientOrders.length} طلبات</span>
                                </h3>
                                {selectedClient.cityId && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10}/> {cities.find(c=>c.id===selectedClient.cityId)?.name}</p>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={selectAllReady} 
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                        >
                            <CheckCircle2 size={16}/> <span className="hidden sm:inline">تحديد الجاهز</span> ({clientOrders.filter(o => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE).length})
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24 lg:pb-4">
                        {clientOrders.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Package size={48} className="mb-4 opacity-20"/>
                                <p>لا توجد طلبات نشطة لهذا العميل</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {clientOrders.map(order => {
                                    const isReady = order.status === OrderStatus.STORED || order.status === OrderStatus.ARRIVED_AT_OFFICE;
                                    const isSelected = selectedOrderIds.has(order.id);
                                    const store = stores.find(s => s.id === order.storeId);
                                    
                                    const total = Math.round((Number(order.priceInMRU)||0) + (Number(order.commission)||0) + (Number(order.shippingCost)||0) + (Number(order.localDeliveryCost)||0));
                                    const paid = Math.round(Number(order.amountPaid)||0);
                                    const remaining = total - paid;

                                    return (
                                        <div 
                                            key={order.id}
                                            onClick={() => isReady && toggleOrder(order.id)}
                                            className={`
                                                relative p-4 rounded-2xl border-2 transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]
                                                ${isSelected 
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md transform scale-[1.02]' 
                                                    : isReady 
                                                        ? 'bg-white dark:bg-gray-800 border-transparent hover:border-blue-300 dark:hover:border-blue-700 shadow-sm' 
                                                        : 'bg-gray-100 dark:bg-gray-900 border-transparent opacity-60 grayscale cursor-not-allowed'}
                                            `}
                                        >
                                            {/* Top Row */}
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white dark:bg-gray-700'}`}>
                                                        {isSelected && <Check size={14} strokeWidth={4}/>}
                                                    </div>
                                                    <span className="font-mono font-black text-lg text-gray-800 dark:text-white">{order.localOrderId}</span>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${STATUS_DETAILS[order.status].bgColor} ${STATUS_DETAILS[order.status].color}`}>
                                                    {t(STATUS_DETAILS[order.status].name as any)}
                                                </span>
                                            </div>

                                            {/* Info */}
                                            <div className="text-xs text-gray-500 space-y-1 mb-3">
                                                <div className="flex items-center gap-1"><StoreIcon size={12}/> {store?.name}</div>
                                                {order.storageLocation && <div className="flex items-center gap-1 text-orange-600 font-bold"><Layers size={12}/> {order.storageLocation}</div>}
                                            </div>

                                            {/* Financial Mini-Summary */}
                                            <div className="mt-auto pt-3 border-t dark:border-gray-700 flex justify-between items-end">
                                                <div>
                                                    <span className="text-[10px] text-gray-400 block">المتبقي</span>
                                                    <span className={`font-mono font-black text-lg ${remaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                        {remaining.toLocaleString()}
                                                    </span>
                                                </div>
                                                {order.weight > 0 && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300 font-bold">{order.weight} KG</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Mobile Floating Bottom Bar (Summary & Proceed) */}
                    {batchTotals.count > 0 && !isMobileCheckoutOpen && (
                        <div className="lg:hidden absolute bottom-4 left-4 right-4 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center z-20 animate-in slide-in-from-bottom-4">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">{batchTotals.count} طلبات محددة</p>
                                <p className="text-xl font-black font-mono">{batchTotals.requiredToPay.toLocaleString()} <span className="text-sm">MRU</span></p>
                            </div>
                            <button 
                                onClick={() => setIsMobileCheckoutOpen(true)}
                                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
                            >
                                إتمام العملية <ArrowUp size={18}/>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>

        {/* RIGHT PANE: Checkout Rail */}
        {selectedClient && (
            <div className={`
                bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300 z-30
                lg:w-1/4 lg:relative lg:translate-y-0
                ${isMobileCheckoutOpen ? 'fixed inset-0 m-0 rounded-none' : 'hidden lg:flex'}
            `}>
                
                {/* Header (Mobile Close Button) */}
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Calculator size={20}/> الفاتورة النهائية</h3>
                    <div className="flex gap-2">
                        {/* Only show 'Back to Grid' on mobile */}
                        <button onClick={() => setIsMobileCheckoutOpen(false)} className="lg:hidden p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300"><ChevronLeft size={20}/></button>
                        {/* Desktop Close: Deselect Client */}
                        <button onClick={() => { setIsMobileCheckoutOpen(false); setSelectedClient(null); }} className="hidden lg:block p-2 bg-gray-100 dark:bg-gray-700 rounded-full"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
                    {/* 1. Summary Header */}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-3 text-primary shadow-inner">
                            <DollarSign size={32}/>
                        </div>
                        <h3 className="font-black text-2xl text-gray-900 dark:text-white mb-1">
                            {batchTotals.count} <span className="text-sm font-medium text-gray-500">طلبات</span>
                        </h3>
                    </div>

                    {/* 2. Bill Breakdown */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-dashed border-gray-300 dark:border-gray-700 space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">قيمة المنتجات</span>
                            <span className="font-bold font-mono">{batchTotals.totalProduct.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">تكلفة الشحن</span>
                            <span className="font-bold font-mono">{batchTotals.totalShipping.toLocaleString()}</span>
                        </div>
                        {batchTotals.totalOldFees > 0 && (
                            <div className="flex justify-between text-blue-600">
                                <span>رسوم سابقة</span>
                                <span className="font-bold font-mono">{batchTotals.totalOldFees.toLocaleString()}</span>
                            </div>
                        )}
                        
                        {/* Trip Fee Input */}
                        <div className="pt-2 border-t dark:border-gray-700">
                            <label className="flex items-center justify-between cursor-pointer mb-2">
                                <span className="font-bold flex items-center gap-1.5 text-gray-700 dark:text-gray-300"><Bus size={14}/> رسوم الرحلة</span>
                                <div onClick={() => setEnableTripFee(!enableTripFee)} className={`w-8 h-4 rounded-full p-0.5 transition-colors ${enableTripFee ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${enableTripFee ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </label>
                            {enableTripFee && (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={tripFeeCost}
                                        onChange={e => setTripFeeCost(parseFloat(e.target.value) || 0)}
                                        className="w-full p-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-800 text-center font-bold outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <span className="text-xs font-bold text-gray-400">MRU</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Grand Total Card */}
                    <div className="bg-slate-900 dark:bg-black rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={64}/></div>
                        <div className="relative z-10 space-y-1">
                            <div className="flex justify-between text-xs text-gray-400 mb-2">
                                <span>الإجمالي الكلي:</span>
                                <span>{batchTotals.grandTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-green-400 mb-4 border-b border-white/10 pb-2">
                                <span>مدفوع سابقاً:</span>
                                <span>- {batchTotals.totalPaidPreviously.toLocaleString()}</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">المطلوب دفعه الآن</span>
                                <span className="text-4xl font-black font-mono tracking-tighter text-white">
                                    {batchTotals.requiredToPay.toLocaleString()} <span className="text-sm">MRU</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Payment Input Area */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                            <Wallet size={14}/> استلام المبلغ
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <input 
                                    type="number" 
                                    value={paymentInput}
                                    onChange={e => setPaymentInput(parseFloat(e.target.value) || '')}
                                    placeholder="أدخل المبلغ المستلم"
                                    className={`w-full p-3 border-2 rounded-xl text-lg font-bold font-mono outline-none focus:ring-2 focus:ring-primary/20 transition-colors ${!isDebtCovered && paymentInput !== '' ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}
                                />
                                {paymentInput !== '' && !isDebtCovered && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 animate-pulse">
                                        <AlertCircle size={20}/>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => setPaymentInput(batchTotals.requiredToPay)}
                                className="px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 rounded-xl font-bold text-xs border border-blue-200 dark:border-blue-800 flex flex-col items-center justify-center gap-1 min-w-[70px] transition-colors"
                                title="تعبئة تلقائية لكامل المبلغ"
                            >
                                <ArrowDown size={14}/>
                                تلقائي
                            </button>
                        </div>
                    </div>

                    {/* 5. Payment Method (DROPDOWN) & Receipt */}
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                وسيلة الدفع
                            </label>
                            <div className="relative">
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-primary appearance-none font-bold text-gray-700 dark:text-gray-200 text-sm"
                                >
                                    {paymentMethods.concat([{ id: 'cash', name: 'Cash', feeRate: 0 } as any]).map(method => (
                                        <option key={method.id || method.name} value={method.name}>
                                            {method.name} {method.feeRate > 0 ? `(${method.feeRate}%)` : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20}/>
                            </div>
                        </div>
                        
                        <label className="flex items-center justify-center p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-all gap-2 text-gray-500">
                            {isProcessingImages ? <Loader2 className="animate-spin" size={18}/> : <Upload size={18}/>}
                            <span className="text-xs font-bold">{receiptImages.length > 0 ? `${receiptImages.length} صور مرفقة` : 'إرفاق إيصال'}</span>
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>

                {/* Confirm Button */}
                <div className="p-5 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
                    {!isDebtCovered && (
                        <div className="flex items-center gap-2 p-3 mb-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-900 text-xs font-bold justify-center">
                            <AlertCircle size={16}/>
                            المبلغ المدخل أقل من المستحق!
                        </div>
                    )}
                    <button 
                        onClick={handleConfirmDelivery}
                        disabled={isSubmitting || batchTotals.count === 0 || !isDebtCovered}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black shadow-lg shadow-green-600/30 flex items-center justify-center gap-3 transition-all transform active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <CheckCircle2 size={24}/>}
                        تأكيد وتسليم ({batchTotals.count})
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default DeliveryPage;

import React, { useState, useEffect, useMemo } from 'react';
import type { Order, PaymentMethod, PaymentTransaction } from '../types';
import { X, Upload, Loader2, Save, CheckCircle2, Wallet, DollarSign, Box, Truck, Tag, CreditCard, ChevronDown, Calculator, Calendar, User, Eye, List } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabaseClient';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (orderId: string, details: { 
        amountPaid: number; 
        localDeliveryCost: number; 
        receiptImages: string[]; 
        paymentMethod: string; 
        transactionFee: number; 
    }) => Promise<void>;
    order: Order | null;
    bulkOrders?: Order[];
    paymentMethods: PaymentMethod[];
    hideLocalDelivery?: boolean;
}

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = async () => {
                try {
                    if ('decode' in img) await img.decode();
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) {
                        height = Math.round(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(img.src);
                    ctx.drawImage(img, 0, 0, width, height);
                    const result = canvas.toDataURL('image/jpeg', 0.6);
                    canvas.width = 0; canvas.height = 0;
                    resolve(result.length < 100 ? img.src : result);
                } catch (err) {
                    resolve(img.src);
                }
            };
            img.onerror = () => resolve(e.target?.result as string);
        };
    });
};

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onConfirm, order, bulkOrders, paymentMethods = [], hideLocalDelivery = false }) => {
    const { t } = useLanguage();
    const [amountPayingNow, setAmountPayingNow] = useState<number | ''>('');
    const [localDeliveryCost, setLocalDeliveryCost] = useState<number>(0);
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [receiptImages, setReceiptImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [history, setHistory] = useState<PaymentTransaction[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setReceiptImages([]);
            setIsSubmitting(false);
            setAmountPayingNow(''); 
            setSelectedMethod(paymentMethods.length > 0 ? paymentMethods[0].name : 'Cash');
            const targets = bulkOrders && bulkOrders.length > 0 ? bulkOrders : (order ? [order] : []);
            const initialDelivery = targets.reduce((sum, o) => sum + (o.localDeliveryCost || 0), 0);
            setLocalDeliveryCost(Math.round(initialDelivery));
            if (order && (!bulkOrders || bulkOrders.length === 0) && supabase) {
                const fetchHistory = async () => {
                    setIsLoadingHistory(true);
                    try {
                        const { data } = await supabase.from('OrderPayments').select('*').eq('order_id', order.id).order('created_at', { ascending: false });
                        if (data) setHistory(data.map((p: any) => ({ id: p.id, orderId: p.order_id, amount: p.amount, paymentMethod: p.payment_method, receiptImages: p.receipt_images || [], createdAt: p.created_at, createdBy: p.created_by })));
                    } catch (e) { console.error(e); } finally { setIsLoadingHistory(false); }
                };
                fetchHistory();
            } else { setHistory([]); }
        }
    }, [isOpen, order, bulkOrders, paymentMethods]);

    const financials = useMemo(() => {
        const targets = bulkOrders && bulkOrders.length > 0 ? bulkOrders : (order ? [order] : []);
        if (targets.length === 0) return { totalOriginal: 0, totalWeight: 0, totalShipping: 0, totalRequired: 0, prevPaid: 0, debt: 0, orderCount: 0 };
        let totalOriginal = 0; let totalWeight = 0; let totalShipping = 0; let prevPaid = 0; 
        targets.forEach(o => {
            totalOriginal += Math.round(Number(o.priceInMRU) + Number(o.commission || 0));
            totalWeight += Number(o.weight || 0);
            totalShipping += Math.round(Number(o.shippingCost) || 0);
            prevPaid += Math.round(Number(o.amountPaid) || 0);
        });
        const currentTotal = totalOriginal + totalShipping + localDeliveryCost;
        const debt = Math.max(0, currentTotal - prevPaid);
        return { totalOriginal, totalWeight, totalShipping, totalRequired: currentTotal, prevPaid, debt, orderCount: targets.length };
    }, [order, bulkOrders, localDeliveryCost]);

    const handleFillMax = () => setAmountPayingNow(financials.debt);

    const handleConfirm = async () => {
        if (receiptImages.length === 0 && !confirm("لم تقم بإرفاق إيصال. هل أنت متأكد من المتابعة؟")) return;
        const payingNow = typeof amountPayingNow === 'number' ? amountPayingNow : 0;
        if (payingNow <= 0 && localDeliveryCost === (order?.localDeliveryCost || 0)) { alert("يرجى إدخل مبلغ للدفع."); return; }
        const method = paymentMethods.find(m => m.name === selectedMethod);
        const feeRate = method?.feeRate || 0;
        const transactionFee = feeRate > 0 ? Math.round(payingNow * (feeRate / 100)) : 0;
        setIsSubmitting(true);
        try {
            const targetId = (bulkOrders && bulkOrders.length > 0) ? 'bulk_virtual_id' : order!.id;
            await onConfirm(targetId, { amountPaid: payingNow, localDeliveryCost: localDeliveryCost, receiptImages: receiptImages, paymentMethod: selectedMethod, transactionFee: transactionFee });
            onClose();
        } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingImage(true);
            try {
                // FIX: Added explicit cast to File[] to avoid unknown type error in loop
                const files = Array.from(e.target.files) as File[];
                const compressedResults: string[] = [];
                for (const file of files) {
                    const result = await compressImage(file);
                    compressedResults.push(result);
                }
                setReceiptImages(prev => [...prev, ...compressedResults].slice(0, 3));
            } finally { setIsProcessingImage(false); }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[140] p-4 backdrop-blur-sm" onClick={onClose}>
            {previewImage && (
                <div className="fixed inset-0 z-[150] bg-black/95 flex justify-center items-center p-4" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage} className="max-w-full max-h-full object-contain" />
                    <button className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white"><X/></button>
                </div>
            )}
            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-800 bg-gray-50 dark:bg-black/20 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2"><Wallet className="text-primary"/> تسجيل دفعة جديدة</h3>
                        <p className="text-sm text-gray-500 font-bold mt-1">{financials.orderCount > 1 ? `يتم الآن سداد ${financials.orderCount} طلبات دفعة واحدة` : `الطلب #${order?.localOrderId}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X size={24}/></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-grow bg-white dark:bg-gray-900">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-5 border border-gray-100 dark:border-gray-700 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Tag size={10}/> القيمة المتبقية للمنتج</span>
                                <p className="font-mono font-bold text-gray-800 dark:text-white text-lg">{(financials.totalOriginal - financials.prevPaid > 0 ? financials.totalOriginal - financials.prevPaid : 0).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Truck size={10}/> الشحن ({financials.totalWeight}kg)</span>
                                <p className="font-mono font-bold text-gray-800 dark:text-white text-lg">{financials.totalShipping.toLocaleString()}</p>
                            </div>
                        </div>
                        <hr className="border-gray-200 dark:border-gray-700 border-dashed"/>
                        {!hideLocalDelivery && (
                            <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                                <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><Box size={14}/> التوصيل المحلي</label>
                                <div className="relative w-24">
                                    <input type="number" value={localDeliveryCost} onChange={e => setLocalDeliveryCost(parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-right font-black outline-none border-b-2 border-primary/50 focus:border-primary transition-colors"/>
                                    <span className="text-[10px] text-gray-400 absolute left-0 bottom-1 pointer-events-none">MRU</span>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="text-center p-2 bg-gray-200 dark:bg-gray-700 rounded-xl"><span className="text-[9px] font-bold text-gray-500 uppercase block">الإجمالي</span><span className="font-black text-gray-800 dark:text-white">{financials.totalRequired.toLocaleString()}</span></div>
                            <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded-xl"><span className="text-[9px] font-bold text-green-600 uppercase block">مدفوع</span><span className="font-black text-green-700 dark:text-green-400">{financials.prevPaid.toLocaleString()}</span></div>
                            <div className="text-center p-2 bg-red-100 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-900"><span className="text-[9px] font-bold text-red-600 uppercase block">متبقي</span><span className="font-black text-red-700 dark:text-green-400">{financials.debt.toLocaleString()}</span></div>
                        </div>
                    </div>
                    {bulkOrders && bulkOrders.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
                            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 flex items-center gap-2 border-b dark:border-gray-700"><List size={14}/> تفاصيل الطلبات المحددة ({bulkOrders.length})</div>
                            <div className="max-h-32 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {bulkOrders.map(o => {
                                    const due = (Number(o.priceInMRU) || 0) + (Number(o.commission) || 0) + (Number(o.shippingCost) || 0) + (Number(o.localDeliveryCost) || 0) - (Number(o.amountPaid) || 0);
                                    return (<div key={o.id} className="flex justify-between items-center text-xs p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg"><span className="font-mono font-bold text-primary">#{o.localOrderId}</span><span className="font-bold text-red-500">{Math.max(0, due).toLocaleString()} MRU</span></div>);
                                })}
                            </div>
                        </div>
                    )}
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                            <label className="block text-xs font-bold text-blue-600 dark:text-blue-300 mb-2 uppercase tracking-wider flex items-center gap-2"><Calculator size={14}/> قيمة الدفعة الجديدة</label>
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <input type="number" value={amountPayingNow} onChange={e => setAmountPayingNow(parseFloat(e.target.value) || '')} className="w-full p-4 rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 font-black text-3xl text-center text-blue-700 dark:text-blue-300 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all shadow-sm" placeholder="0" autoFocus/>
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">MRU</span>
                                </div>
                                <button onClick={handleFillMax} className="px-4 bg-blue-600 text-white rounded-2xl font-bold text-xs shadow-lg hover:bg-blue-700 transition-colors flex flex-col items-center justify-center gap-1" title="دفع كامل المتبقي"><DollarSign size={16}/><span>سداد</span></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">وسيلة الدفع</label>
                                <div className="relative">
                                    <select value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)} className="w-full p-3 pl-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 font-bold text-sm appearance-none focus:ring-2 focus:ring-primary outline-none">
                                        <option value="Cash">نقدي (Cash)</option>
                                        {paymentMethods.filter(m => m.name !== 'Cash').map(m => (<option key={m.id} value={m.name}>{m.name}</option>))}
                                    </select>
                                    <CreditCard size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                    <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">إرفاق إيصال</label>
                                <label className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${receiptImages.length > 0 ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-primary hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800'}`}>
                                    {isProcessingImage ? <Loader2 className="animate-spin" size={20}/> : receiptImages.length > 0 ? <CheckCircle2 size={20}/> : <Upload size={20} className="text-gray-400"/>}
                                    <span className="text-xs font-bold">{receiptImages.length > 0 ? 'تم الإرفاق' : 'رفع صورة'}</span>
                                    <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={isProcessingImage}/>
                                </label>
                            </div>
                        </div>
                    </div>
                    {(!bulkOrders || bulkOrders.length === 0) && history.length > 0 && (
                        <div className="pt-2"><h4 className="font-bold text-gray-500 text-xs uppercase mb-3 flex items-center gap-2"><Wallet size={14}/> سجل الدفعات السابقة</h4><div className="space-y-2">{history.map(pay => (<div key={pay.id} className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center"><div><div className="flex items-center gap-2"><span className="font-black text-green-600">{pay.amount.toLocaleString()} MRU</span><span className="text-[10px] bg-white dark:bg-gray-700 px-1.5 rounded border text-gray-500">{pay.paymentMethod || 'Cash'}</span></div><div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1"><Calendar size={10}/> {new Date(pay.createdAt).toLocaleDateString()}<User size={10}/> {pay.createdBy || 'System'}</div></div>{pay.receiptImages && pay.receiptImages.length > 0 && (<div className="flex gap-1">{pay.receiptImages.map((img, i) => (<img key={i} src={img} alt="Receipt" className="w-8 h-8 rounded object-cover border cursor-pointer hover:scale-110 transition-transform" onClick={() => setPreviewImage(img)}/>))}</div>)}{(!pay.receiptImages || pay.receiptImages.length === 0) && <span className="text-[10px] text-gray-300 italic">لا يوجد إيصال</span>}</div>))}</div></div>
                    )}
                </div>
                <div className="p-6 border-t dark:border-gray-800 flex gap-3 flex-shrink-0 bg-gray-50 dark:bg-black/20">
                    <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-300 transition-colors">إلغاء</button>
                    <button onClick={handleConfirm} disabled={!amountPayingNow || isSubmitting || isProcessingImage} className="flex-[2] py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95">{isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}{bulkOrders && bulkOrders.length > 0 ? 'تأكيد التسليم والدفع' : 'حفظ الدفعة الجديدة'}</button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
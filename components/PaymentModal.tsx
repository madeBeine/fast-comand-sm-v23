
import React, { useState, useEffect, useMemo } from 'react';
import { OrderStatus, type Order, type PaymentMethod } from '../types';
import { X, DollarSign, Upload, Loader2, Save, Plus, Edit2, AlertTriangle, Image as ImageIcon, CheckCircle2, ArrowRight, Truck, ShoppingBag, Eye, Bike, Wallet } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (orderId: string, paymentDetails: { amountPaid: number, localDeliveryCost: number, receiptImages: string[], paymentMethod: string, transactionFee: number }) => Promise<void>;
    order: Order | null;
    paymentMethods?: PaymentMethod[];
}

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (event) => {
            if (!event.target?.result) return reject("Failed to read file");
            const originalBase64 = event.target.result as string;
            const img = new Image();
            img.src = originalBase64;
            try {
                await img.decode();
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
                if (!ctx) throw new Error("Canvas context failed");
                
                // FIX: Fill white background to prevent black transparent areas on Mobile/Android
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } catch (error) {
                resolve(originalBase64);
            }
        };
        reader.onerror = error => reject(error);
    });
};

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onConfirm, order, paymentMethods = [] }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add');
    const [localDeliveryCost, setLocalDeliveryCost] = useState<number>(0);
    const [currentPayment, setCurrentPayment] = useState<number>(0);
    const [manualTotalPaid, setManualTotalPaid] = useState<number>(0);
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [receiptImages, setReceiptImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    useEffect(() => {
        if (isOpen && order) {
            setLocalDeliveryCost(Math.round(order.localDeliveryCost || 0));
            setReceiptImages([]);
            setIsSubmitting(false);
            setActiveTab('add');
            setCurrentPayment(0);
            setManualTotalPaid(Math.round(Number(order.amountPaid || 0)));
            setSelectedMethod(order.paymentMethod || paymentMethods?.[0]?.name || 'Cash');
        }
    }, [isOpen, order, paymentMethods]);

    const financials = useMemo(() => {
        if (!order) return { productVal: 0, commission: 0, shipping: 0, prevPaid: 0, weight: 0 };
        const productVal = Math.round(Number(order.priceInMRU || 0));
        const commission = Math.round(Number(order.commission || 0));
        const shipping = Math.round(Number(order.shippingCost || 0));
        const prevPaid = Math.round(Number(order.amountPaid || 0));
        const weight = order.weight || 0;
        return { productVal, commission, shipping, prevPaid, weight };
    }, [order]);

    const productTotal = financials.productVal + financials.commission;
    const invoiceTotal = productTotal + financials.shipping + localDeliveryCost;
    
    const remainingBalance = invoiceTotal - financials.prevPaid;
    const isShippingDue = remainingBalance > 0 && financials.prevPaid >= productTotal;

    const newTotalPaid = activeTab === 'add' ? financials.prevPaid + currentPayment : manualTotalPaid;
    const remainingAfterPayment = invoiceTotal - newTotalPaid;

    // Fee Calculation
    const transactionFee = useMemo(() => {
        const method = paymentMethods.find(m => m.name === selectedMethod);
        const rate = method?.feeRate || 0;
        if (rate === 0) return 0;
        
        // Fee is based on the NEW amount being paid right now
        // If edit mode: fee is based on the increase in payment (or potentially whole amount? Let's assume difference for simplicity)
        const amountBeingPaidNow = activeTab === 'add' ? currentPayment : Math.max(0, manualTotalPaid - financials.prevPaid);
        
        if (amountBeingPaidNow <= 0) return 0;
        return Math.round(amountBeingPaidNow * (rate / 100));
    }, [selectedMethod, currentPayment, manualTotalPaid, activeTab, financials.prevPaid, paymentMethods]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (receiptImages.length + e.target.files.length > 3) {
                alert("أقصى حد هو 3 صور");
                return;
            }
            setIsProcessingImage(true);
            try {
                const files = Array.from(e.target.files) as File[];
                const compressed = await Promise.all(files.map(f => compressImage(f)));
                setReceiptImages(prev => [...prev, ...compressed]);
            } finally {
                setIsProcessingImage(false);
            }
        }
    };

    const removeImage = (index: number) => {
        setReceiptImages(prev => prev.filter((_, i) => i !== index));
    };

    const openImage = (src: string) => {
        const win = window.open();
        if (win) {
            win.document.write(`<img src="${src}" style="max-width:100%; height:auto;" />`);
        }
    }

    const handlePayFull = () => {
        const debt = Math.max(0, invoiceTotal - financials.prevPaid);
        setCurrentPayment(debt);
    };

    const handleConfirm = async () => {
        if (!order) return;
        setIsSubmitting(true);
        try {
            // Retrieve any previous fee to accumulate (if desired) or just store latest?
            // Usually transaction fees are cumulative. 
            // For simplicity, we add the new fee to existing fee in parent handler or here.
            // Let's pass just the NEW fee to be added.
            await onConfirm(order.id, {
                amountPaid: newTotalPaid,
                localDeliveryCost: localDeliveryCost,
                receiptImages: receiptImages,
                paymentMethod: selectedMethod,
                transactionFee: transactionFee // Pass the calculated fee
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header Section */}
                <div className="p-6 pb-4 border-b dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-900/20">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <DollarSign className="text-primary" size={24}/> تحديث المدفوعات والرسوم
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 flex items-center gap-2">
                            <span className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded font-mono">#{order.localOrderId}</span>
                            <span className="opacity-60">•</span>
                            <span>{financials.weight > 0 ? `الوزن: ${financials.weight} KG` : 'بانتظار الوزن'}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    
                    {/* Financial Summary Card */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black rounded-2xl p-5 text-white shadow-lg">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">إجمالي المستحق</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black font-mono">{invoiceTotal.toLocaleString()}</span>
                                    <span className="text-[10px] opacity-60">MRU</span>
                                </div>
                            </div>
                            <div className="text-left">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">تم دفع</span>
                                <div className="flex items-baseline gap-1 justify-end">
                                    <span className="text-2xl font-bold font-mono text-green-400">{financials.prevPaid.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Bar */}
                        <div className="relative z-10 bg-white/10 rounded-lg p-3 grid grid-cols-2 gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <ShoppingBag size={14} className="text-blue-300"/>
                                <div>
                                    <span className="block text-slate-400 text-[9px]">المنتج + العمولة</span>
                                    <span className="font-bold font-mono">{productTotal.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                                <Truck size={14} className="text-orange-300"/>
                                <div>
                                    <span className="block text-slate-400 text-[9px]">تكلفة الشحن</span>
                                    <span className="font-bold font-mono">{financials.shipping.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300">المبلغ المتبقي:</span>
                                {isShippingDue && <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded border border-orange-500/30">استحقاق الشحن</span>}
                            </div>
                            <span className="text-xl font-black text-red-400 font-mono">{(remainingBalance).toLocaleString()} MRU</span>
                        </div>
                    </div>

                    {/* Delivery Fee Adjustment */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Bike size={18} className="text-purple-500"/>
                            رسوم التوصيل / الوكالة:
                        </label>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-600 px-3 py-1.5 focus-within:ring-2 focus-within:ring-purple-500">
                            <input 
                                type="number" 
                                value={localDeliveryCost || ''} 
                                onChange={(e) => setLocalDeliveryCost(parseFloat(e.target.value) || 0)} 
                                className="w-20 text-center font-mono font-bold bg-transparent outline-none text-gray-900 dark:text-white"
                                placeholder="0"
                            />
                            <span className="text-[10px] text-gray-400">MRU</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setActiveTab('add')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'add' 
                                ? 'bg-white dark:bg-gray-800 text-primary shadow-sm ring-1 ring-black/5' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        >
                            <Plus size={18}/> دفع دفعة جديدة
                        </button>
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                activeTab === 'edit' 
                                ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-sm ring-1 ring-black/5' 
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            }`}
                        >
                            <Edit2 size={16}/> تعديل الإجمالي
                        </button>
                    </div>

                    {/* Inputs Area */}
                    <div className={`p-6 rounded-2xl border-2 transition-all duration-300 ${activeTab === 'add' ? 'bg-white dark:bg-gray-800/40 border-primary/20 shadow-sm' : 'bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/30'}`}>
                        
                        {activeTab === 'add' ? (
                            <div className="space-y-5">
                                {/* Payment Method Selector */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block uppercase">وسيلة الدفع</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {paymentMethods.concat([{ id: 'cash', name: 'Cash', feeRate: 0 } as any]).map((method) => (
                                            <button
                                                key={method.name}
                                                onClick={() => setSelectedMethod(method.name)}
                                                className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${selectedMethod === method.name ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                                            >
                                                {method.name === 'Cash' ? <Wallet size={14}/> : <DollarSign size={14}/>}
                                                {method.name}
                                                {method.feeRate > 0 && <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded">%{method.feeRate}</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mb-1">
                                    <label className="text-sm font-black text-gray-700 dark:text-gray-300">
                                        {isShippingDue ? 'قيمة الشحن للدفع الآن' : 'المبلغ المدفوع الآن'}
                                    </label>
                                    <button onClick={handlePayFull} className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                                        <CheckCircle2 size={12}/> سداد المتبقي كاملاً
                                    </button>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-primary group-focus-within:scale-110 transition-transform">
                                        <DollarSign size={24} />
                                    </div>
                                    <input 
                                        type="number" 
                                        value={currentPayment || ''} 
                                        onChange={(e) => setCurrentPayment(parseFloat(e.target.value) || 0)} 
                                        className="w-full p-4 pr-12 text-left border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-2xl font-black font-mono dark:bg-slate-700 dark:text-white transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                
                                {transactionFee > 0 && (
                                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg flex justify-between items-center animate-in fade-in slide-in-from-top-1">
                                        <span>رسوم التحويل المقدرة:</span>
                                        <span className="font-bold font-mono">-{transactionFee.toLocaleString()} MRU</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-xl text-[11px] text-orange-800 dark:text-orange-200 flex items-start gap-2">
                                    <AlertTriangle size={18} className="flex-shrink-0" />
                                    <p className="font-bold leading-relaxed">تنبيه: سيتم استبدال إجمالي المدفوع القديم ({financials.prevPaid}) بالرقم الجديد الذي ستدخله هنا.</p>
                                </div>
                                <label className="block text-sm font-black text-gray-700 dark:text-gray-300">إجمالي المدفوع الجديد (تعديل كلي)</label>
                                <input 
                                    type="number" 
                                    value={manualTotalPaid} 
                                    onChange={(e) => setManualTotalPaid(parseFloat(e.target.value) || 0)} 
                                    className="w-full p-4 border-2 border-orange-300 dark:border-orange-800 rounded-2xl focus:border-orange-500 outline-none text-2xl font-black font-mono dark:bg-slate-700 dark:text-white transition-all"
                                />
                            </div>
                        )}

                        {/* Result Impact */}
                        <div className="mt-6 flex items-center gap-4 bg-gray-100 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                            <div className="flex-1">
                                <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase">المتبقي الجديد</span>
                                <p className={`text-xl font-black font-mono ${remainingAfterPayment <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {Math.abs(remainingAfterPayment).toLocaleString()}
                                    {remainingAfterPayment < 0 && <span className="text-xs mr-1">(فائض)</span>}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm border dark:border-gray-700">
                                {remainingAfterPayment <= 0 ? <CheckCircle2 className="text-green-500" size={28}/> : <ArrowRight className="text-gray-300" size={24}/>}
                            </div>
                        </div>
                    </div>

                    {/* Receipt Section */}
                    <div>
                        <label className="block text-sm font-black text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                            <ImageIcon size={18} className="text-blue-500"/> إرفاق إيصال الدفع (بحد أقصى 3 صور)
                        </label>
                        
                        <div className="grid grid-cols-3 gap-3">
                            {receiptImages.map((src, idx) => (
                                <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-primary ring-2 ring-primary/5 aspect-square bg-gray-100 dark:bg-gray-900">
                                    <img src={src} alt={`Receipt ${idx}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onClick={() => openImage(src)} className="bg-blue-500 text-white p-1.5 rounded-lg hover:bg-blue-600"><Eye size={16}/></button>
                                        <button onClick={() => removeImage(idx)} className="bg-red-500 text-white p-1.5 rounded-lg hover:bg-red-600"><X size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {receiptImages.length < 3 && (
                                <label className={`flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-primary transition-all group ${isProcessingImage ? 'pointer-events-none opacity-50' : ''}`}>
                                    {isProcessingImage ? (
                                        <Loader2 className="animate-spin text-primary" size={24}/>
                                    ) : (
                                        <>
                                            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 group-hover:text-primary group-hover:bg-white dark:group-hover:bg-gray-700 transition-all mb-1">
                                                <Upload size={20}/>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-500 group-hover:text-primary text-center px-1">رفع صورة</span>
                                        </>
                                    )}
                                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={isProcessingImage} />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t dark:border-gray-700 flex gap-3 bg-gray-50/50 dark:bg-gray-900/20">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3.5 px-6 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all"
                    >
                        تراجع
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={isSubmitting || isProcessingImage || (activeTab === 'add' && currentPayment <= 0 && receiptImages.length === 0)}
                        className="flex-[2] py-3.5 px-8 bg-primary hover:bg-primary-dark text-white rounded-xl font-black shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95 flex items-center justify-center gap-3 text-lg"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                        حفظ التغييرات
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;

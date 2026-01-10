
import React, { useState, useEffect } from 'react';
import type { Order } from '../types';
import { Scissors, X, Save, AlertCircle, ArrowRight, Loader2, Zap } from 'lucide-react';

interface SplitOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSplit: (originalOrderId: string, splitDetails: { 
        quantity: number; 
        trackingNumber: string; 
        globalOrderId?: string;
        priceAdjustment?: number; 
    }) => Promise<void>;
    order: Order | null;
}

const SplitOrderModal: React.FC<SplitOrderModalProps> = ({ isOpen, onClose, onSplit, order }) => {
    const [quantityToSplit, setQuantityToSplit] = useState<number>(1);
    const [newTrackingNumber, setNewTrackingNumber] = useState('');
    const [newGlobalOrderId, setNewGlobalOrderId] = useState('');
    const [priceToMove, setPriceToMove] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (order) {
            setQuantityToSplit(1);
            setNewTrackingNumber('');
            setNewGlobalOrderId(order.globalOrderId || '');
            const unitPrice = (order.priceInMRU || 0) / (order.quantity || 1);
            setPriceToMove(Math.floor(unitPrice * 1)); 
        }
    }, [order, isOpen]);

    useEffect(() => {
        if (order) {
            const unitPrice = (order.priceInMRU || 0) / (order.quantity || 1);
            setPriceToMove(Math.floor(unitPrice * quantityToSplit));
        }
    }, [quantityToSplit, order]);

    if (!isOpen || !order) return null;

    const remainingQty = order.quantity - quantityToSplit;
    const remainingPrice = (order.priceInMRU || 0) - priceToMove;

    const handleSubmit = async () => {
        if (quantityToSplit >= order.quantity) {
            alert("لا يمكن تجزئة كامل الكمية. يجب أن يبقى عنصر واحد على الأقل في الطلب الأصلي.");
            return;
        }
        setIsSubmitting(true);
        try {
            await onSplit(order.id, {
                quantity: quantityToSplit,
                trackingNumber: newTrackingNumber,
                globalOrderId: newGlobalOrderId,
                priceAdjustment: priceToMove
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light";
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Scissors className="text-orange-500" />
                        تجزئة الطلب: <span className="font-mono dir-ltr">{order.localOrderId}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200 mb-4 flex items-start gap-2">
                    <Zap size={18} className="flex-shrink-0 mt-0.5"/>
                    <p>بعد الفصل، يمكنك استخدام زر "تحديث الحالة" في البطاقة الجديدة لإكمال البيانات (مثل رقم التتبع) باتباع التسلسل الصحيح.</p>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>الكمية الكلية الحالية</label>
                            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-center">{order.quantity}</div>
                        </div>
                        <div>
                            <label className={labelClass}>الكمية المراد فصلها (الطلب الجديد)*</label>
                            <input 
                                type="number" 
                                min="1" 
                                max={order.quantity - 1} 
                                value={quantityToSplit} 
                                onChange={(e) => setQuantityToSplit(parseInt(e.target.value) || 0)} 
                                className={inputClass} 
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-sm font-bold text-gray-500">
                        <div className="text-center">
                            <span className="block text-xs font-normal">سيبقى في الأصلي</span>
                            <span className="text-lg text-primary">{remainingQty}</span>
                        </div>
                        <ArrowRight size={20}/>
                        <div className="text-center">
                            <span className="block text-xs font-normal">سينقل للجديد</span>
                            <span className="text-lg text-green-600">{quantityToSplit}</span>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>رقم الطلب العالمي (للشحنة الجديدة)</label>
                        <input 
                            type="text" 
                            value={newGlobalOrderId} 
                            onChange={(e) => setNewGlobalOrderId(e.target.value)} 
                            className={inputClass} 
                            placeholder="يمكن تركه فارغاً"
                        />
                    </div>

                    <div>
                        <label className={labelClass}>رقم التتبع للشحنة الجديدة (اختياري)</label>
                        <input 
                            type="text" 
                            value={newTrackingNumber} 
                            onChange={(e) => setNewTrackingNumber(e.target.value)} 
                            className={inputClass} 
                            placeholder="أدخل رقم التتبع إذا توفر"
                        />
                        <p className="text-xs text-gray-500 mt-1">اتركه فارغاً لإدخاله لاحقاً عبر زر تحديث الحالة.</p>
                    </div>

                    <div className="pt-2 border-t dark:border-gray-700">
                        <label className={labelClass}>توزيع السعر (MRU)</label>
                        <div className="text-xs text-gray-500 mb-2">يمكنك تعديل المبلغ الذي سيتم نقله إلى الطلب الجديد.</div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs block mb-1">المبلغ المتبقي في الأصلي</span>
                                <input type="number" value={remainingPrice} disabled className="w-full p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 cursor-not-allowed" />
                            </div>
                            <div>
                                <span className="text-xs block mb-1">المبلغ في الطلب الجديد</span>
                                <input 
                                    type="number" 
                                    value={priceToMove} 
                                    onChange={(e) => setPriceToMove(parseFloat(e.target.value) || 0)} 
                                    className={inputClass} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || quantityToSplit < 1}
                        className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg shadow hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-bold"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        تأكيد الفصل
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SplitOrderModal;

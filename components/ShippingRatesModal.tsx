
import React from 'react';
import { X, Truck, Zap, Info } from 'lucide-react';

interface ShippingRatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    rates: { fast: number; normal: number };
    currency?: string;
}

const ShippingRatesModal: React.FC<ShippingRatesModalProps> = ({ isOpen, onClose, rates, currency = 'MRU' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Truck className="text-primary"/> أسعار الشحن
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400"/>
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Fast Shipping */}
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400">
                                <Zap size={24} fill="currentColor" />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 dark:text-gray-200">شحن سريع</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">جوي / مستعجل</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{rates.fast}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{currency} / KG</p>
                        </div>
                    </div>

                    {/* Normal Shipping */}
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                                <Truck size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 dark:text-gray-200">شحن عادي</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">بحري / اقتصادي</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{rates.normal}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{currency} / KG</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t dark:border-gray-700">
                    <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                        <Info size={12}/> الأسعار للكيلوغرام الواحد وتخضع للتغيير.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShippingRatesModal;

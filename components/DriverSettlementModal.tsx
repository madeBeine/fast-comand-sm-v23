
import React from 'react';
import { X, CheckCircle, Calculator, Wallet, Truck, AlertCircle, ArrowDown, ArrowUp, Coins } from 'lucide-react';
import type { Order, Driver } from '../types';
import { OrderStatus } from '../types';

interface DriverSettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    driver: Driver;
    orders: Order[];
}

const DriverSettlementModal: React.FC<DriverSettlementModalProps> = ({ isOpen, onClose, onConfirm, driver, orders }) => {
    if (!isOpen) return null;

    // 1. Filter ONLY COMPLETED orders (Ignore returned/cancelled ones from the calculation)
    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED);

    // --- Calculation Logic based on User Request ---
    let totalBaseDebtCollected = 0; // المبلغ المتبقي من ثمن الطلب والشحن (بدون توصيل)
    let totalDeliveryFeesCollectedFromClient = 0; // رسوم التوصيل التي دفعها العميل للسائق (إذا لم تكن مدفوعة مسبقاً)
    let totalDriverEarnings = 0; // مستحقات السائق (قيمة المشوار)

    completedOrders.forEach(o => {
        // A. Calculate Base Debt (Product + Commission + Shipping - PaidSoFar)
        // Note: We exclude localDeliveryCost here because we treat it separately based on the logic requested.
        const productTotal = Number(o.priceInMRU || 0) + Number(o.commission || 0);
        const shippingTotal = Number(o.shippingCost || 0);
        const alreadyPaid = Number(o.amountPaid || 0);

        // The base value of the goods + shipping
        const orderBaseValue = productTotal + shippingTotal;
        
        // The remaining debt on the goods (Example: 450)
        // If alreadyPaid > orderBaseValue, debt is 0 (surplus handled elsewhere or ignored here based on context)
        const baseDebt = Math.max(0, orderBaseValue - alreadyPaid);

        // B. Driver Fee for this order (Example: 100)
        const driverFee = Number(o.localDeliveryCost || 0);

        // C. Logic: What did the driver collect?
        if (o.isDeliveryFeePrepaid) {
            // Case 1: Prepaid. 
            // Driver collects ONLY the Base Debt (450).
            // Driver DOES NOT collect the delivery fee from client.
            totalBaseDebtCollected += baseDebt;
            // totalDeliveryFeesCollectedFromClient adds 0
        } else {
            // Case 2: Not Prepaid.
            // Driver collects Base Debt (450) + Delivery Fee (100) = 550.
            totalBaseDebtCollected += baseDebt;
            totalDeliveryFeesCollectedFromClient += driverFee;
        }

        // D. Driver is ALWAYS entitled to the delivery fee for completed orders
        totalDriverEarnings += driverFee;
    });

    // Total Cash currently in Driver's hand
    const totalCashInHand = totalBaseDebtCollected + totalDeliveryFeesCollectedFromClient;

    // Net Settlement: What he has - What he earned
    // Example 1 (Prepaid): Has 450. Earned 100. Net: 450 - 100 = 350 (Pays Office)
    // Example 2 (Not Prepaid): Has 550. Earned 100. Net: 550 - 100 = 450 (Pays Office)
    const netTotal = totalCashInHand - totalDriverEarnings;

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[140] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                
                <div className="p-6 border-b dark:border-gray-800 bg-gray-50 dark:bg-black/20 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <Calculator className="text-green-600"/> تصفية العهدة
                        </h3>
                        <p className="text-sm text-gray-500 font-bold">{driver.name} ({completedOrders.length} طلبات مكتملة)</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-6">
                    
                    {/* Detailed Breakdown */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 space-y-4">
                        
                        {/* 1. Base Debt Collected */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-bold">متبقي ثمن الطلبات (بدون توصيل)</span>
                            <span className="font-mono font-bold text-gray-800 dark:text-white">{totalBaseDebtCollected.toLocaleString()}</span>
                        </div>

                        {/* 2. Delivery Fees Collected */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 font-bold">رسوم توصيل (مقبوضة من العملاء)</span>
                            <span className="font-mono font-bold text-gray-800 dark:text-white">{totalDeliveryFeesCollectedFromClient.toLocaleString()}</span>
                        </div>

                        <hr className="border-gray-200 dark:border-gray-700"/>

                        {/* 3. Total Cash In Hand */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Wallet size={18}/></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500">إجمالي الكاش المستلم</p>
                                    <p className="text-[10px] text-gray-400">في يد السائق الآن</p>
                                </div>
                            </div>
                            <span className="font-mono font-black text-lg text-blue-600 dark:text-blue-400">{totalCashInHand.toLocaleString()}</span>
                        </div>

                        {/* 4. Driver Earnings (Deduction) */}
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Truck size={18}/></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500">مستحقات السائق (الراتب)</p>
                                    <p className="text-[10px] text-gray-400">يتم خصمها من الكاش</p>
                                </div>
                            </div>
                            <span className="font-mono font-black text-lg text-green-600">-{totalDriverEarnings.toLocaleString()}</span>
                        </div>

                        <hr className="border-dashed border-gray-300 dark:border-gray-600"/>

                        {/* 5. Net Result */}
                        <div className={`p-4 rounded-2xl flex justify-between items-center ${netTotal >= 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-red-600 text-white shadow-lg shadow-red-500/30'}`}>
                            <div>
                                <span className="text-sm font-black block flex items-center gap-1">
                                    {netTotal >= 0 ? 'الصافي (تسليم للمكتب)' : 'الصافي (دفع للسائق)'}
                                    {netTotal >= 0 ? <ArrowDown size={16}/> : <ArrowUp size={16}/>}
                                </span>
                                <span className="text-[10px] opacity-80 font-bold">
                                    {netTotal >= 0 ? 'المبلغ الذي يسلمه السائق' : 'المبلغ المطلوب دفعه للسائق'}
                                </span>
                            </div>
                            <span className="font-mono font-black text-3xl">
                                {Math.abs(netTotal).toLocaleString()} <span className="text-sm">MRU</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl text-yellow-800 dark:text-yellow-200 text-xs font-bold border border-yellow-100 dark:border-yellow-900/50">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5"/>
                        <p>تنبيه: الطلبات غير المكتملة (الراجعة) لا تدخل في هذه الحسبة ويجب إرجاعها للمخزن بشكل منفصل.</p>
                    </div>
                </div>

                <div className="p-6 border-t dark:border-gray-800 bg-gray-50 dark:bg-black/20">
                    <button onClick={onConfirm} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 text-lg">
                        <CheckCircle size={24}/> استلام المبلغ وإغلاق العهدة
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DriverSettlementModal;

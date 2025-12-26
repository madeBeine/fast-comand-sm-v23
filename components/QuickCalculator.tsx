
import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, RotateCcw, Copy, Check, ChevronDown, ChevronUp, List, Share2, Globe } from 'lucide-react';
import type { Currency, AppSettings } from '../types';
import { ShippingType } from '../types';

interface QuickCalculatorProps {
    currencies: Currency[];
    settings: AppSettings;
    isFloating?: boolean; // New prop to adjust styling for floating mode
    onClose?: () => void; // Optional close handler for floating mode
}

const QuickCalculator: React.FC<QuickCalculatorProps> = ({ currencies, settings, isFloating, onClose }) => {
    const [amount, setAmount] = useState<number | ''>('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>(settings.defaultCurrency || 'AED');
    const [weight, setWeight] = useState<number | ''>(0);
    const [shippingType, setShippingType] = useState<ShippingType>(ShippingType.NORMAL);
    const [commissionType, setCommissionType] = useState<'percentage' | 'fixed'>('percentage');
    const [commissionValue, setCommissionValue] = useState<number>(settings.commissionRate);
    // Initialize zone with Dubai (default in most cases) or fall back to Default
    const [selectedZone, setSelectedZone] = useState<string>(settings.defaultOriginCenter || 'Dubai');
    const [copied, setCopied] = useState(false);
    
    // New States for Details
    const [showDetails, setShowDetails] = useState(false);
    const [detailsCopied, setDetailsCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    // Sync selected currency if default settings change (e.g., after loading)
    useEffect(() => {
        if (settings.defaultCurrency) {
            setSelectedCurrency(settings.defaultCurrency);
        }
        if (settings.defaultOriginCenter) {
            setSelectedZone(settings.defaultOriginCenter);
        }
    }, [settings.defaultCurrency, settings.defaultOriginCenter]);

    // Find rate
    const currentCurrency = useMemo(() => currencies.find(c => c.code === selectedCurrency), [selectedCurrency, currencies]);
    const exchangeRate = currentCurrency ? currentCurrency.rate : 1; 

    // Calculate
    const results = useMemo(() => {
        const numAmount = typeof amount === 'number' ? amount : 0;
        const numWeight = typeof weight === 'number' ? weight : 0;
        
        // 1. Product Price in MRU (Amount is treated as TOTAL value now, not unit price)
        const productMRU = numAmount * exchangeRate;
        
        // 2. Shipping Cost
        // Determine rates based on selected zone
        let fastRate = settings.shippingRates.fast;
        let normalRate = settings.shippingRates.normal;

        if (selectedZone !== 'Default') {
            const zone = settings.shippingZones?.find(z => z.name === selectedZone);
            if (zone) {
                fastRate = zone.rates.fast;
                normalRate = zone.rates.normal;
            }
        }

        const shippingRate = shippingType === ShippingType.FAST ? fastRate : normalRate;
        const shippingCost = numWeight * shippingRate;

        // 3. Commission Logic (With Minimum Threshold)
        let commissionMRU = 0;
        const minCommission = settings.minCommissionValue || 100;

        if (commissionType === 'percentage') {
            const rawComm = productMRU * (commissionValue / 100);
            commissionMRU = Math.max(rawComm, minCommission);
        } else {
            commissionMRU = commissionValue;
        }

        const totalMRU = Math.round(productMRU + shippingCost + commissionMRU);

        return { productMRU, shippingCost, commissionMRU, totalMRU, minCommissionApplied: commissionMRU === minCommission && commissionType === 'percentage' };
    }, [amount, exchangeRate, weight, shippingType, settings.shippingRates, settings.shippingZones, selectedZone, commissionType, commissionValue, settings.minCommissionValue]);

    // Robust Clipboard Copy Function
    const copyToClipboard = async (text: string, setSuccess: (val: boolean) => void) => {
        try {
            await navigator.clipboard.writeText(text);
            setSuccess(true);
        } catch (err) {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setSuccess(true);
            } catch (fallbackErr) {
                console.error('Copy failed', fallbackErr);
            }
            document.body.removeChild(textArea);
        }
        setTimeout(() => setSuccess(false), 2000);
    };

    const handleCopy = () => {
        copyToClipboard(`${results.totalMRU} MRU`, setCopied);
    };

    const handleCopyDetails = () => {
        const lines = [
            `تفاصيل الحساب:`,
            `----------------`,
            `سعر الصرف: 1 ${selectedCurrency} = ${exchangeRate} MRU`,
            `المنطقة: ${selectedZone === 'Default' ? 'عالمي' : selectedZone}`,
            `قيمة المنتج: ${amount || 0} ${selectedCurrency}`,
            `القيمة بالأوقية: ${Math.round(results.productMRU).toLocaleString()} MRU`
        ];

        if (results.shippingCost > 0) {
            lines.push(`الشحن (${weight || 0}kg - ${shippingType === ShippingType.FAST ? 'سريع' : 'عادي'}): ${Math.round(results.shippingCost).toLocaleString()} MRU`);
        }

        const commLabel = results.minCommissionApplied ? `العمولة (الحد الأدنى)` : `العمولة (${commissionType === 'percentage' ? commissionValue + '%' : 'ثابتة'})`;
        lines.push(`${commLabel}: ${Math.round(results.commissionMRU).toLocaleString()} MRU`);
        
        lines.push(`----------------`);
        lines.push(`المجموع النهائي: ${results.totalMRU.toLocaleString()} MRU`);

        const text = lines.join('\n');
        copyToClipboard(text, setDetailsCopied);
    };

    const handleShareLink = () => {
        const url = settings.calculatorShortLink || `${window.location.origin}/calculator`;
        copyToClipboard(url, setLinkCopied);
    };

    const handleReset = () => {
        setAmount('');
        setWeight(0);
        setCommissionType('percentage');
        setCommissionValue(settings.commissionRate);
        setSelectedCurrency(settings.defaultCurrency || 'AED');
        setSelectedZone(settings.defaultOriginCenter || 'Dubai');
        setShowDetails(false);
    };

    const containerClasses = isFloating 
        ? "bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 w-full max-w-sm mx-auto overflow-hidden transition-all duration-300" 
        : "bg-gradient-to-r from-blue-900 to-indigo-900 dark:from-slate-800 dark:to-slate-900 p-4 rounded-2xl shadow-lg text-white mb-6 border border-blue-800 dark:border-slate-700 transition-all duration-300";

    return (
        <div className={containerClasses} onClick={e => e.stopPropagation()}>
            <div className={`flex ${isFloating ? 'justify-between' : 'flex-col lg:flex-row'} gap-4 items-end mb-2`}>
                {/* Title */}
                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <div className="flex items-center gap-2 text-blue-200">
                        <Calculator size={20}/> 
                        <span className="font-bold">حاسبة الأسعار</span>
                    </div>
                    
                    <button 
                        onClick={handleShareLink} 
                        className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] text-blue-100 transition-colors"
                        title="نسخ رابط الحاسبة للعملاء"
                    >
                        {linkCopied ? <Check size={12} className="text-green-400"/> : <Share2 size={12}/>}
                        <span>{linkCopied ? 'تم النسخ' : 'رابط العملاء'}</span>
                    </button>
                </div>

                {isFloating && onClose && (
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-white/70">
                        ✕
                    </button>
                )}
            </div>

            {/* Inputs Row */}
            <div className={`grid ${isFloating ? 'grid-cols-1 gap-3' : 'grid-cols-2 md:grid-cols-5 gap-2'} flex-grow w-full`}>
                {/* Price */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">سعر المنتج الكلي</label>
                    <div className="flex">
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={e => setAmount(parseFloat(e.target.value))} 
                            className="w-full bg-black/20 border border-white/10 rounded-r-lg p-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="0.00"
                        />
                        <select 
                            value={selectedCurrency} 
                            onChange={e => setSelectedCurrency(e.target.value)}
                            className="bg-black/40 border border-l-0 border-white/10 rounded-l-lg px-1 text-xs text-white focus:outline-none"
                        >
                            <option value="MRU">MRU</option>
                            {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                        </select>
                    </div>
                </div>

                {/* Origin / Zone Selection */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">المنطقة</label>
                    <div className="relative">
                        <select 
                            value={selectedZone} 
                            onChange={e => setSelectedZone(e.target.value)}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none pl-8"
                        >
                            {settings.shippingZones?.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
                            <option value="Default">عالمي (افتراضي)</option>
                        </select>
                        <Globe size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none"/>
                    </div>
                </div>

                {/* Weight & Type */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">الوزن والشحن</label>
                    <div className="flex">
                        <input 
                            type="number" 
                            value={weight} 
                            onChange={e => setWeight(parseFloat(e.target.value))} 
                            className="w-full bg-black/20 border border-white/10 rounded-r-lg p-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="KG"
                        />
                        <button 
                            onClick={() => setShippingType(prev => prev === ShippingType.NORMAL ? ShippingType.FAST : ShippingType.NORMAL)}
                            className={`px-2 text-[10px] font-bold rounded-l-lg border border-l-0 border-white/10 flex items-center justify-center min-w-[50px] transition-colors ${shippingType === ShippingType.FAST ? 'bg-red-500/80 text-white' : 'bg-blue-500/80 text-white'}`}
                        >
                            {shippingType === ShippingType.FAST ? 'سريع' : 'عادي'}
                        </button>
                    </div>
                </div>

                {/* Commission */}
                <div>
                    <label className="text-[10px] text-blue-300 block mb-1">العمولة</label>
                    <div className="flex">
                        <input 
                            type="number" 
                            value={commissionValue} 
                            onChange={e => setCommissionValue(parseFloat(e.target.value))} 
                            className="w-full bg-black/20 border border-white/10 rounded-r-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button 
                            onClick={() => setCommissionType(prev => prev === 'percentage' ? 'fixed' : 'percentage')}
                            className="px-2 text-[10px] font-bold bg-black/40 text-white rounded-l-lg border border-l-0 border-white/10 min-w-[40px]"
                        >
                            {commissionType === 'percentage' ? '%' : 'MRU'}
                        </button>
                    </div>
                </div>

                {/* Results Display (Mini) */}
                <div className="flex flex-col justify-end">
                    <div className="bg-black/30 rounded-lg p-2 flex justify-between items-center border border-white/10 h-[38px]">
                        <span className="text-xs font-bold text-yellow-400">الإجمالي:</span>
                        <span className="font-mono font-bold text-lg">{results.totalMRU.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Actions & Details Toggle */}
            <div className={`flex flex-col gap-2 ${isFloating ? 'mt-4' : 'mt-3 lg:mt-0 lg:border-t-0 lg:pt-0 pt-3 border-t border-white/10'}`}>
                
                <div className="flex justify-between items-center">
                    <button 
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-[10px] text-blue-300 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        {showDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                        {showDetails ? 'إخفاء التفاصيل' : 'تفاصيل أكثر'}
                    </button>

                    <div className="flex gap-2">
                        <button onClick={handleReset} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors" title="تصفير">
                            <RotateCcw size={16}/>
                        </button>
                        <button onClick={handleCopy} className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2">
                            {copied ? <Check size={14}/> : <Copy size={14}/>}
                            <span>نسخ الإجمالي</span>
                        </button>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                {showDetails && (
                    <div className="mt-2 bg-black/40 rounded-xl border border-white/10 p-3 text-xs space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                            <span className="text-blue-200">سعر الصرف:</span>
                            <span className="font-mono text-white">1 {selectedCurrency} = {exchangeRate} MRU</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-blue-200">قيمة المنتج:</span>
                            <span className="font-mono text-white">{amount || 0} {selectedCurrency}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-blue-200">القيمة بالأوقية:</span>
                            <span className="font-mono text-white">{Math.round(results.productMRU).toLocaleString()} MRU</span>
                        </div>
                        {results.shippingCost > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-blue-200">الشحن ({weight || 0}kg):</span>
                                <span className="font-mono text-white">{Math.round(results.shippingCost).toLocaleString()} MRU</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
                            <span className="text-blue-200">
                                {results.minCommissionApplied ? 'العمولة (حد أدنى):' : `العمولة (${commissionType === 'percentage' ? commissionValue + '%' : 'ثابتة'}):`}
                            </span>
                            <span className="font-mono text-white">{Math.round(results.commissionMRU).toLocaleString()} MRU</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <span className="font-bold text-yellow-400">المجموع النهائي:</span>
                            <span className="font-bold font-mono text-yellow-400 text-sm">{results.totalMRU.toLocaleString()} MRU</span>
                        </div>
                        
                        <button 
                            onClick={handleCopyDetails}
                            className="w-full mt-2 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center gap-2 text-xs transition-colors"
                        >
                            {detailsCopied ? <Check size={14} className="text-green-400"/> : <List size={14}/>}
                            {detailsCopied ? 'تم نسخ التفاصيل' : 'نسخ التفاصيل كاملة'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickCalculator;


import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Order, Client, Store, Currency, AppSettings, PaymentMethod, ShippingCompany } from '../types';
import { ShippingType, OrderStatus, TransportMode } from '../types';
import { Save, X, Plus, Trash2, Loader2, Link, Ship, Plane, Truck, DollarSign, Image as ImageIcon, User, ShoppingBag, CheckCircle2, Calculator, Receipt, Upload, Search, Tag, Sparkles, Wand2, Clock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabaseClient';
import { useNetwork } from '../contexts/NetworkContext';
import { GoogleGenAI } from "@google/genai";
import { useToast } from '../contexts/ToastContext';

export interface OrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (order: Order) => Promise<void>;
    order: Order | null;
    clients: Client[];
    stores: Store[];
    currencies: Currency[];
    commissionRate: number;
    isSaving?: boolean;
    orders?: Order[];
    settings?: AppSettings;
    shippingCompanies?: ShippingCompany[];
    paymentMethods?: PaymentMethod[];
    onClientSearch?: (term: string) => void;
}

const normalizeText = (text: string): string => {
    if (!text) return '';
    return text.toLowerCase().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[\u064B-\u0652]/g, '').replace(/[^a-z0-9\u0600-\u06FF\s]/g, '').replace(/\s+/g, ' ');
};

const normalizePhone = (text: string): string => text.replace(/[^0-9]/g, '');

interface SearchableSelectProps<T> {
    options: T[];
    value: string;
    placeholder: string;
    onChange: (value: string, item?: T) => void;
    getDisplayValue: (value: string) => string;
    renderOption: (option: T) => React.ReactNode;
    valueField: keyof T;
    error?: string;
    icon?: React.ReactNode;
    onSearch?: (term: string) => void;
}

function SearchableSelect<T extends { id: string }>({ options, value, placeholder, onChange, getDisplayValue, renderOption, valueField, error, icon, onSearch }: SearchableSelectProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); 
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (!isOpen) setIsOpen(true);
        if (onSearch) {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(() => { if (val.trim().length >= 2) onSearch(val); }, 400);
        }
    };

    const filteredOptions = useMemo(() => {
        const query = searchTerm.trim();
        if (query.length < 1) return [];
        const normalizedSearch = normalizeText(query);
        const phoneSearch = normalizePhone(query);
        return options.map(option => {
                const name = normalizeText(getDisplayValue(option[valueField] as string));
                const anyOpt = option as any;
                const phone = normalizePhone(anyOpt.phone || '');
                let score = 0;
                if (name === normalizedSearch || (phoneSearch.length > 3 && phone === phoneSearch)) score += 10000;
                else if (name.startsWith(normalizedSearch) || (phoneSearch.length > 2 && phone.startsWith(phoneSearch))) score += 5000;
                else if (name.includes(normalizedSearch)) score += 100;
                return { option, score };
            })
            .filter(item => item.score > 0) 
            .sort((a, b) => b.score - a.score) 
            .map(item => item.option)
            .slice(0, 15);
    }, [options, searchTerm, getDisplayValue, valueField]);

    const displayValue = isOpen ? searchTerm : (value ? getDisplayValue(value) : '');
    
    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none">{icon || <Search size={16} />}</div>
                <input
                    type="text"
                    value={displayValue}
                    onChange={handleSearchChange}
                    onFocus={() => { setIsOpen(true); setSearchTerm(''); }}
                    placeholder={placeholder}
                    className={`w-full h-[46px] pl-10 pr-4 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm font-bold transition-all ${error ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                    autoComplete="off"
                />
            </div>
            {isOpen && searchTerm.trim().length > 0 && (
                <ul className="absolute z-[100] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200 custom-scrollbar">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(option => (
                            <li key={option.id} onClick={() => { onChange(option[valueField] as string, option); setIsOpen(false); setSearchTerm(''); }} className="px-4 py-3 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 border-b dark:border-gray-700 last:border-0 transition-colors">
                                {renderOption(option)}
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-8 text-gray-400 text-center text-sm">
                            <Search className="mx-auto mb-2 opacity-20" size={24}/>
                            لا توجد نتائج
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

const OrderFormModal: React.FC<OrderFormModalProps> = ({ isOpen, onClose, onSave, order, clients, stores, currencies, commissionRate, orders = [], settings, paymentMethods = [], onClientSearch }) => {
    const { t } = useLanguage();
    const { showToast } = useToast();
    const availableZones = useMemo(() => settings?.shippingZones?.map(z => z.name) || [], [settings]);
    const [isAILoading, setIsAILoading] = useState(false);
    const [isFetchingOrder, setIsFetchingOrder] = useState(false);
    const sortedStores = useMemo(() => [...stores].sort((a, b) => a.name.localeCompare(b.name)), [stores]);

    const [formData, setFormData] = useState<Partial<Order>>({});
    const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);
    const [receiptImagePreviews, setReceiptImagePreviews] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [localIsSaving, setLocalIsSaving] = useState(false);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [cachedSelectedClient, setCachedSelectedClient] = useState<Client | null>(null);

    // Fetch Full Order Details including Images when Editing
    useEffect(() => {
        if (isOpen && order?.id) {
            setIsFetchingOrder(true);
            const fetchFullDetails = async () => {
                try {
                    const { data, error } = await supabase!
                        .from('Orders')
                        .select('product_images, receipt_images, receipt_image, *')
                        .eq('id', order.id)
                        .single();

                    if (error) throw error;

                    if (data) {
                        const productImgs = data.product_images || [];
                        const receiptImgs = data.receipt_images || (data.receipt_image ? [data.receipt_image] : []);
                        
                        setFormData({
                            ...order,
                            productLinks: data.product_links || [''],
                            productImages: productImgs,
                            receiptImages: receiptImgs,
                            notes: data.notes || '',
                            amountPaid: data.amount_paid,
                            price: data.price
                        });
                        setProductImagePreviews(productImgs);
                        setReceiptImagePreviews(receiptImgs);
                    }
                } catch (e) {
                    console.error("Failed to fetch full order details", e);
                } finally {
                    setIsFetchingOrder(false);
                }
            };
            fetchFullDetails();
        } else if (isOpen && !order) {
            // New Order Initialization
            const initialId = settings?.orderIdPrefix ? `${settings.orderIdPrefix}${Math.floor(Math.random() * 90000) + 10000}` : '';
            setFormData({
                status: OrderStatus.NEW,
                localOrderId: initialId,
                shippingType: settings?.defaultShippingType || ShippingType.NORMAL,
                transportMode: TransportMode.AIR,
                currency: settings?.defaultCurrency || (currencies?.[0]?.code || 'AED'),
                quantity: 1,
                orderDate: new Date().toISOString().split('T')[0],
                productLinks: [''],
                originCenter: settings?.defaultOriginCenter || '',
                paymentMethod: paymentMethods?.[0]?.name || 'Cash'
            });
            setProductImagePreviews([]);
            setReceiptImagePreviews([]);
            setIsFetchingOrder(false);
        }
    }, [isOpen, order?.id, settings?.orderIdPrefix]);

    const financials = useMemo(() => {
        const price = formData.price || 0;
        const currCode = formData.currency || 'AED';
        const selectedCurrency = currencies.find(c => c.code === currCode);
        const rate = selectedCurrency ? selectedCurrency.rate : 1;
        const totalMRU = Math.round(price * rate);
        let calculatedCommission = 0;
        const minCommission = settings?.minCommissionValue || 100;
        
        if (formData.commissionType === 'percentage' || !formData.commissionType) {
            calculatedCommission = Math.max(totalMRU * ((formData.commissionRate || commissionRate) / 100), minCommission);
        } else {
            calculatedCommission = formData.commission || 0;
        }
        
        calculatedCommission = Math.round(calculatedCommission);
        const totalDue = totalMRU + calculatedCommission;
        const amountPaid = formData.amountPaid || 0;
        const remaining = Math.max(0, totalDue - amountPaid);
        
        return { rate, totalMRU, calculatedCommission, totalDue, remaining };
    }, [formData.price, formData.currency, formData.commissionType, formData.commissionRate, formData.commission, formData.amountPaid, currencies, settings, commissionRate]);

    const handleInputChange = (e: React.ChangeEvent<any>) => { 
        const {name,value,type} = e.target; 
        setFormData(p => ({...p, [name]: type==='number'?parseFloat(value):value})); 
        if (errors[name]) setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    };

    const handleMagicFill = async () => {
        const link = formData.productLinks?.[0];
        if (!link) return showToast("يرجى إدخال رابط منتج أولاً للمسح الذكي.", "warning");
        setIsAILoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Extract product details from: "${link}". JSON format only: price (number), currency (string), quantity (number), notes (string).`,
                config: { responseMimeType: 'application/json' }
            });
            const data = JSON.parse(response.text || '{}');
            setFormData(prev => ({ ...prev, price: data.price || prev.price, currency: data.currency || prev.currency, quantity: data.quantity || prev.quantity, notes: data.notes || prev.notes }));
        } catch (e) { showToast("فشل المساعد الذكي في تحليل الرابط.", "error"); } finally { setIsAILoading(false); }
    };

    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (e) => {
                const img = new Image();
                img.src = e.target?.result as string;
                img.onload = async () => {
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
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                };
            };
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'productImages' | 'receiptImages') => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingImages(true);
            try {
                const files = Array.from(e.target.files) as File[];
                const compressedResults: string[] = [];
                for (const file of files) {
                    const result = await compressImage(file);
                    compressedResults.push(result);
                }
                if (field === 'productImages') {
                    setProductImagePreviews(prev => {
                        const updated = [...prev, ...compressedResults].slice(0, 10);
                        setFormData(p => ({ ...p, productImages: updated }));
                        return updated;
                    });
                } else {
                    setReceiptImagePreviews(prev => {
                        const updated = [...prev, ...compressedResults].slice(0, 3);
                        setFormData(p => ({ ...p, receiptImages: updated }));
                        return updated;
                    });
                }
            } finally { setIsProcessingImages(false); e.target.value = ''; }
        }
    };

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        if (!formData.clientId) newErrors.clientId = "مطلوب";
        if (!formData.storeId) newErrors.storeId = "مطلوب";
        if (!formData.localOrderId) newErrors.localOrderId = "مطلوب";
        if (!formData.price) newErrors.price = "مطلوب";
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return showToast("يرجى إكمال البيانات المطلوبة", "warning");
        }
        setLocalIsSaving(true);
        try {
            const finalData = { 
                ...formData, 
                commission: financials.calculatedCommission, 
                priceInMRU: financials.totalMRU, 
                productImages: productImagePreviews, 
                receiptImages: receiptImagePreviews, 
                receiptImage: receiptImagePreviews?.[0] || null 
            };
            await onSave(finalData as Order);
            onClose();
        } finally { setLocalIsSaving(false); }
    };

    if (!isOpen) return null;

    const inputClass = (name: string) => `w-full h-[46px] px-4 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm border-gray-300 dark:border-gray-600 font-medium transition-all ${errors[name] ? 'border-red-500' : ''}`;
    const labelClass = "block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase";

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-0 md:p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full h-full md:h-[95vh] md:max-w-5xl md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                <div className="px-6 py-4 md:px-8 md:py-5 border-b dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900">
                    <div>
                        <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            {order ? <Sparkles className="text-primary"/> : <Plus className="text-primary"/>}
                            {order ? t('editOrder') : t('addOrder')}
                        </h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={22} /></button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gray-50/50 dark:bg-black/20">
                    {isFetchingOrder ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="animate-spin text-primary mb-3" size={40}/>
                            <p className="text-gray-500 font-bold">جاري تحميل بيانات الطلب والصور...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                                    <h4 className="font-black text-gray-800 dark:text-white flex items-center gap-2 text-sm"><Tag size={16} className="text-primary"/> الهوية والتواريخ</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className={labelClass}>رقم الطلب المحلي*</label>
                                            <input type="text" name="localOrderId" value={formData.localOrderId || ''} onChange={handleInputChange} className={`${inputClass('localOrderId')} font-mono font-bold text-primary`} placeholder="FCD-1234" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>تاريخ الطلب*</label>
                                            <input type="date" name="orderDate" value={formData.orderDate} onChange={handleInputChange} className={inputClass('orderDate')} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>تاريخ الوصول المتوقع</label>
                                            <input type="date" name="expectedArrivalDate" value={formData.expectedArrivalDate} onChange={handleInputChange} className={inputClass('expectedArrivalDate')} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>{t('client')}*</label>
                                        <SearchableSelect<Client> 
                                            options={clients} 
                                            value={formData.clientId || ''} 
                                            onChange={(val, item) => { 
                                                setFormData(p => ({...p, clientId: val})); 
                                                if (item) setCachedSelectedClient(item); 
                                            }} 
                                            placeholder="بحث..." 
                                            getDisplayValue={(val) => clients.find(c => c.id === val)?.name || cachedSelectedClient?.name || ''} 
                                            renderOption={(c) => (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs">{c.name.charAt(0)}</div>
                                                    <div><p className="font-bold text-sm leading-tight">{c.name}</p><p className="text-[10px] text-gray-500 font-mono mt-0.5">{c.phone}</p></div>
                                                </div>
                                            )} 
                                            valueField="id" 
                                            error={errors.clientId} 
                                            icon={<User size={16}/>} 
                                            onSearch={onClientSearch} 
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('store')}*</label>
                                        <SearchableSelect<Store> 
                                            options={sortedStores} 
                                            value={formData.storeId || ''} 
                                            onChange={(val) => setFormData(p => ({...p, storeId: val}))} 
                                            placeholder="اختر المتجر..." 
                                            getDisplayValue={(val) => stores.find(s => s.id === val)?.name || ''} 
                                            renderOption={(s) => (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">{s.logo ? <img src={s.logo} className="w-full h-full object-contain" /> : <ShoppingBag size={14}/>}</div>
                                                    <span className="text-sm font-bold">{s.name}</span>
                                                </div>
                                            )} 
                                            valueField="id" 
                                            error={errors.storeId} 
                                            icon={<ShoppingBag size={16}/>} 
                                        />
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm"><Link size={18} className="text-blue-500"/> تفاصيل المنتج</div>
                                        <button type="button" onClick={handleMagicFill} disabled={isAILoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black border border-indigo-100 dark:border-indigo-800 hover:scale-105 transition-transform">
                                            {isAILoading ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>} المساعد الذكي
                                        </button>
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClass}>{t('productLinks')}*</label>
                                            {formData.productLinks?.map((link, idx) => (
                                                <div key={idx} className="flex gap-2 items-center mb-2">
                                                    <input type="text" value={link} onChange={e => { const l = [...formData.productLinks!]; l[idx]=e.target.value; setFormData(p=>({...p, productLinks:l})); }} className={inputClass('')} placeholder="رابط المنتج..." />
                                                    {formData.productLinks!.length > 1 && <button onClick={() => { const n = [...formData.productLinks!]; n.splice(idx,1); setFormData(p=>({...p, productLinks:n})); }} className="text-red-500 p-2"><Trash2 size={18}/></button>}
                                                </div>
                                            ))}
                                            <button onClick={() => setFormData(p => ({...p, productLinks: [...(p.productLinks||[]), '']}))} className="text-[10px] font-black text-blue-600 flex items-center gap-1"><Plus size={14}/> رابط إضافي</button>
                                        </div>
                                        <div>
                                            <label className={labelClass}>الملاحظات</label>
                                            <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} rows={3} className={`${inputClass('')} h-auto py-2`} placeholder="مواصفات المنتج..." />
                                        </div>
                                        <div>
                                            <label className={labelClass}>{t('productImages')}</label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                                <label className="h-20 w-20 flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-primary transition-colors">
                                                    {isProcessingImages ? <Loader2 className="animate-spin text-primary"/> : <ImageIcon size={20} className="text-gray-400"/>}
                                                    <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'productImages')} />
                                                </label>
                                                {productImagePreviews.map((src, i) => <div key={i} className="relative h-20 w-20 flex-shrink-0"><img src={src} className="w-full h-full object-cover rounded-xl border"/><button onClick={() => setProductImagePreviews(p => p.filter((_, x) => x !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button></div>)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 text-sm"><DollarSign size={18} className="text-green-500"/> المالية والفوترة</h4>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelClass}>الكمية*</label>
                                                <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} className={inputClass('quantity')} min="1" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>{t('totalPrice')}*</label>
                                                <div className="flex relative">
                                                    <input type="number" name="price" value={formData.price ?? ''} onChange={handleInputChange} className={`${inputClass('price')} text-lg font-black pr-24`} placeholder="0.00" />
                                                    <div className="absolute inset-y-0 right-0 flex items-center">
                                                        <select name="currency" value={formData.currency} onChange={handleInputChange} className="h-full bg-gray-100 dark:bg-gray-700 border-l dark:border-gray-600 rounded-r-xl px-3 text-xs font-black">
                                                            {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                            <div className="flex justify-between items-center mb-1 text-xs"><span className="text-gray-500">قيمة المنتج (MRU):</span><span className="font-mono font-bold">{financials.totalMRU.toLocaleString()}</span></div>
                                            <div className="flex justify-between items-center text-xs"><span className="text-gray-500">عمولة الخدمة:</span><span className="font-mono font-bold text-green-600">+{financials.calculatedCommission.toLocaleString()}</span></div>
                                            <div className="flex justify-between items-center border-t border-blue-100 dark:border-blue-800/50 pt-2 mt-2"><span className="font-black text-gray-700 dark:text-gray-200">الإجمالي الكلي:</span><span className="font-black text-xl text-primary">{financials.totalDue.toLocaleString()} MRU</span></div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className={labelClass}>{t('amountPaid')}*</label>
                                                <div className="flex gap-2">
                                                    <input type="number" name="amountPaid" value={formData.amountPaid ?? ''} onChange={handleInputChange} className={`${inputClass('amountPaid')} font-black text-green-600`} placeholder="0.00" />
                                                    <button type="button" onClick={() => setFormData(p => ({...p, amountPaid: financials.totalDue}))} className="px-4 bg-green-100 text-green-700 rounded-xl font-bold text-xs whitespace-nowrap transition-colors hover:bg-green-200">كامل المبلغ</button>
                                                </div>
                                                {financials.totalDue > 0 && (
                                                    <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border animate-in slide-in-from-top-1 duration-200 ${financials.remaining > 0 ? 'bg-orange-50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-800 text-orange-700 dark:text-orange-400' : 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-800 text-green-700 dark:text-green-400'}`}>
                                                        {financials.remaining > 0 ? <Clock size={14}/> : <CheckCircle2 size={14}/>}
                                                        <span className="text-xs font-bold">
                                                            {financials.remaining > 0 ? `المتبقي: ${financials.remaining.toLocaleString()} MRU` : 'المبلغ مدفوع بالكامل'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="col-span-2">
                                                <label className={labelClass}>وسيلة الدفع</label>
                                                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className={inputClass('paymentMethod')}>
                                                    {paymentMethods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <label className={labelClass}>إيصالات الدفع</label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                                <label className="h-24 w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-green-500 transition-colors">
                                                    {isProcessingImages ? <Loader2 className="animate-spin text-green-600"/> : <Receipt size={24} className="text-gray-400"/>}
                                                    <span className="text-[10px] font-bold mt-1 text-gray-500">رفع إيصال (صورة)</span>
                                                    <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'receiptImages')} />
                                                </label>
                                                {receiptImagePreviews.map((src, i) => (
                                                    <div key={i} className="relative h-24 w-24 flex-shrink-0">
                                                        <img src={src} className="w-full h-full object-cover rounded-xl border border-green-200"/>
                                                        <button onClick={() => setReceiptImagePreviews(p => p.filter((_, x) => x !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 text-sm"><Truck size={18} className="text-orange-500"/> الشحن واللوجستيات</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="col-span-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl flex gap-1">
                                            {[TransportMode.AIR, TransportMode.SEA, TransportMode.LAND].map(mode => (
                                                <button key={mode} onClick={() => setFormData(p => ({...p, transportMode: mode}))} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.transportMode === mode ? 'bg-white dark:bg-gray-600 text-orange-600 shadow-sm' : 'text-gray-500'}`}>{mode === 'air' ? 'جوي' : mode === 'sea' ? 'بحري' : 'بري'}</button>
                                            ))}
                                        </div>
                                        <div><label className={labelClass}>{t('origin')}*</label><select name="originCenter" value={formData.originCenter || ''} onChange={handleInputChange} className={inputClass('originCenter')}>{availableZones.map(z => <option key={z} value={z}>{z}</option>)}</select></div>
                                        <div><label className={labelClass}>{t('shippingType')}</label><div className="flex gap-2"><button onClick={() => setFormData(p => ({...p, shippingType: ShippingType.NORMAL}))} className={`flex-1 h-[40px] rounded-xl border-2 text-xs font-bold ${formData.shippingType === ShippingType.NORMAL ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400'}`}>عادي</button><button onClick={() => setFormData(p => ({...p, shippingType: ShippingType.FAST}))} className={`flex-1 h-[40px] rounded-xl border-2 text-xs font-bold ${formData.shippingType === ShippingType.FAST ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-400'}`}>سريع</button></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 md:p-6 border-t dark:border-gray-800 flex justify-end gap-3 bg-white dark:bg-gray-900">
                    <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-colors">إلغاء</button>
                    <button onClick={handleSubmit} disabled={localIsSaving || isProcessingImages || isFetchingOrder} className="px-10 py-3 bg-primary text-white rounded-xl font-black shadow-xl flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95">
                        {localIsSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        {order ? t('save') : t('addOrder')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderFormModal;

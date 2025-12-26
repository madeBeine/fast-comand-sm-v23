
import React, { useState, useEffect, useContext, useRef } from 'react';
import type { Order, Client, StorageDrawer, AppSettings, ShippingCompany, City } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { STATUS_DETAILS } from '../constants';
import { X, Save, RotateCcw, ShieldCheck, Loader2, Grid3X3, CheckCircle2, Camera, Image as GalleryIcon, Lightbulb, Bike, AlertTriangle, Upload, Calculator, DollarSign, Archive, Trash2, Check, ArrowRight, Bus } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabaseClient';
import StorageSelectorModal from './StorageSelectorModal';

const getStorageSuggestion = (orderToStore: Order, allOrders: Order[], drawers: StorageDrawer[]): { location: string | null; score: number; reasons: string[] } => {
    const occupiedSlots = new Set(allOrders.filter(o => o.status === OrderStatus.STORED).map(o => o.storageLocation).filter(Boolean));
    
    const scoredDrawers = drawers.map(drawer => {
        const ordersInDrawer = allOrders.filter(o => o.storageLocation?.startsWith(drawer.name + '-') && o.status === OrderStatus.STORED);
        if (ordersInDrawer.length >= drawer.capacity) return null;

        let score = 0;
        let reasons: string[] = [];

        if (orderToStore.shipmentId && ordersInDrawer.some(o => o.shipmentId === orderToStore.shipmentId)) {
            score += 40;
            reasons.push("تحتوي على طرود من نفس الشحنة");
        }
        if (ordersInDrawer.some(o => o.clientId === orderToStore.clientId)) {
            score += 25;
            reasons.push("تحتوي على طرود أخرى لنفس العميل");
        }
        const fillPercentage = ordersInDrawer.length / drawer.capacity;
        if (fillPercentage > 0.1 && fillPercentage < 0.9) {
            score += 20;
            reasons.push("جيد لتجميع الطرود معًا");
        }
        return { drawer, score, reasons };
    }).filter((d): d is { drawer: StorageDrawer; score: number; reasons: string[] } => d !== null);

    scoredDrawers.sort((a, b) => b.score - a.score);

    const bestDrawerInfo = scoredDrawers[0];
    const targetDrawerInfo = bestDrawerInfo || (drawers.length > 0 ? { drawer: drawers[0], score: 0, reasons: ['أول درج متاح'] } : null);

    if (!targetDrawerInfo) return { location: null, score: 0, reasons: [] };

    let firstAvailableSlot: string | null = null;
    for (let i = 1; i <= targetDrawerInfo.drawer.capacity; i++) {
        const slotLocation = `${targetDrawerInfo.drawer.name}-${String(i).padStart(2, '0')}`;
        if (!occupiedSlots.has(slotLocation)) {
            firstAvailableSlot = slotLocation;
            break;
        }
    }

    return { location: firstAvailableSlot, score: targetDrawerInfo.score, reasons: targetDrawerInfo.reasons };
};

const OrderStatusModal: React.FC<{
    order: Order | null;
    allOrders: Order[];
    drawers: StorageDrawer[];
    clients: Client[];
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (orderId: string, payload: Partial<Order>) => Promise<void>;
    onRevert: (orderId: string, password?: string) => Promise<boolean>;
    shippingCompanies: ShippingCompany[];
    settings?: AppSettings;
    cities: City[];
}> = ({ order, allOrders, drawers, clients, isOpen, onClose, onUpdate, onRevert, shippingCompanies, settings, cities }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<Order>>({});
    const [files, setFiles] = useState<{ [key: string]: string }>({});
    const [suggestion, setSuggestion] = useState<{ location: string | null; score: number; reasons: string[] } | null>(null);
    const [isReverting, setIsReverting] = useState(false);
    const [password, setPassword] = useState('');
    const [revertError, setRevertError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isStorageSelectorOpen, setStorageSelectorOpen] = useState(false);
    
    // Ref to track last processed order ID to prevent unnecessary resets
    const lastOrderIdRef = useRef<string | null>(null);

    const [appliedRateInfo, setAppliedRateInfo] = useState<{ rate: number, zoneName: string }>({ rate: 0, zoneName: '' });

    const calculateShippingCost = (weight: number, type: ShippingType, originCenter: string | undefined) => {
        const origin = (originCenter || 'Dubai').trim().toLowerCase();
        const zone = settings?.shippingZones?.find(z => z.name.trim().toLowerCase() === origin);
        
        let fastRate = settings?.shippingRates.fast || 450;
        let normalRate = settings?.shippingRates.normal || 280;
        let zoneName = 'السعر العالمي';

        if (zone) {
            fastRate = zone.rates.fast;
            normalRate = zone.rates.normal;
            zoneName = zone.name;
        }

        const shippingRate = type === ShippingType.FAST ? fastRate : normalRate;
        setAppliedRateInfo({ rate: shippingRate, zoneName });
        
        return Math.round(weight * shippingRate);
    };

    useEffect(() => {
        if (isOpen && order) {
            if (lastOrderIdRef.current !== order.id) {
                setFormData({
                    globalOrderId: order.globalOrderId || '',
                    originCenter: order.originCenter || 'Dubai',
                    receivingCompanyId: order.receivingCompanyId || '',
                    trackingNumber: order.trackingNumber || '',
                    weight: order.weight || 0,
                    shippingCost: order.shippingCost,
                    storageLocation: order.storageLocation || '',
                    shippingType: order.shippingType,
                    arrivalDateAtOffice: order.arrivalDateAtOffice || new Date().toISOString().split('T')[0],
                    localDeliveryCost: order.localDeliveryCost || 0,
                });
                
                setFiles({}); 
                lastOrderIdRef.current = order.id;
            }
            
            if(order.status === OrderStatus.ARRIVED_AT_OFFICE){
                setSuggestion(getStorageSuggestion(order, allOrders, drawers));
                calculateShippingCost(formData.weight || order.weight || 0, formData.shippingType || order.shippingType, order.originCenter);
            }

            setIsReverting(false);
            setPassword('');
            setRevertError('');
            setIsSaving(false);
        } else if (!isOpen) {
            lastOrderIdRef.current = null;
        }
    }, [order?.id, isOpen]); 

    if (!isOpen || !order) return null;
    
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
                    const MAX_WIDTH = 1200; 
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
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch (err) {
                    console.warn("Compression error, fallback to original", err);
                    resolve(originalBase64);
                }
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessingImage(true);
        try {
            const base64 = await compressImage(file);
            setFiles(prev => ({ ...prev, [field]: base64 }));
        } catch (error) {
            console.error("Image processing failed", error);
            alert("فشل في معالجة الصورة، يرجى المحاولة مرة أخرى.");
        } finally {
            setIsProcessingImage(false);
            e.target.value = '';
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value };

        if ((name === 'weight' || name === 'shippingType') && order.status === OrderStatus.ARRIVED_AT_OFFICE) {
            const weight = name === 'weight' ? parseFloat(value) : (formData.weight || 0);
            const type = name === 'shippingType' ? value as ShippingType : (formData.shippingType || order.shippingType);
            newFormData.shippingCost = calculateShippingCost(weight, type, order.originCenter);
        }

        if (name === 'localDeliveryCost') {
            newFormData.localDeliveryCost = value === '' ? 0 : parseFloat(value);
        }

        if (name === 'originCenter') {
            newFormData.receivingCompanyId = '';
        }

        setFormData(newFormData);
    };

    const handleLocationSelect = (location: string) => {
        setFormData(prev => ({ ...prev, storageLocation: location }));
        setStorageSelectorOpen(false);
    }

    const handleSave = async () => {
        if (isSaving || isProcessingImage) return;
        setIsSaving(true);
        try {
            const payload: Partial<Order> = { ...formData };
            if (files.orderImages) payload.orderImages = [files.orderImages];
            if (files.trackingImages) payload.trackingImages = [files.trackingImages];
            if (files.hubArrivalImages) payload.hubArrivalImages = [files.hubArrivalImages];
            if (files.weighingImages) payload.weighingImages = [files.weighingImages];
            
            if(order.status === OrderStatus.ARRIVED_AT_OFFICE){
                payload.storageDate = new Date().toISOString();
                payload.localDeliveryCost = formData.localDeliveryCost || 0;
            }

            await onUpdate(order.id, payload);
            setIsSaving(false);
            onClose();
        } catch (e) {
            console.error(e);
            setIsSaving(false);
        }
    };

    const handleRevert = async () => {
        setRevertError('');
        setIsSaving(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: currentUser?.email || '',
                password: password
            });
            if (error) {
                 setRevertError(t('error'));
                 setIsSaving(false);
                 return;
            }
            const success = await onRevert(order.id, password);
            if(!success) setRevertError(t('error'));
        } catch(e) {
            setRevertError(t('error'));
        } finally {
            setIsSaving(false);
        }
    }

    const isFormValid = () => {
        if (isProcessingImage) return false;
        switch (order.status) {
            case OrderStatus.NEW: return !!formData.globalOrderId; 
            case OrderStatus.ORDERED: return !!formData.trackingNumber;
            case OrderStatus.SHIPPED_FROM_STORE: return !!formData.arrivalDateAtOffice; 
            case OrderStatus.ARRIVED_AT_OFFICE: return (formData.weight !== undefined && formData.weight > 0) && !!formData.storageLocation && !!files.weighingImages;
            case OrderStatus.STORED: return !!formData.storageLocation;
            default: return false;
        }
    };
    
    const renderContent = () => {
        const inputClass = "w-full mt-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-light";
        const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300";
        const fileInputLabelClass = "cursor-pointer mt-1 flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-400 rounded-lg hover:border-primary dark:hover:border-secondary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative";
        
        let nextStatusName = '';
        if (order.status === OrderStatus.NEW) nextStatusName = t(STATUS_DETAILS[OrderStatus.ORDERED].name as any);
        else if (order.status === OrderStatus.ORDERED) nextStatusName = t(STATUS_DETAILS[OrderStatus.SHIPPED_FROM_STORE].name as any);
        else if (order.status === OrderStatus.SHIPPED_FROM_STORE) nextStatusName = t(STATUS_DETAILS[OrderStatus.ARRIVED_AT_OFFICE].name as any);
        else if (order.status === OrderStatus.ARRIVED_AT_OFFICE) nextStatusName = t(STATUS_DETAILS[OrderStatus.STORED].name as any);
        else nextStatusName = t('updateStatus');

        switch (order.status) {
            case OrderStatus.NEW:
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>{t('globalOrderId')}*</label>
                                <input type="text" name="globalOrderId" value={formData.globalOrderId || ''} onChange={handleInputChange} className={inputClass} required />
                            </div>
                             <div>
                                <label className={labelClass}>صورة الطلب العالمي ({t('optional')})</label>
                                <label htmlFor="file-order" className={`${fileInputLabelClass} ${files.orderImages ? 'p-0 h-40 overflow-hidden' : ''}`}>
                                    {isProcessingImage ? (
                                        <div className="flex flex-col items-center">
                                            <Loader2 size={24} className="animate-spin text-primary"/>
                                            <span className="text-xs mt-1">جاري المعالجة...</span>
                                        </div>
                                    ) : files.orderImages ? (
                                        <div className="relative w-full h-full group">
                                            <img src={files.orderImages} alt="Order Preview" className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800 rounded-lg"/>
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white text-xs font-bold">تغيير الصورة</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={24} className="text-gray-400"/>
                                            <span className="text-xs text-gray-500">رفع صورة</span>
                                        </>
                                    )}
                                </label>
                                <input id="file-order" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'orderImages')} accept="image/*" />
                            </div>
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.ORDERED:
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>{t('tracking')}*</label>
                                <input type="text" name="trackingNumber" value={formData.trackingNumber || ''} onChange={handleInputChange} className={inputClass} required placeholder="أدخل رقم التتبع" />
                            </div>
                            
                            <div>
                                <label className={labelClass}>صورة التتبع / الشحنة (اختياري)</label>
                                <label htmlFor="file-tracking" className={fileInputLabelClass}>
                                    {isProcessingImage ? (
                                        <Loader2 size={24} className="animate-spin text-primary"/>
                                    ) : files.trackingImages ? (
                                        <div className="relative w-full h-32">
                                            <img src={files.trackingImages} alt="preview" className="w-full h-full object-contain rounded-md" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-md">
                                                <span className="text-white text-xs font-bold">تغيير الصورة</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={24} className="text-gray-400"/>
                                            <span className="text-xs text-gray-500">إرفاق صورة (فاتورة، تتبع...)</span>
                                        </>
                                    )}
                                </label>
                                <input id="file-tracking" type="file" className="hidden" onChange={(e) => handleFileChange(e, 'trackingImages')} accept="image/*" />
                            </div>
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.SHIPPED_FROM_STORE:
                return {
                    title: `${t('updateStatus')}: ${nextStatusName}`,
                    body: (
                        <div className="space-y-4">
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 flex items-start gap-2">
                                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-sm">تأكيد الوصول للمكتب</p>
                                    <p className="text-xs">سيتم تخطي مرحلة الوسيط والطريق لتسريع العملية.</p>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t('arrivalDate')}</label>
                                <input type="date" name="arrivalDateAtOffice" value={formData.arrivalDateAtOffice} onChange={handleInputChange} className={inputClass} />
                            </div>
                        </div>
                    ),
                    manual: true
                };
            case OrderStatus.ARRIVED_AT_OFFICE:
                const client = clients.find(c => c.id === order.clientId);
                const city = cities.find(c => c.id === client?.cityId);
                const isLocal = city?.isLocal;
                const deliveryLabel = isLocal ? 'توصيل محلي' : 'الوكالة (نقل + رسوم)';
                const DeliveryIcon = isLocal ? Bike : Bus;
                const defaultCost = isLocal ? 100 : 200;

                return {
                     title: `عملية التخزين (مطلوب: صورة، وزن، موقع)`,
                     body: (
                         <div className="space-y-4">
                            <div>
                                <label className={labelClass}>صورة الميزان (مطلوب)*</label>
                                {isProcessingImage ? (
                                    <div className="border-2 border-dashed border-primary bg-primary/5 rounded-lg p-8 flex flex-col items-center justify-center gap-3">
                                        <Loader2 size={40} className="animate-spin text-primary"/>
                                        <span className="font-bold text-primary animate-pulse">جاري معالجة الصورة...</span>
                                    </div>
                                ) : files.weighingImages ? (
                                    <div className="border-2 border-dashed border-green-500 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 flex flex-col items-center relative group">
                                        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-lg z-10">
                                            <Check size={16} strokeWidth={4}/>
                                        </div>
                                        <img src={files.weighingImages} alt="preview" className="h-40 w-full object-contain rounded border bg-white mb-3"/>
                                        <button 
                                            onClick={() => setFiles(prev => ({...prev, weighingImages: ''}))}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold text-xs"
                                        >
                                            <Trash2 size={14}/> إزالة الصورة والمحاولة مرة أخرى
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        <label className="cursor-pointer flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 rounded-2xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all active:scale-95 group">
                                            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                <Camera size={32}/>
                                            </div>
                                            <span className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase">فتح الكاميرا</span>
                                            <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'weighingImages')} accept="image/*" capture="environment" />
                                        </label>

                                        <label className="cursor-pointer flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 group">
                                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 group-hover:scale-110 transition-transform">
                                                <GalleryIcon size={32}/>
                                            </div>
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase">معرض الصور</span>
                                            <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'weighingImages')} accept="image/*" />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>{t('weight')}: (kg)*</label>
                                    <input type="number" name="weight" value={formData.weight || ''} onChange={handleInputChange} className={inputClass} step="0.1" placeholder="0.0" />
                                </div>
                                <div>
                                    <label className={labelClass}>{t('shippingType')}</label>
                                    <select name="shippingType" value={formData.shippingType} onChange={handleInputChange} className={inputClass}>
                                        <option value={ShippingType.NORMAL}>{t('normal')}</option>
                                        <option value={ShippingType.FAST}>{t('fast')}</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 text-sm">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-gray-500 font-bold flex items-center gap-1"><Calculator size={16} className="text-primary"/> تكلفة الشحن المقدرة:</span>
                                    <span className="font-black font-mono text-primary text-xl">{Math.round(formData.shippingCost || 0).toLocaleString()} <span className="text-xs">MRU</span></span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                    <span>المصدر: {order.originCenter || 'Dubai'} ({appliedRateInfo.zoneName})</span>
                                    <span>السعر: {appliedRateInfo.rate} MRU/KG</span>
                                </div>
                            </div>

                            {/* --- Delivery & Agency Options (Dynamic) --- */}
                            <div className="p-4 rounded-2xl border bg-gray-50 dark:bg-gray-800 dark:border-gray-700 space-y-3">
                                <div className="flex justify-between items-center">
                                    <h5 className="font-bold flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                        خدمات {isLocal ? 'التوصيل' : 'الوكالة'}
                                    </h5>
                                    {city && <span className="text-xs font-bold px-2 py-1 bg-white dark:bg-gray-700 rounded border dark:border-gray-600">{city.name}</span>}
                                </div>
                                
                                <div className="flex gap-2">
                                    <div 
                                        onClick={() => {
                                            const current = formData.localDeliveryCost || 0;
                                            setFormData(prev => ({ ...prev, localDeliveryCost: current === defaultCost ? 0 : defaultCost }));
                                        }}
                                        className={`flex-1 p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center gap-1 ${ (formData.localDeliveryCost || 0) > 0 ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400'}`}
                                    >
                                        <DeliveryIcon size={20}/>
                                        <span className="text-xs font-bold">{deliveryLabel}</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2 rounded-xl border dark:border-gray-600">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-300">القيمة المدخلة:</span>
                                    <input 
                                        type="number" 
                                        name="localDeliveryCost"
                                        value={formData.localDeliveryCost || ''} 
                                        onChange={handleInputChange} 
                                        className="flex-grow p-1 bg-transparent outline-none font-mono font-bold text-sm text-gray-900 dark:text-white text-left"
                                        placeholder="0"
                                    />
                                    <span className="text-[10px] font-bold text-gray-400">MRU</span>
                                </div>
                            </div>

                             <div>
                                <label className={labelClass}>{t('location')}*</label>
                                <div 
                                    onClick={() => setStorageSelectorOpen(true)}
                                    className={`w-full mt-1 p-4 border-2 rounded-2xl flex justify-between items-center cursor-pointer transition-all hover:border-primary shadow-sm ${formData.storageLocation ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 border-dashed bg-white dark:bg-gray-700'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${formData.storageLocation ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-gray-600 text-gray-400'}`}>
                                            <Grid3X3 size={24}/>
                                        </div>
                                        {formData.storageLocation ? (
                                            <span className="font-black text-2xl text-green-700 dark:text-green-400 tracking-tighter">{formData.storageLocation}</span>
                                        ) : (
                                            <span className="text-gray-400 font-bold">انقر لتحديد موقع التخزين</span>
                                        )}
                                    </div>
                                    <ArrowRight size={20} className="text-gray-300"/>
                                </div>
                            </div>
                         </div>
                     ),
                     manual: true
                }
            case OrderStatus.STORED:
                return {
                    title: "إدارة حالة المخزون",
                    body: (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-800 dark:text-blue-200 flex items-center gap-3">
                            <Archive size={24} />
                            <div>
                                <p className="font-semibold">الطلب موجود حالياً في المخزن.</p>
                                <p className="text-xs mt-1">الموقع: {order.storageLocation}</p>
                            </div>
                        </div>
                    ),
                    manual: false
                };
            case OrderStatus.COMPLETED:
                return {
                    title: "حالة الطلب: مكتمل",
                    body: (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-800 dark:text-green-200 flex items-center gap-3">
                            <CheckCircle2 size={24} />
                            <div>
                                <p className="font-semibold">هذا الطلب مكتمل وتم تسليمه للعميل.</p>
                                <p className="text-xs mt-1">تاريخ التسليم: {order.withdrawalDate ? new Date(order.withdrawalDate).toLocaleDateString() : '---'}</p>
                            </div>
                        </div>
                    ),
                    manual: false
                };
            default:
                return { title: t('updateStatus'), body: null, manual: false };
        }
    };
    
    const { title, body, manual } = renderContent();

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-2 md:p-4 backdrop-blur-sm" onClick={onClose}>
                <div className="bg-content-light dark:bg-content-dark rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-6 md:p-8 border-b dark:border-gray-700 flex-shrink-0">
                        <h3 className="text-xl font-black text-gray-800 dark:text-white">{title}</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-6 md:p-8 custom-scrollbar">
                        {body}
                        
                        {isReverting && (
                            <div className="mt-4 p-5 border-2 border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/30 rounded-3xl animate-in slide-in-from-top-2">
                                <h4 className="font-black text-yellow-800 dark:text-yellow-200 flex items-center gap-2 mb-3">
                                    <AlertTriangle size={18}/> تأكيد التراجع
                                </h4>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('password')}
                                    className="w-full p-3 border-2 border-yellow-300 dark:border-yellow-800 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-yellow-500 outline-none text-gray-900 dark:text-white"
                                />
                                {revertError && <p className="text-red-500 text-xs font-bold mt-2">{revertError}</p>}
                                <button onClick={handleRevert} disabled={isSaving} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 disabled:opacity-50 font-black shadow-lg">
                                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} تأكيد التراجع النهائي
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-6 md:p-8 border-t dark:border-gray-700 flex justify-end gap-3 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-[2.5rem]">
                        {currentUser?.permissions.orders.revertStatus && order.status !== OrderStatus.NEW && !isReverting && (
                            <button
                                onClick={() => setIsReverting(true)}
                                className="flex items-center gap-2 px-5 py-3 text-sm bg-white dark:bg-gray-800 text-yellow-600 border-2 border-yellow-100 dark:border-yellow-900/50 rounded-xl hover:bg-yellow-50 transition-all font-bold"
                            >
                                <RotateCcw size={16} /> تراجع خطوة
                            </button>
                        )}
                        {manual && (
                            <button
                                onClick={handleSave}
                                disabled={!isFormValid() || isSaving || isProcessingImage}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-10 py-3 bg-primary text-white rounded-xl shadow-xl shadow-primary/30 hover:bg-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:shadow-none transition-all transform active:scale-95 font-black text-lg"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={22} /> : <Save size={22} />}
                                {t('save')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <StorageSelectorModal 
                isOpen={isStorageSelectorOpen}
                onClose={() => setStorageSelectorOpen(false)}
                onSelect={handleLocationSelect}
                drawers={drawers}
                allOrders={allOrders}
                suggestedLocation={suggestion?.location || null}
                clients={clients}
            />
        </>
    );
};

export default OrderStatusModal;

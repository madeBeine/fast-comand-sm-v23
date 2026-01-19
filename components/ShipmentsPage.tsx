
import React, { useState, useEffect, useContext, useMemo } from 'react';
import type { Shipment, Order, ShippingCompany, ActivityLog, Client, Store, Box } from '../types';
import { ShipmentStatus, ShippingType, OrderStatus, TransportMode } from '../types';
import { 
    PlusCircle, Truck, CheckCircle, PackagePlus, AlertCircle, X, Save, Zap, 
    Upload, Edit2, ScrollText, GitCommit, Box as BoxIcon, Info, Eye, Search, 
    AlertOctagon, TrendingUp, TrendingDown, DollarSign, Plane, Ship, 
    Calendar, MapPin, Scale, Loader2, Container, Weight
} from 'lucide-react';
import type { AppSettings } from '../types';
import HistoryLogModal from './HistoryLogModal';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ShipmentsPageProps {
  shipments: Shipment[];
  setShipments: React.Dispatch<React.SetStateAction<Shipment[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  shippingCompanies: ShippingCompany[];
  settings: AppSettings;
  clients: Client[];
  stores: Store[];
}

type ModalMode = 'new' | 'edit';
type SmartShipmentFilter = 'all' | 'transit' | 'partial' | 'completed';

// المنقذ النهائي للصور في الهواتف
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

const getStatusInfo = (status: ShipmentStatus) => {
    switch(status) {
        case ShipmentStatus.NEW: return { name: 'جديدة', icon: PackagePlus, color: 'text-gray-600', bg: 'bg-gray-100' };
        case ShipmentStatus.SHIPPED: return { name: 'في الطريق', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-100' };
        case ShipmentStatus.PARTIALLY_ARRIVED: return { name: 'وصول جزئي', icon: GitCommit, color: 'text-orange-600', bg: 'bg-orange-100' };
        case ShipmentStatus.ARRIVED: return { name: 'واصلة', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
        case ShipmentStatus.RECEIVED: return { name: 'مستلمة', icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-100' };
        case ShipmentStatus.DELAYED: return { name: 'متأخرة', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' };
        default: return { name: status, icon: Info, color: 'text-gray-600', bg: 'bg-gray-100' };
    }
};

const ShipmentDetailsModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    shipment: Shipment | null; 
    companyName: string; 
    linkedOrders: Order[];
}> = ({ isOpen, onClose, shipment, companyName, linkedOrders }) => {
    const [fullShipment, setFullShipment] = useState<Shipment | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && shipment && supabase) {
            const fetchFull = async () => {
                setIsLoading(true);
                try {
                    const { data } = await supabase.from('Shipments').select('*').eq('id', shipment.id).single();
                    if (data) {
                        setFullShipment({
                            ...shipment,
                            receiptImage: data.receipt_image,
                            history: data.history,
                            boxes: data.boxes
                        });
                    }
                } catch (e) {
                    setFullShipment(shipment);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchFull();
        } else {
            setFullShipment(null);
        }
    }, [isOpen, shipment]);

    if (!isOpen || !shipment) return null;
    const currentDisplay = fullShipment || shipment;
    const statusInfo = getStatusInfo(currentDisplay.status);
    const arrivedBoxes = currentDisplay.boxes?.filter(b => b.status === 'arrived').length || 0;
    const totalBoxes = currentDisplay.numberOfBoxes || 0;

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[60] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">شحنة رقم</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusInfo.bg} ${statusInfo.color}`}>{statusInfo.name}</span>
                        </div>
                        <h2 className="text-3xl font-black text-gray-800 dark:text-white font-mono">{currentDisplay.shipmentNumber}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-primary mb-2" size={32}/>
                            <p className="text-gray-500">جاري تحميل تفاصيل الشحنة...</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                                    <span className="text-xs text-blue-600 dark:text-blue-300 font-bold block mb-1">شركة الشحن</span>
                                    <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                        <Truck size={18} /> {companyName}
                                    </div>
                                </div>
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">
                                    <span className="text-xs text-purple-600 dark:text-blue-300 font-bold block mb-1">طريقة النقل</span>
                                    <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                        {currentDisplay.transportMode === 'air' ? <Plane size={18}/> : currentDisplay.transportMode === 'sea' ? <Ship size={18}/> : <Truck size={18}/>}
                                        {currentDisplay.transportMode === 'air' ? 'جوي' : currentDisplay.transportMode === 'sea' ? 'بحري' : 'بري'}
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border dark:border-gray-700">
                                    <span className="text-xs text-gray-500 font-bold block mb-1">تاريخ الانطلاق</span>
                                    <div className="flex items-center gap-2 font-mono font-bold">{currentDisplay.departureDate}</div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border dark:border-gray-700">
                                    <span className="text-xs text-gray-500 font-bold block mb-1">الوصول المتوقع</span>
                                    <div className="flex items-center gap-2 font-mono font-bold">{currentDisplay.expectedArrivalDate}</div>
                                </div>
                            </div>

                            <div className="flex gap-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-2xl">
                                <div className="flex-1 text-center">
                                    <p className="text-xs text-gray-500 font-bold uppercase">عدد الصناديق</p>
                                    <p className="text-xl font-black text-primary">{arrivedBoxes} <span className="text-gray-400 text-sm">/ {totalBoxes}</span></p>
                                </div>
                                <div className="w-px bg-gray-300 dark:bg-gray-700"></div>
                                <div className="flex-1 text-center">
                                    <p className="text-xs text-gray-500 font-bold uppercase">الطلبات المرتبطة</p>
                                    <p className="text-xl font-black text-green-600">{linkedOrders.length}</p>
                                </div>
                                <div className="w-px bg-gray-300 dark:bg-gray-700"></div>
                                <div className="flex-1 text-center">
                                    <p className="text-xs text-gray-500 font-bold uppercase">الوزن الكلي</p>
                                    <p className="text-xl font-black text-orange-600">{currentDisplay.totalWeight || 0} <span className="text-xs">KG</span></p>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                    <BoxIcon size={18} className="text-primary"/> تفاصيل الصناديق
                                </h4>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {currentDisplay.boxes?.map((box, idx) => (
                                        <div key={idx} className={`p-2 rounded-lg border text-center text-xs font-bold ${box.status === 'arrived' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                            <p>صندوق #{box.boxNumber}</p>
                                            <p className="text-[10px] opacity-70">{box.status === 'arrived' ? 'وصل' : 'بالطريق'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {currentDisplay.receiptImage && (
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                                        <ScrollText size={18} className="text-primary"/> إيصال الشحنة
                                    </h4>
                                    <div className="rounded-xl overflow-hidden border dark:border-gray-700">
                                        <img src={currentDisplay.receiptImage} className="w-full object-contain max-h-60 bg-gray-50" alt="Receipt"/>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ShipmentModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (shipment: Partial<Shipment>) => Promise<void>; 
    shipment: Shipment | null; 
    shippingCompanies: ShippingCompany[];
}> = ({ isOpen, onClose, onSave, shipment, shippingCompanies }) => {
    const [formData, setFormData] = useState<Partial<Shipment>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (shipment) {
                const fetchFull = async () => {
                    setIsLoadingDetails(true);
                    try {
                        const { data } = await supabase!.from('Shipments').select('*').eq('id', shipment.id).single();
                        if (data) {
                            setFormData({
                                ...shipment,
                                receiptImage: data.receipt_image,
                                boxes: data.boxes || []
                            });
                        }
                    } finally {
                        setIsLoadingDetails(false);
                    }
                };
                fetchFull();
            } else {
                setFormData({
                    shipmentNumber: `SH-${Math.floor(Math.random() * 10000)}`,
                    status: ShipmentStatus.NEW,
                    transportMode: TransportMode.AIR,
                    numberOfBoxes: 1,
                    departureDate: new Date().toISOString().split('T')[0],
                    expectedArrivalDate: '',
                    boxes: []
                });
            }
        }
    }, [isOpen, shipment]);

    const handleSave = async () => {
        if (!formData.shippingCompanyId || !formData.shipmentNumber) return;
        setIsSaving(true);
        try {
            const boxes: Box[] = formData.boxes && formData.boxes.length > 0 
                ? formData.boxes 
                : Array.from({ length: formData.numberOfBoxes || 1 }, (_, i) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    boxNumber: i + 1,
                    status: 'in_transit'
                }));

            await onSave({ ...formData, boxes });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setIsProcessing(true);
            try {
                const b64 = await compressImage(e.target.files[0]);
                setFormData(p => ({ ...p, receiptImage: b64 }));
            } finally {
                setIsProcessing(false);
            }
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all";
    const labelClass = "block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase";

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[60] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-black text-gray-800 dark:text-white">{shipment ? 'تعديل الشحنة' : 'إضافة شحنة جديدة'}</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><X size={24}/></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {isLoadingDetails ? (
                        <div className="flex flex-col items-center justify-center h-40">
                            <Loader2 className="animate-spin text-primary mb-2"/>
                            <p className="text-xs text-gray-500">جاري التحميل...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className={labelClass}>رقم الشحنة</label>
                                <input type="text" value={formData.shipmentNumber} onChange={e => setFormData({...formData, shipmentNumber: e.target.value})} className={inputClass} placeholder="SH-..." />
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>شركة الشحن</label>
                                <select value={formData.shippingCompanyId || ''} onChange={e => setFormData({...formData, shippingCompanyId: e.target.value})} className={inputClass}>
                                    <option value="">اختر شركة...</option>
                                    {shippingCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>طريقة النقل</label>
                                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
                                    {[TransportMode.AIR, TransportMode.SEA, TransportMode.LAND].map(m => (
                                        <button 
                                            key={m} 
                                            onClick={() => setFormData({...formData, transportMode: m})}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${formData.transportMode === m ? 'bg-white dark:bg-gray-600 text-primary shadow-sm' : 'text-gray-500'}`}
                                        >
                                            {m === 'air' ? <Plane size={14}/> : m === 'sea' ? <Ship size={14}/> : <Truck size={14}/>}
                                            {m === 'air' ? 'جوي' : m === 'sea' ? 'بحري' : 'بري'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>عدد الصناديق</label>
                                <input type="number" value={formData.numberOfBoxes || 1} onChange={e => setFormData({...formData, numberOfBoxes: parseInt(e.target.value)})} className={inputClass} min="1" disabled={!!shipment} />
                            </div>
                            <div>
                                <label className={labelClass}>تاريخ الانطلاق</label>
                                <input type="date" value={formData.departureDate || ''} onChange={e => setFormData({...formData, departureDate: e.target.value})} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>الوصول المتوقع</label>
                                <input type="date" value={formData.expectedArrivalDate || ''} onChange={e => setFormData({...formData, expectedArrivalDate: e.target.value})} className={inputClass} />
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>رقم الحاوية (اختياري)</label>
                                <div className="relative">
                                    <Container className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input type="text" value={formData.containerNumber || ''} onChange={e => setFormData({...formData, containerNumber: e.target.value})} className={`${inputClass} pl-10`} placeholder="CONT-123456" />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>صورة الإيصال</label>
                                <label className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    {isProcessing ? <Loader2 className="animate-spin text-primary"/> : <Upload className="text-gray-400 mr-2"/>}
                                    <span className="text-sm font-bold text-gray-500">{formData.receiptImage ? 'تم الرفع (اضغط للتغيير)' : 'رفع صورة'}</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFile} disabled={isProcessing} />
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-3xl">
                    <button onClick={onClose} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">إلغاء</button>
                    <button onClick={handleSave} disabled={isSaving || isProcessing || isLoadingDetails} className="px-8 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        حفظ الشحنة
                    </button>
                </div>
            </div>
        </div>
    );
};

const ShipmentStatusUpdateModal: React.FC<{
    isOpen: boolean; 
    onClose: () => void; 
    shipment: Shipment | null; 
    onUpdateStatus: (id: string, status: ShipmentStatus, boxes: Box[]) => Promise<void>;
}> = ({ isOpen, onClose, shipment, onUpdateStatus }) => {
    const [selectedStatus, setSelectedStatus] = useState<ShipmentStatus>(ShipmentStatus.NEW);
    const [boxes, setBoxes] = useState<Box[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && shipment) {
            setSelectedStatus(shipment.status);
            const fetchFull = async () => {
                setIsLoading(true);
                try {
                    const { data } = await supabase!.from('Shipments').select('boxes').eq('id', shipment.id).single();
                    setBoxes(data?.boxes || []);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchFull();
        }
    }, [isOpen, shipment]);

    const handleBoxToggle = (boxId: string) => {
        setBoxes(prev => prev.map(b => b.id === boxId ? { ...b, status: b.status === 'arrived' ? 'in_transit' : 'arrived' } : b));
    };

    const handleSave = async () => {
        if (!shipment) return;
        setIsSaving(true);
        try {
            let finalStatus = selectedStatus;
            const allArrived = boxes.every(b => b.status === 'arrived');
            const someArrived = boxes.some(b => b.status === 'arrived');

            if (allArrived && selectedStatus !== ShipmentStatus.RECEIVED) finalStatus = ShipmentStatus.ARRIVED;
            else if (someArrived && !allArrived) finalStatus = ShipmentStatus.PARTIALLY_ARRIVED;

            await onUpdateStatus(shipment.id, finalStatus, boxes);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !shipment) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[130] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 bg-gray-50/50">
                    <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <Zap className="text-yellow-500"/> تحديث حالة الشحنة
                    </h3>
                    <p className="text-sm text-gray-500 font-mono mt-1">{shipment.shipmentNumber}</p>
                </div>

                <div className="p-6 space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center py-10">
                            <Loader2 className="animate-spin text-primary"/>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">الحالة العامة</label>
                                <select 
                                    value={selectedStatus} 
                                    onChange={(e) => setSelectedStatus(e.target.value as ShipmentStatus)} 
                                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-bold"
                                >
                                    <option value={ShipmentStatus.NEW}>جديدة</option>
                                    <option value={ShipmentStatus.SHIPPED}>تم الشحن (في الطريق)</option>
                                    <option value={ShipmentStatus.PARTIALLY_ARRIVED}>وصول جزئي</option>
                                    <option value={ShipmentStatus.ARRIVED}>واصلة (الكل)</option>
                                    <option value={ShipmentStatus.RECEIVED}>مستلمة (مكتمل)</option>
                                    <option value={ShipmentStatus.DELAYED}>متأخرة</option>
                                </select>
                            </div>

                            {(selectedStatus === ShipmentStatus.PARTIALLY_ARRIVED || selectedStatus === ShipmentStatus.ARRIVED) && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">تحديد الصناديق الواصلة</label>
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        {boxes.map(box => (
                                            <button 
                                                key={box.id}
                                                onClick={() => handleBoxToggle(box.id)}
                                                className={`p-2 rounded-lg border text-xs font-bold transition-all ${box.status === 'arrived' ? 'bg-green-50 text-white border-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                #{box.boxNumber}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-[10px] text-gray-400">
                                        <span>انقر على الصندوق لتغيير حالته</span>
                                        <span>{boxes.filter(b => b.status === 'arrived').length} / {boxes.length} وصل</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 rounded-xl">إلغاء</button>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg flex items-center gap-2">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        تحديث
                    </button>
                </div>
            </div>
        </div>
    );
};

const ShipmentCard: React.FC<{ 
    shipment: Shipment; 
    linkedOrders: Order[]; 
    companyName: string; 
    onUpdate: () => void; 
    onEdit: () => void; 
    onHistory: () => void; 
    onView: () => void 
}> = ({ shipment, linkedOrders, companyName, onUpdate, onEdit, onHistory, onView }) => {
    const { currentUser } = useContext(AuthContext);
    
    const financials = useMemo(() => {
        const totalRevenue = linkedOrders.reduce((sum, o) => sum + (o.shippingCost || 0), 0);
        return { totalRevenue };
    }, [linkedOrders]);

    const statusInfo = getStatusInfo(shipment.status);
    const StatusIcon = statusInfo.icon;
    const arrivedBoxes = shipment.boxes?.filter(b => b.status === 'arrived').length || 0;
    const progress = shipment.numberOfBoxes > 0 ? (arrivedBoxes / shipment.numberOfBoxes) * 100 : 0;
    
    const ModeIcon = shipment.transportMode === 'air' ? Plane : shipment.transportMode === 'sea' ? Ship : Truck;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${statusInfo.bg} ${statusInfo.color}`}>
                            <StatusIcon size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-gray-800 dark:text-white font-mono leading-none tracking-tight">
                                {shipment.shipmentNumber}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-gray-500 font-bold mt-1">
                                <ModeIcon size={12}/> 
                                <span>{companyName}</span>
                                {shipment.containerNumber && <span className="bg-blue-50 text-blue-600 px-1.5 rounded text-[10px] ml-1">{shipment.containerNumber}</span>}
                            </div>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.name}
                    </span>
                </div>
                
                <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono font-bold bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                        <span title="تاريخ الانطلاق">{shipment.departureDate}</span>
                        <span className="text-gray-300">➜</span>
                        <span title="تاريخ الوصول">{shipment.expectedArrivalDate || '---'}</span>
                    </div>

                    <div>
                        <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                            <span>تقدم الوصول</span>
                            <span>{arrivedBoxes} / {shipment.numberOfBoxes}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${shipment.status === ShipmentStatus.DELAYED ? 'bg-red-500' : 'bg-primary'}`} 
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">طلبات: <span className="text-gray-800 dark:text-white">{linkedOrders.length}</span></span>
                    {financials.totalRevenue > 0 && (
                        <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold">
                            {financials.totalRevenue.toLocaleString()} MRU
                        </span>
                    )}
                </div>
                
                <div className="flex gap-1">
                    <button onClick={onView} className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-xl transition-colors"><Eye size={18} /></button>
                    {currentUser?.permissions.shipments.edit && <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 size={18}/></button>}
                    {currentUser?.permissions.shipments.changeStatus && <button onClick={onUpdate} className="p-2 text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors"><Zap size={18}/></button>}
                </div>
            </div>
        </div>
    );
};

const ShipmentsPage: React.FC<ShipmentsPageProps> = ({ shipments, setShipments, orders, setOrders, shippingCompanies, settings, clients, stores }) => {
    const { currentUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const { t } = useLanguage();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [smartFilter, setSmartFilter] = useState<SmartShipmentFilter>('all');
    
    const [isShipmentModalOpen, setShipmentModalOpen] = useState(false);
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [isStatusModalOpen, setStatusModalOpen] = useState(false);
    const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
    const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
    const [historyShipment, setHistoryShipment] = useState<Shipment | null>(null);

    const handleSaveShipment = async (payload: Partial<Shipment>) => {
        if (!supabase) return;
        
        if (payload.id) {
            if(!currentUser?.permissions.shipments.edit) {
                showToast("ليس لديك صلاحية تعديل الشحنات", "error");
                return;
            }
        } else {
            if(!currentUser?.permissions.shipments.create) {
                showToast("ليس لديك صلاحية إنشاء شحنات", "error");
                return;
            }
        }

        const user = currentUser?.username || 'System';
        try {
            const dbPayload: any = {
                shipment_number: payload.shipmentNumber,
                shipping_company_id: payload.shippingCompanyId,
                shipping_type: ShippingType.NORMAL, 
                transport_mode: payload.transportMode,
                departure_date: payload.departureDate,
                expected_arrival_date: payload.expectedArrivalDate,
                number_of_boxes: payload.numberOfBoxes,
                container_number: payload.containerNumber,
                receipt_image: payload.receiptImage,
                status: payload.status,
                boxes: payload.boxes,
                history: [...(payload.history || []), { timestamp: new Date().toISOString(), activity: payload.id ? 'Updated' : 'Created', user }]
            };

            let res;
            if (payload.id) {
                res = await supabase.from('Shipments').update(dbPayload).eq('id', payload.id).select().single();
            } else {
                res = await supabase.from('Shipments').insert(dbPayload).select().single();
            }

            if (res.error) throw res.error;

            const mapped = { 
                ...res.data, 
                shipmentNumber: res.data.shipment_number, 
                shippingType: res.data.shipping_type, 
                transportMode: res.data.transport_mode,
                shippingCompanyId: res.data.shipping_company_id,
                departureDate: res.data.departure_date, 
                expectedArrivalDate: res.data.expected_arrival_date,
                numberOfBoxes: res.data.number_of_boxes,
                containerNumber: res.data.container_number,
                receiptImage: res.data.receipt_image
            };

            setShipments(prev => payload.id ? prev.map(s => s.id === mapped.id ? mapped : s) : [mapped, ...prev]);
            showToast('تم حفظ الشحنة بنجاح', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            // FIXED: Changed setIsShipmentModalOpen to setShipmentModalOpen as defined in state
            setShipmentModalOpen(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: ShipmentStatus, boxes: Box[]) => {
        if (!supabase) return;
        
        if(!currentUser?.permissions.shipments.changeStatus) {
            showToast("ليس لديك صلاحية تغيير حالة الشحنة", "error");
            return;
        }

        const user = currentUser?.username || 'System';
        try {
            const updates = {
                status,
                boxes,
                history: [...(shipments.find(s => s.id === id)?.history || []), { timestamp: new Date().toISOString(), activity: `Status updated to ${status}`, user }]
            };
            
            const { error } = await supabase.from('Shipments').update(updates).eq('id', id);
            if (error) throw error;

            setShipments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
            showToast('تم تحديث الحالة بنجاح', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const filteredShipments = useMemo(() => {
        return shipments.filter(s => {
            const matchesSearch = !searchTerm || s.shipmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) || s.containerNumber?.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesFilter = true;
            if (smartFilter === 'transit') matchesFilter = s.status === ShipmentStatus.SHIPPED || s.status === ShipmentStatus.NEW;
            else if (smartFilter === 'partial') matchesFilter = s.status === ShipmentStatus.PARTIALLY_ARRIVED;
            else if (smartFilter === 'completed') matchesFilter = s.status === ShipmentStatus.ARRIVED || s.status === ShipmentStatus.RECEIVED;

            return matchesSearch && matchesFilter;
        });
    }, [shipments, searchTerm, smartFilter]);

    const stats = useMemo(() => {
        const totalWeight = orders.reduce((sum, o) => sum + (Number(o.weight) || 0), 0);
        return {
            all: shipments.length,
            transit: shipments.filter(s => s.status === ShipmentStatus.SHIPPED || s.status === ShipmentStatus.NEW).length,
            partial: shipments.filter(s => s.status === ShipmentStatus.PARTIALLY_ARRIVED).length,
            completed: shipments.filter(s => s.status === ShipmentStatus.ARRIVED || s.status === ShipmentStatus.RECEIVED).length,
            totalWeight: totalWeight
        };
    }, [shipments, orders]);

    const FilterChip: React.FC<{ id: SmartShipmentFilter; label: string; count: number; icon: any; active: boolean; onClick: () => void; colorClass: string; }> = ({ id, label, count, icon: Icon, active, onClick, colorClass }) => (
        <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm whitespace-nowrap border flex-shrink-0 ${active ? `bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-gray-900 shadow-md transform scale-105` : `bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`}`}>
            <span className={`p-1 rounded-full ${colorClass} ${active ? 'bg-transparent text-current' : ''}`}><Icon size={16} /></span><span>{label}</span>
            {count > 0 && <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${active ? 'bg-white text-black dark:bg-black dark:text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{count}</span>}
        </button>
    );

    return (
        <div className="space-y-6 pb-20">
            <ShipmentModal 
                isOpen={isShipmentModalOpen} 
                onClose={() => setShipmentModalOpen(false)} 
                onSave={handleSaveShipment} 
                shipment={selectedShipment} 
                shippingCompanies={shippingCompanies} 
            />
            <ShipmentStatusUpdateModal
                isOpen={isStatusModalOpen}
                onClose={() => setStatusModalOpen(false)}
                shipment={selectedShipment}
                onUpdateStatus={handleUpdateStatus}
            />
            <ShipmentDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setDetailsModalOpen(false)}
                shipment={selectedShipment}
                companyName={shippingCompanies.find(c => c.id === selectedShipment?.shippingCompanyId)?.name || 'Unknown'}
                linkedOrders={orders.filter(o => o.shipmentId === selectedShipment?.id)}
            />
            <HistoryLogModal 
                isOpen={!!historyShipment} 
                onClose={() => setHistoryShipment(null)} 
                history={historyShipment?.history} 
                title="سجل الشحنة" 
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Truck className="text-primary"/> {t('manageShipments')}</h2>
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-2">
                        <Weight className="text-orange-500" size={18}/>
                        <span className="text-xs font-bold text-gray-500 uppercase">إجمالي الحمولة:</span>
                        <span className="font-mono font-black text-slate-800 dark:text-white">{stats.totalWeight.toFixed(1)} KG</span>
                    </div>
                    {currentUser?.permissions.shipments.create && (
                        <button onClick={() => { setSelectedShipment(null); setShipmentModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl shadow-lg hover:bg-primary-dark transition-all transform hover:scale-105 font-bold">
                            <PlusCircle size={20}/> {t('addShipment')}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex overflow-x-auto pb-2 gap-3 custom-scrollbar -mx-2 px-2 no-scrollbar">
                <FilterChip id="all" label="الكل" count={stats.all} icon={Truck} active={smartFilter === 'all'} onClick={() => setSmartFilter('all')} colorClass="bg-gray-100 text-gray-600"/>
                <FilterChip id="transit" label="في الطريق" count={stats.transit} icon={Zap} active={smartFilter === 'transit'} onClick={() => setSmartFilter('transit')} colorClass="bg-blue-100 text-blue-600"/>
                <FilterChip id="partial" label="وصول جزئي" count={stats.partial} icon={AlertOctagon} active={smartFilter === 'partial'} onClick={() => setSmartFilter('partial')} colorClass="bg-orange-100 text-orange-600"/>
                <FilterChip id="completed" label="واصلة" count={stats.completed} icon={CheckCircle} active={smartFilter === 'completed'} onClick={() => setSmartFilter('completed')} colorClass="bg-green-100 text-green-600"/>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="relative">
                    <input type="text" placeholder="بحث برقم الشحنة، الحاوية، التتبع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-primary text-sm font-bold text-gray-900 dark:text-white transition-all"/>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredShipments.map(shipment => (
                    <ShipmentCard 
                        key={shipment.id} 
                        shipment={shipment} 
                        linkedOrders={orders.filter(o => o.shipmentId === shipment.id)}
                        companyName={shippingCompanies.find(c => c.id === shipment.shippingCompanyId)?.name || 'Unknown'} 
                        onUpdate={() => { setSelectedShipment(shipment); setStatusModalOpen(true); }} 
                        onEdit={() => { setSelectedShipment(shipment); setShipmentModalOpen(true); }} 
                        onHistory={() => setHistoryShipment(shipment)} 
                        onView={() => { setSelectedShipment(shipment); setDetailsModalOpen(true); }} 
                    />
                ))}
            </div>
            {filteredShipments.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <Truck size={64} className="mx-auto mb-4 opacity-10"/>
                    <p className="font-bold">{t('noOrdersFound')}</p>
                </div>
            )}
        </div>
    );
};

export default ShipmentsPage;

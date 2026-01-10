
import React, { useEffect, useState, useRef } from 'react';
import type { Order, Client, Store, ShippingCompany, PaymentTransaction } from '../types';
import { STATUS_DETAILS } from '../constants';
import { X, User, Store as StoreIcon, Calendar, DollarSign, Truck, Package, FileText, Image as ImageIcon, Link as LinkIcon, Loader2, ZoomIn, Plus, Minus, RotateCcw, Wallet, Clock, CreditCard } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    client?: Client;
    store?: Store;
    shippingCompanies?: ShippingCompany[];
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order, client, store, shippingCompanies = [] }) => {
    const [activeTab, setActiveTab] = useState<'info' | 'images' | 'history' | 'payments'>('info');
    const [fullOrder, setFullOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
    
    // Lightbox State
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (isOpen && order) {
            setFullOrder(order);
            // Fetch images and payments if needed
            if (supabase) {
                const fetchDetails = async () => {
                    setIsLoading(true);
                    
                    // Fetch extended order details
                    const { data: orderData } = await supabase.from('Orders').select('*').eq('id', order.id).single();
                    if (orderData) {
                        setFullOrder({
                            ...order,
                            productImages: orderData.product_images || [],
                            receiptImages: orderData.receipt_images || [],
                            trackingImages: orderData.tracking_images || [],
                            weighingImages: orderData.weighing_images || [],
                            hubArrivalImages: orderData.hub_arrival_images || [],
                            orderImages: orderData.order_images || [],
                            receiptImage: orderData.receipt_image
                        });
                    }

                    // Fetch Payment History
                    const { data: payments } = await supabase.from('OrderPayments').select('*').eq('order_id', order.id).order('created_at', { ascending: false });
                    if (payments) {
                        setPaymentHistory(payments.map((p: any) => ({
                            id: p.id,
                            orderId: p.order_id,
                            amount: p.amount,
                            paymentMethod: p.payment_method,
                            receiptImages: p.receipt_images || [],
                            createdAt: p.created_at,
                            createdBy: p.created_by,
                            notes: p.notes
                        })));
                    }

                    setIsLoading(false);
                };
                fetchDetails();
            }
        } else {
            setPreviewImage(null);
            setPaymentHistory([]);
        }
    }, [isOpen, order]);

    // Reset Zoom on image change
    useEffect(() => {
        if (previewImage) {
            setZoomLevel(1);
            setPanPosition({ x: 0, y: 0 });
        }
    }, [previewImage]);

    if (!isOpen || !fullOrder) return null;

    const statusInfo = STATUS_DETAILS[fullOrder.status];
    const productPrice = Number(fullOrder.priceInMRU || 0);
    const commission = Number(fullOrder.commission || 0);
    const shipping = Number(fullOrder.shippingCost || 0);
    const delivery = Number(fullOrder.localDeliveryCost || 0);
    const total = productPrice + commission + shipping + delivery;
    const paid = Number(fullOrder.amountPaid || 0);
    const remaining = total - paid;

    // Consolidate receipt images (Legacy single + New Array)
    const allReceipts = [
        ...(fullOrder.receiptImages || []),
        ...(fullOrder.receiptImage && !fullOrder.receiptImages?.includes(fullOrder.receiptImage) ? [fullOrder.receiptImage] : [])
    ];

    // --- Zoom Handlers ---
    const handleZoomIn = (e?: React.MouseEvent) => { e?.stopPropagation(); setZoomLevel(prev => Math.min(prev + 0.5, 5)); };
    const handleZoomOut = (e?: React.MouseEvent) => { e?.stopPropagation(); setZoomLevel(prev => Math.max(prev - 0.5, 1)); };
    const handleResetZoom = (e?: React.MouseEvent) => { e?.stopPropagation(); setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); };
    const handleWheel = (e: React.WheelEvent) => { if (e.deltaY < 0) setZoomLevel(prev => Math.min(prev + 0.2, 5)); else setZoomLevel(prev => Math.max(prev - 0.2, 1)); };
    const handleMouseDown = (e: React.MouseEvent) => { if (zoomLevel <= 1) return; e.preventDefault(); setIsDragging(true); dragStart.current = { x: e.clientX - panPosition.x, y: e.clientY - panPosition.y }; };
    const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; e.preventDefault(); setPanPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }); };
    const handleMouseUp = () => { setIsDragging(false); };
    const handleTouchStart = (e: React.TouchEvent) => { if (zoomLevel <= 1 || e.touches.length > 1) return; setIsDragging(true); const touch = e.touches[0]; dragStart.current = { x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y }; };
    const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging || e.touches.length > 1) return; const touch = e.touches[0]; setPanPosition({ x: touch.clientX - dragStart.current.x, y: touch.clientY - dragStart.current.y }); };

    return (
        <>
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[60] p-4" onClick={onClose}>
                <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                    
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b dark:border-gray-800 bg-gray-50 dark:bg-black/20">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <FileText className="text-primary"/> تفاصيل الطلب
                                </h2>
                                <span className="font-mono text-lg bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300 font-bold">#{fullOrder.localOrderId}</span>
                            </div>
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${statusInfo?.bgColor} ${statusInfo?.color}`}>
                                {fullOrder.status}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><X size={24}/></button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 overflow-x-auto custom-scrollbar">
                        <button onClick={() => setActiveTab('info')} className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>البيانات الأساسية</button>
                        <button onClick={() => setActiveTab('images')} className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'images' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>المرفقات والصور</button>
                        <button onClick={() => setActiveTab('payments')} className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'payments' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>المدفوعات</button>
                        <button onClick={() => setActiveTab('history')} className={`py-4 px-6 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>سجل التتبع</button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/30 dark:bg-black/10">
                        {activeTab === 'info' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm">
                                        <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase mb-4 flex items-center gap-2"><User size={16}/> العميل والمتجر</h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-bold">
                                                    {client?.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{client?.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono" dir="ltr">{client?.phone}</p>
                                                </div>
                                            </div>
                                            <hr className="dark:border-gray-700"/>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
                                                    <StoreIcon size={20}/>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{store?.name}</p>
                                                    <p className="text-xs text-gray-500">{store?.estimatedDeliveryDays} يوم توصيل</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm">
                                        <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase mb-4 flex items-center gap-2"><Truck size={16}/> الشحن والتتبع</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">نوع الشحن:</span>
                                                <span className="font-bold">{fullOrder.shippingType === 'fast' ? 'سريع' : 'عادي'} ({fullOrder.transportMode || 'جوي'})</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">مركز المصدر:</span>
                                                <span className="font-bold">{fullOrder.originCenter || '-'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">رقم التتبع:</span>
                                                <span className="font-mono font-bold select-all">{fullOrder.trackingNumber || '---'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">الوزن:</span>
                                                <span className="font-bold">{fullOrder.weight} KG</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm">
                                        <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase mb-4 flex items-center gap-2"><DollarSign size={16}/> التفاصيل المالية</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                                <span className="text-gray-600 dark:text-gray-300">سعر المنتج + العمولة</span>
                                                <span className="font-bold font-mono">{Math.round(productPrice + commission).toLocaleString()} MRU</span>
                                            </div>
                                            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                                <span className="text-gray-600 dark:text-gray-300">تكلفة الشحن</span>
                                                <span className="font-bold font-mono">{Math.round(shipping).toLocaleString()} MRU</span>
                                            </div>
                                            <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
                                                <span className="text-gray-600 dark:text-gray-300">التوصيل المحلي</span>
                                                <span className="font-bold font-mono">{Math.round(delivery).toLocaleString()} MRU</span>
                                            </div>
                                            <hr className="border-dashed dark:border-gray-600 my-2"/>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-lg">الإجمالي</span>
                                                <span className="font-black text-xl font-mono text-primary">{Math.round(total).toLocaleString()} MRU</span>
                                            </div>
                                            <div className="flex justify-between items-center text-green-600">
                                                <span className="font-bold">المدفوع</span>
                                                <span className="font-bold font-mono">{Math.round(paid).toLocaleString()} MRU</span>
                                            </div>
                                            <div className={`flex justify-between items-center ${remaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                <span className="font-bold">المتبقي</span>
                                                <span className="font-black font-mono">{Math.round(remaining).toLocaleString()} MRU</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border dark:border-gray-700 shadow-sm">
                                        <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase mb-4 flex items-center gap-2"><LinkIcon size={16}/> روابط المنتجات</h3>
                                        {fullOrder.productLinks && fullOrder.productLinks.length > 0 ? (
                                            <div className="space-y-2">
                                                {fullOrder.productLinks.filter(l => l).map((link, i) => (
                                                    <a key={i} href={link} target="_blank" rel="noreferrer" className="block p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 truncate text-xs transition-colors">
                                                        {link}
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400 italic">لا توجد روابط</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'images' && (
                            <div className="space-y-8">
                                {isLoading ? <Loader2 className="mx-auto animate-spin"/> : (
                                    <>
                                        <ImageSection title="صور المنتج" images={fullOrder.productImages} onImageClick={setPreviewImage} />
                                        <ImageSection title="مرفقات الطلب" images={fullOrder.orderImages} onImageClick={setPreviewImage} />
                                        <ImageSection title="صور الشحن" images={fullOrder.trackingImages} onImageClick={setPreviewImage} />
                                        <ImageSection title="صور الوزن" images={fullOrder.weighingImages} onImageClick={setPreviewImage} />
                                        <ImageSection title="إيصالات الدفع" images={allReceipts} onImageClick={setPreviewImage} />
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'payments' && (
                            <div className="space-y-6">
                                {isLoading ? <Loader2 className="mx-auto animate-spin"/> : (
                                    <>
                                        {paymentHistory.length === 0 ? (
                                            <div className="text-center py-10 text-gray-400">
                                                <Wallet size={48} className="mx-auto mb-2 opacity-20"/>
                                                <p>لا توجد سجلات دفع لهذا الطلب</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {paymentHistory.map(pay => (
                                                    <div key={pay.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-black text-xl text-green-600">{pay.amount.toLocaleString()} MRU</span>
                                                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-bold">{pay.paymentMethod || 'Cash'}</span>
                                                                </div>
                                                                <p className="text-xs text-gray-400 flex items-center gap-2">
                                                                    <Clock size={12}/> {new Date(pay.createdAt).toLocaleDateString()} {new Date(pay.createdAt).toLocaleTimeString()}
                                                                    <User size={12}/> {pay.createdBy || 'System'}
                                                                </p>
                                                            </div>
                                                            {pay.receiptImages && pay.receiptImages.length > 0 && (
                                                                <div className="flex gap-2">
                                                                    {pay.receiptImages.map((img, idx) => (
                                                                        <img 
                                                                            key={idx} 
                                                                            src={img} 
                                                                            className="w-12 h-12 object-cover rounded-lg border cursor-pointer hover:scale-110 transition-transform" 
                                                                            onClick={() => setPreviewImage(img)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {pay.notes && (
                                                            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-xs text-gray-500">
                                                                {pay.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border dark:border-gray-700">
                                <ul className="space-y-6 border-l-2 border-gray-200 dark:border-gray-700 ml-3 pl-6 relative">
                                    {fullOrder.history?.slice().reverse().map((log, i) => (
                                        <li key={i} className="relative">
                                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 border-primary"></div>
                                            <p className="font-bold text-gray-900 dark:text-white">{log.activity}</p>
                                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                <Calendar size={12}/> {new Date(log.timestamp).toLocaleString('en-US')}
                                                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                                <User size={12}/> {log.user}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lightbox */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-center items-center animate-in fade-in duration-200 overflow-hidden"
                    onClick={() => setPreviewImage(null)}
                    onWheel={handleWheel}
                >
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-50" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewImage(null)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"><X size={24}/></button>
                        <div className="flex flex-col gap-2 mt-4 bg-white/10 p-2 rounded-full backdrop-blur-md">
                            <button onClick={handleZoomIn} className="p-3 hover:bg-white/20 rounded-full text-white" title="تكبير"><Plus size={20}/></button>
                            <button onClick={handleZoomOut} className="p-3 hover:bg-white/20 rounded-full text-white" title="تصغير"><Minus size={20}/></button>
                            <button onClick={handleResetZoom} className="p-3 hover:bg-white/20 rounded-full text-white" title="إعادة تعيين"><RotateCcw size={20}/></button>
                        </div>
                    </div>

                    <div 
                        className="relative w-full h-full flex items-center justify-center"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleMouseUp}
                        onClick={e => e.stopPropagation()}
                    >
                        <img 
                            src={previewImage} 
                            style={{ 
                                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                                touchAction: 'none'
                            }}
                            className="max-w-[95%] max-h-[90vh] object-contain select-none pointer-events-auto"
                            draggable={false}
                        />
                    </div>
                </div>
            )}
        </>
    );
};

const ImageSection: React.FC<{ title: string, images?: string[], onImageClick: (src: string) => void }> = ({ title, images, onImageClick }) => {
    if (!images || images.length === 0) return null;
    return (
        <div>
            <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2 text-sm"><ImageIcon size={16}/> {title}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((src, i) => (
                    <div key={i} className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border dark:border-gray-700 cursor-pointer" onClick={() => onImageClick(src)}>
                        <img src={src} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" alt={title} />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="text-white drop-shadow-md" size={24}/>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OrderDetailsModal;

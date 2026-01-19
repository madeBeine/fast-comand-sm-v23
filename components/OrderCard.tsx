
import React, { useState, useRef, useEffect, useContext } from 'react';
import type { Order, Client, Store, User, AppSettings, CompanyInfo } from '../types';
import { OrderStatus, TransportMode, ShippingType } from '../types';
import { STATUS_DETAILS } from '../constants';
import { 
    Edit2, Trash2, Eye, Copy, Check, MoreVertical, Ban, ScrollText, 
    User as UserIcon, MessageCircle, Store as StoreIcon, Globe, MapPin, 
    Share2, CheckCircle, Archive, Printer, RefreshCw, ExternalLink, Layers, X, DollarSign, Clock, Hash, AlertCircle, RotateCcw,
    Plane, Ship, Truck, CheckCircle2, Tag, Download, Loader2, Image as ImageIcon, ChevronRight, Package, Link, Wallet
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import InvoiceModal from './InvoiceModal';
import html2canvas from 'html2canvas';

const getTimeAgo = (dateStr: string) => {
    if (!dateStr) return { text: '--', color: 'gray' };
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return { text: 'اليوم', color: 'emerald' };
    if (days === 1) return { text: 'أمس', color: 'emerald' };
    if (days < 7) return { text: `منذ ${days} أيام`, color: 'blue' };
    if (days < 30) return { text: `منذ ${Math.floor(days/7)} أسابيع`, color: 'orange' };
    return { text: `منذ ${Math.floor(days/30)} أشهر`, color: 'rose' };
};

const Highlight: React.FC<{ text: string; highlight?: string }> = ({ text, highlight }) => {
    if (!highlight || !text) return <>{text}</>;
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return <>{parts.map((part, i) => part.toLowerCase() === highlight.toLowerCase() ? <span key={i} className="bg-yellow-300 text-black rounded px-0.5 font-bold">{part}</span> : part)}</>;
};

interface OrderCardProps { 
    order: Order; 
    client: Client | undefined; 
    store: Store | undefined;
    users: User[] | undefined;
    settings?: AppSettings;
    companyInfo: CompanyInfo | undefined;
    onEdit: () => void; 
    onDelete: () => void; 
    onCancel: () => void;
    onChangeStatus: () => void;
    onUpdatePayment?: (order: Order) => void;
    onHistory: () => void;
    onView: () => void;
    onSplit: () => void;
    onPrintInvoice: (order: Order) => void;
    onSendNotification: (order: Order) => void;
    onShareInvoice: (order: Order) => void;
    onInvoiceSent?: (order: Order) => void;
    onInvoicePrintedLocal?: (order: Order) => void;
    onClientClick?: (client: Client) => void; 
    searchTerm?: string;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, client, store, users = [], companyInfo, onEdit, onDelete, onCancel, onChangeStatus, onUpdatePayment, onHistory, onView, onSplit, onSendNotification, onInvoiceSent, onClientClick, searchTerm }) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const [copied, setCopied] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [labelImage, setLabelImage] = useState<string | null>(null);
    const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);
    const [showLinksModal, setShowLinksModal] = useState(false);

    const statusInfo = STATUS_DETAILS[order.status] || { name: 'st_new', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' };
    
    const productValMRU = Math.round(Number(order.priceInMRU || 0) + Number(order.commission || 0));
    const shippingValMRU = Math.round(Number(order.shippingCost || 0));
    const totalMRU = productValMRU + shippingValMRU + Math.round(Number(order.localDeliveryCost || 0));
    const paidMRU = Math.round(Number(order.amountPaid || 0));
    const remainingMRU = totalMRU - paidMRU;

    const storeColor = store?.color || '#4F46E5';
    const timeAgo = getTimeAgo(order.orderDate);
    const validLinks = (order.productLinks || []).filter(l => l.trim() !== '');

    const isCompleted = order.status === OrderStatus.COMPLETED;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
        };
        if(isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(id);
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(id);
            } catch (e) {
                console.error('Copy failed', e);
            }
            document.body.removeChild(textArea);
        }
        setTimeout(() => setCopied(null), 2000);
    };

    const handleGenerateLabel = async () => {
        if (!labelRef.current || isGeneratingLabel) return;
        setIsGeneratingLabel(true);
        try {
            // Faster fonts ready check
            await document.fonts.ready;
            // Short delay is enough for basic DOM elements
            await new Promise(resolve => setTimeout(resolve, 150)); 

            const canvas = await html2canvas(labelRef.current, {
                scale: 2, // Scale 2 is sufficient for thermal prints and much faster than 3
                backgroundColor: '#ffffff',
                useCORS: true,
                allowTaint: true,
                logging: false,
                onclone: (clonedDoc) => {
                   const el = clonedDoc.getElementById('print-label-container');
                   if (el) {
                       el.style.opacity = '1';
                       el.style.visibility = 'visible';
                       el.style.display = 'block';
                   }
                }
            });
            const image = canvas.toDataURL('image/jpeg', 0.85);
            setLabelImage(image);
            setShowLabelModal(true);
        } catch (error) {
            console.error('Error generating label:', error);
            alert('حدث خطأ أثناء إنشاء الملصق');
        } finally {
            setIsGeneratingLabel(false);
        }
    };

    const handleLinksClick = () => {
        if (validLinks.length === 1) window.open(validLinks[0], '_blank');
        else if (validLinks.length > 1) setShowLinksModal(true);
    };

    const modeIcon = order.transportMode === TransportMode.SEA ? <Ship size={14}/> : order.transportMode === TransportMode.LAND ? <Truck size={14}/> : <Plane size={14}/>;

    const canEdit = currentUser?.permissions.orders.edit;
    const canDelete = currentUser?.permissions.orders.delete;
    const canChangeStatus = currentUser?.permissions.orders.changeStatus;
    const canRevertStatus = currentUser?.permissions.orders.revertStatus;
    const canCreate = currentUser?.permissions.orders.create; 

    return (
        <>
            <InvoiceModal 
                isOpen={showInvoiceModal}
                onClose={() => setShowInvoiceModal(false)}
                order={order}
                client={client || { id: '', name: 'Unknown', phone: '' }}
                store={store || { id: '', name: 'Unknown', estimatedDeliveryDays: 0 }}
                companyInfo={companyInfo || { name: 'Fast Comand', logo: '', email: '', phone: '', address: '' }}
                onSuccess={() => onInvoiceSent && onInvoiceSent(order)}
            />

            {showLinksModal && (
                <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[150] p-4 backdrop-blur-sm" onClick={() => setShowLinksModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Link size={18}/> روابط المنتج</h3>
                            <button onClick={() => setShowLinksModal(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} className="text-gray-500"/></button>
                        </div>
                        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {validLinks.map((link, idx) => (
                                <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors border-b last:border-0 border-gray-100 dark:border-gray-700">
                                    <div className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 p-2 rounded-lg"><ExternalLink size={16}/></div>
                                    <div className="overflow-hidden"><p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate w-full">رابط {idx + 1}</p><p className="text-[10px] text-gray-400 truncate w-full">{link}</p></div>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showLabelModal && labelImage && (
                <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[150] p-4 backdrop-blur-sm" onClick={() => setShowLabelModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b dark:border-gray-700 pb-3">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><Tag size={20} className="text-yellow-500"/> ملصق الطلب</h3>
                            <button onClick={() => setShowLabelModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 flex justify-center"><img src={labelImage} alt="Shipping Label" className="max-w-full h-auto rounded-lg shadow-md border-2 border-white dark:border-gray-700" /></div>
                        <div className="flex gap-3 mt-2"><a href={labelImage} download={`Label-${order.localOrderId}.jpg`} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors shadow-lg"><Download size={20}/> تحميل الصورة</a></div>
                    </div>
                </div>
            )}

            {/* Hidden Label Element for Capture */}
            <div id="print-label-container" style={{ position: 'fixed', top: 0, left: '-9999px', opacity: 0, pointerEvents: 'none', zIndex: -100 }}>
                <div 
                    ref={labelRef} 
                    style={{
                        width: '400px',
                        backgroundColor: '#ffffff',
                        padding: '24px',
                        border: '5px solid #000000',
                        borderRadius: '24px',
                        fontFamily: 'Cairo, sans-serif',
                        color: '#000000',
                        direction: 'rtl',
                        boxSizing: 'border-box',
                        display: 'block'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #000000', paddingBottom: '16px', marginBottom: '20px' }}>
                        <div style={{ background: '#000000', color: '#ffffff', padding: '6px 16px', borderRadius: '10px', fontWeight: '900', fontSize: '24px' }}>
                            {order.weight || 0} KG
                        </div>
                        <div style={{ fontSize: '42px', fontWeight: '900', fontFamily: 'monospace', lineHeight: 1 }}>
                            #{order.localOrderId}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', marginBottom: '32px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '900', display: 'block', marginBottom: '8px', color: '#000000' }}>{client?.name || 'عميل عام'}</span>
                        <span style={{ fontSize: '26px', fontWeight: '800', fontFamily: 'monospace', direction: 'ltr', display: 'block', textAlign: 'right', marginBottom: '8px', color: '#000000' }}>{client?.phone || ''}</span>
                        {client?.address && <span style={{ fontSize: '18px', fontWeight: '600', color: '#333333' }}>{client.address}</span>}
                    </div>
                    <div style={{ borderTop: '4px dashed #000000', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', fontSize: '18px', color: '#000000' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '22px' }}>{store?.name || 'المتجر'}</span>
                            <span style={{ borderLeft: '3px solid #000000', height: '20px' }}></span>
                            <span>العدد: {order.quantity}</span>
                        </div>
                        {order.storageLocation && (
                            <div style={{ fontSize: '28px', background: '#f3f4f6', padding: '6px 14px', borderRadius: '12px', border: '3px solid #000000', fontWeight: '900' }}>
                                {order.storageLocation}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={`
                group bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-soft border border-slate-100 dark:border-slate-700/50 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 relative
                ${order.status === OrderStatus.CANCELLED ? 'opacity-60 grayscale' : ''}
                ${isCompleted ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-90' : ''}
            `}>
                
                <div className="absolute top-0 left-0 right-0 flex justify-center gap-1 z-20">
                    {order.isInvoicePrinted && (
                        <div className="bg-green-500 text-white text-[9px] px-3 py-0.5 rounded-b-lg shadow-sm font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                            <CheckCircle2 size={10} strokeWidth={3} /> فاتورة
                        </div>
                    )}
                    {order.whatsappNotificationSent && (
                        <div className="bg-emerald-600 text-white text-[9px] px-3 py-0.5 rounded-b-lg shadow-sm font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                            <MessageCircle size={10} strokeWidth={3} /> تم التنبيه
                        </div>
                    )}
                </div>

                <div className="h-1.5 w-full" style={{ backgroundColor: isCompleted ? '#64748b' : storeColor }}></div>
                
                <div className="p-5 flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">طلب رقم:</span>
                            <h3 className={`text-xl font-black font-mono leading-none tracking-tighter ${isCompleted ? 'text-gray-600 dark:text-gray-400' : 'text-slate-900 dark:text-white'}`}>
                                <Highlight text={order.localOrderId} highlight={searchTerm} />
                            </h3>
                            <button onClick={() => handleCopy(order.localOrderId, 'id')} className="text-slate-300 hover:text-primary transition-colors">
                                {copied === 'id' ? <Check size={14} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                        </div>
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusInfo.bgColor} ${statusInfo.color}`}>
                            {modeIcon}
                            {t(statusInfo.name as any)}
                        </div>
                    </div>
                    
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-primary hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm border border-transparent hover:border-slate-200"><MoreVertical size={20}/></button>
                        {isMenuOpen && (
                            <div className="absolute left-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl z-20 border dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-left p-1.5">
                                {!isCompleted && canEdit && (
                                    <button onClick={() => {onEdit(); setIsMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold rounded-2xl transition-colors"><Edit2 size={16} className="text-blue-500"/> {t('edit')}</button>
                                )}
                                <button onClick={() => {onHistory(); setIsMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold rounded-2xl transition-colors"><ScrollText size={16} className="text-purple-500"/> {t('history')}</button>
                                {canRevertStatus && (
                                    <button onClick={() => {onChangeStatus(); setIsMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold rounded-2xl transition-colors"><RotateCcw size={16} className="text-orange-500"/> تراجع عن الحالة</button>
                                )}
                                {order.status === OrderStatus.NEW && canCreate && (
                                    <button onClick={() => {onSplit(); setIsMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold rounded-2xl transition-colors text-orange-600"><Layers size={16}/> {t('splitOrder')}</button>
                                )}
                                {!isCompleted && (canEdit || canDelete) && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2"></div>}
                                {!isCompleted && canDelete && (
                                    <button onClick={() => {onDelete(); setIsMenuOpen(false);}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-bold rounded-2xl transition-colors text-red-500"><Trash2 size={16}/> {t('delete')}</button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-2 space-y-4">
                    <div onClick={() => client && onClientClick && onClientClick(client)} className={`flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-[1.8rem] border border-slate-100 dark:border-slate-800 transition-all ${client ? 'cursor-pointer hover:border-primary/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md group/client' : 'bg-gray-100/50 cursor-help border-dashed'}`}>
                        <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 font-black text-xl transition-transform ${client ? 'text-primary group-hover/client:scale-110' : 'text-gray-300 animate-pulse'}`}>
                            {client?.name ? client.name.charAt(0).toUpperCase() : <UserIcon size={24}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <p className={`font-black text-base leading-tight whitespace-normal break-words transition-colors ${client ? 'text-slate-800 dark:text-white group-hover/client:text-primary' : 'text-gray-400 italic'}`}>
                                    {client?.name ? <Highlight text={client.name} highlight={searchTerm} /> : 'جاري جلب بيانات العميل...'}
                                </p>
                                {client && <ChevronRight size={14} className="text-gray-300 group-hover/client:text-primary transition-colors opacity-0 group-hover/client:opacity-100"/>}
                            </div>
                            <p className="text-[11px] text-slate-400 font-bold font-mono tracking-tighter mt-1">{client?.phone || '--- --- ----'}</p>
                            {client?.address && <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate"><MapPin size={10} /> {client.address}</p>}
                        </div>
                        {client && (
                            <a href={`https://wa.me/${client.phone?.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-11 h-11 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90" title="تواصل عبر واتساب">
                                <MessageCircle size={22} fill="currentColor" fillOpacity={0.1}/>
                            </a>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {store?.website ? (
                             <a href={store.website.startsWith('http') ? store.website : `https://${store.website}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-300 border border-transparent group-hover:border-slate-200 hover:text-primary hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors cursor-pointer" title={`زيارة ${store.name}`}>
                                {store?.logo ? <img src={store.logo} className="w-4 h-4 object-contain rounded-sm bg-white p-0.5" alt="store" /> : <StoreIcon size={14} style={{ color: storeColor }} />}
                                <span>{store?.name || 'متجر غير محدد'}</span>
                            </a>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-[10px] font-black text-slate-500 dark:text-slate-300 border border-transparent group-hover:border-slate-200">
                                {store?.logo ? <img src={store.logo} className="w-4 h-4 object-contain rounded-sm bg-white p-0.5" alt="store" /> : <StoreIcon size={14} style={{ color: storeColor }} />}
                                <span>{store?.name || 'متجر غير محدد'}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-[10px] font-black text-purple-600 dark:text-purple-400"><Package size={14}/> العدد: {order.quantity}</div>
                        {order.originCenter && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-[10px] font-black text-indigo-600 dark:text-indigo-400"><Globe size={14}/> {order.originCenter}</div>
                        )}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-${timeAgo.color}-50 dark:bg-${timeAgo.color}-900/30 text-[10px] font-black text-${timeAgo.color}-600 dark:text-${timeAgo.color}-400`}><Clock size={14}/> {timeAgo.text}</div>
                    </div>

                    {(order.trackingNumber || order.globalOrderId) && (
                        <div className="grid grid-cols-2 gap-2">
                            {order.globalOrderId && (
                                <div onClick={() => handleCopy(order.globalOrderId!, 'global')} className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group/global relative">
                                    <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">الرقم العالمي</span>
                                    <div className="flex items-center justify-between"><span className="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300 truncate">{order.globalOrderId}</span><div className="text-gray-300 group-hover/global:text-primary transition-colors">{copied === 'global' ? <Check size={12} className="text-green-500" /> : <Copy size={12}/>}</div></div>
                                </div>
                            )}
                            {order.trackingNumber && (
                                <div onClick={() => handleCopy(order.trackingNumber!, 'track')} className="p-3 bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl border border-dashed border-blue-100 dark:border-blue-900/30 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/track relative">
                                    <span className="block text-[8px] font-bold text-blue-400 uppercase tracking-widest mb-1">رقم التتبع</span>
                                    <div className="flex items-center justify-between"><span className="text-[11px] font-bold font-mono text-gray-700 dark:text-gray-300 truncate">{order.trackingNumber}</span><div className="text-blue-300 group-hover/track:text-blue-500 transition-colors">{copied === 'track' ? <Check size={12} className="text-green-500" /> : <Copy size={12}/>}</div></div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-slate-900 dark:bg-black rounded-[2.2rem] p-5 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="space-y-0.5">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">قيمة الطلب الأصلية</span>
                                <div className="flex items-center gap-1.5"><span className="text-lg font-black font-mono tracking-tighter text-blue-400">{order.price?.toLocaleString()}</span><span className="text-[10px] font-black opacity-50">{order.currency}</span></div>
                            </div>
                            <div className="text-left space-y-0.5">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest text-left">المجموع (MRU)</span>
                                <span className="text-2xl font-black font-mono tracking-tighter block">{totalMRU.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 relative z-10">
                            <div><span className="block text-[8px] font-bold text-slate-500 uppercase mb-1">المدفوع</span><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><span className="text-sm font-black font-mono text-emerald-400">{paidMRU.toLocaleString()}</span></div></div>
                            <div className="border-r border-white/10 pr-3"><span className="block text-[8px] font-bold text-slate-500 uppercase mb-1">{remainingMRU > 0 ? 'المستحق' : 'المتبقي'}</span><div className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${remainingMRU > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div><span className={`text-sm font-black font-mono ${remainingMRU > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{Math.abs(remainingMRU).toLocaleString()}</span></div></div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-5 space-y-3">
                    {!isCompleted && order.status === OrderStatus.ORDERED ? (
                        <button onClick={() => setShowInvoiceModal(true)} className={`w-full py-4 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 group/btn ${order.isInvoicePrinted ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/30' : 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'}`}>
                            {order.isInvoicePrinted ? <CheckCircle2 size={20}/> : <Share2 size={20} className="group-hover/btn:rotate-12 transition-transform"/>} 
                            {order.isInvoicePrinted ? 'تمت المشاركة (مشاركة مجدداً)' : t('printInvoice')}
                        </button>
                    ) : !isCompleted && order.status === OrderStatus.ARRIVED_AT_OFFICE && onChangeStatus && canChangeStatus ? (
                        <button onClick={onChangeStatus} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"><Archive size={20}/> {t('st_stored')}</button>
                    ) : !isCompleted && order.status === OrderStatus.STORED ? (
                        <div className="flex gap-2">
                            <button onClick={() => onSendNotification(order)} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"><MessageCircle size={20}/> {order.whatsappNotificationSent ? 'إعادة التنبيه' : 'تنبيه العميل'}</button>
                            <button onClick={() => onUpdatePayment && onUpdatePayment(order)} className="w-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95" title="تحديث المدفوعات / التسليم"><Wallet size={20}/></button>
                        </div>
                    ) : isCompleted ? (
                        <div className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-2xl font-black text-center flex items-center justify-center gap-2"><CheckCircle2 size={18}/> طلب مكتمل (مؤرشف)</div>
                    ) : null}

                    <div className="flex gap-2">
                        {order.weight && order.weight > 0 ? (
                            <button onClick={handleGenerateLabel} disabled={isGeneratingLabel} className="flex-1 py-3 bg-yellow-400 text-yellow-900 rounded-2xl font-black text-[11px] hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed" title="عرض ملصق الطلب">
                                {isGeneratingLabel ? <Loader2 className="animate-spin" size={16}/> : <Tag size={16}/>}
                                {isGeneratingLabel ? 'جارٍ المعالجة' : 'ملصق'}
                            </button>
                        ) : null}
                        <button onClick={onView} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"><Eye size={16}/> عرض</button>
                        <div className="flex gap-2">
                            {validLinks.length > 0 && (
                                <button onClick={handleLinksClick} className="p-3 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm relative" title="روابط المنتجات">
                                    <ExternalLink size={18}/>
                                    {validLinks.length > 1 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm">{validLinks.length}</span>}
                                </button>
                            )}
                            {!isCompleted && onChangeStatus && canChangeStatus && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED && (
                                <button onClick={onChangeStatus} className="p-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center" title={t('updateStatus')}><RefreshCw size={18}/></button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default OrderCard;

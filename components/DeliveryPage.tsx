
import React, { useState, useMemo, useContext, useEffect } from 'react';
import type { Order, Client, Store, CompanyInfo, AppSettings, City, PaymentMethod, Driver } from '../types';
import { OrderStatus } from '../types';
import { 
    Truck, CheckCircle2, Package, User, MapPin, Phone, 
    ChevronRight, ChevronDown, Loader2, Eye, Box, Grid3X3, 
    Printer, RotateCcw, Archive, Trash2, Calendar, 
    Search, Bike, CheckSquare, Square, 
    MoreVertical, Wallet, Navigation, Clock, GripVertical, ArrowRight, Map, Filter, List, Car, ChevronUp, Scale, Check, ChevronLeft, AlertCircle, HandCoins, CheckCheck, Send, PlayCircle, FileText, XCircle, AlertTriangle, Lock
} from 'lucide-react';
import { supabase, getErrorMessage } from '../supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import DriverManagementModal from './DriverManagementModal';
import DeliveryManifestModal from './DeliveryManifestModal';
import DriverSettlementModal from './DriverSettlementModal';
import OrderDetailsModal from './OrderDetailsModal';
import PaymentModal from './PaymentModal';

export interface DeliveryPageProps {
    orders: Order[];
    clients: Client[];
    stores: Store[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    companyInfo: CompanyInfo;
    settings: AppSettings;
    cities: City[];
    paymentMethods: PaymentMethod[];
    activeTab: 'ready' | 'active';
    setActiveTab: (tab: 'ready' | 'active') => void;
    searchTerm: string;
    isDriverModalOpen: boolean;
    setIsDriverModalOpen: (isOpen: boolean) => void;
}

type InternalTab = 'ready' | 'active' | 'archive';

// Helper to Calculate "Cash To Collect" for a single order based on specific logic
const calculateCashToCollect = (order: Order) => {
    // 1. Calculate Base Debt (Product + Commission + Shipping - PaidSoFar)
    // EXCLUDING delivery fee initially
    const productTotal = Number(order.priceInMRU || 0) + Number(order.commission || 0);
    const shippingTotal = Number(order.shippingCost || 0);
    const alreadyPaid = Number(order.amountPaid || 0);

    const orderBaseValue = productTotal + shippingTotal;
    const baseDebt = Math.max(0, orderBaseValue - alreadyPaid);

    // 2. Driver Fee
    const driverFee = Number(order.localDeliveryCost || 0);

    // 3. Logic:
    // If Prepaid: Collect Base Debt only.
    // If Not Prepaid: Collect Base Debt + Driver Fee.
    
    if (order.isDeliveryFeePrepaid) {
        return baseDebt;
    } else {
        return baseDebt + driverFee;
    }
};

// Safe UUID Generator for Mobile Compatibility
const generateSafeUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// --- Components ---

// Internal Confirmation Modal
const ConfirmModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    message: string;
    confirmText?: string;
    confirmColor?: string;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = "تأكيد", confirmColor = "bg-primary" }) => {
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[200] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-sm p-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4 text-gray-800 dark:text-white">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <AlertTriangle size={24} className="text-orange-500"/>
                    </div>
                    <h3 className="text-lg font-bold">{title}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                    {message}
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        إلغاء
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isLoading}
                        className={`px-6 py-2 rounded-xl text-white font-bold shadow-lg flex items-center gap-2 ${confirmColor} hover:opacity-90 transition-opacity`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18}/> : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Action Button Wrapper
const ActionBtn = ({ onClick, className, children, title, disabled, loading }: any) => (
    <button 
        type="button"
        onClick={(e) => {
            e.stopPropagation(); // Only prevent bubbling, allow normal click
            if (!disabled && !loading && onClick) onClick(e);
        }}
        className={`${className} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} flex items-center justify-center transition-transform active:scale-95`}
        title={title}
        disabled={disabled || loading}
    >
        {loading ? <Loader2 className="animate-spin" size={16}/> : children}
    </button>
);

const CompactStat: React.FC<{ label: string, value: string, icon: any, color: string }> = ({ label, value, icon: Icon, color }) => (
    <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className={`p-1 rounded-md ${color} text-white`}>
            <Icon size={12} />
        </div>
        <div className="flex flex-col leading-none">
            <span className="text-[9px] text-gray-400 font-bold uppercase">{label}</span>
            <span className="text-xs font-black text-gray-800 dark:text-white font-mono">{value}</span>
        </div>
    </div>
);

const RunTableRow: React.FC<{
    run: any;
    onLaunch: () => Promise<void>;
    onSettle: () => void;
    onDelete: () => void; 
    onCompleteOrder: (order: Order) => Promise<void>;
    onReturnOrder: (order: Order) => Promise<void>;
    onConfirmAll: () => void; 
    clients: Client[];
    canProcess: boolean;
}> = ({ run, onLaunch, onSettle, onDelete, onCompleteOrder, onReturnOrder, onConfirmAll, clients, canProcess }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Local loading states for actions
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleAction = async (actionName: string, action: () => Promise<void>) => {
        if (loadingAction) return; 
        setLoadingAction(actionName);
        try {
            await action();
        } finally {
            setLoadingAction(null);
        }
    };
    
    const handleTrigger = (trigger: () => void) => {
        trigger();
    };
    
    const isDraft = run.orders.every((o: Order) => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE);
    const totalOrders = run.orders.length;
    const completedCount = run.orders.filter((o: Order) => o.status === OrderStatus.COMPLETED).length;
    const progress = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0;
    const pendingOrders = run.orders.filter((o: Order) => o.status === OrderStatus.OUT_FOR_DELIVERY);
    const isReadyForSettlement = !isDraft && pendingOrders.length === 0 && !run.isSettled;

    const toggleExpand = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsExpanded(!isExpanded);
    };

    // --- SORTING INSIDE RUN ---
    const sortedRunOrders = useMemo(() => {
        return [...run.orders].sort((a, b) => {
            const isAComp = a.status === OrderStatus.COMPLETED;
            const isBComp = b.status === OrderStatus.COMPLETED;
            if (isAComp && !isBComp) return 1;
            if (!isAComp && isBComp) return -1;
            return b.localOrderId.localeCompare(a.localOrderId, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [run.orders]);

    return (
        <>
            <tr className={`border-b border-gray-100 dark:border-gray-700 transition-all ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-900'}`}>
                {/* Driver Info */}
                <td className="p-3 cursor-pointer group" onClick={toggleExpand}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${isDraft ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'} dark:bg-opacity-20`}>
                            {run.driver.vehicleType === 'Car' ? <Car size={20}/> : run.driver.vehicleType === 'Truck' ? <Truck size={20}/> : <Bike size={20}/>}
                        </div>
                        <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                {run.driver.name}
                                {isDraft && <span className="text-[10px] bg-amber-50 text-white px-2 py-0.5 rounded-full shadow-sm">قيد التجهيز</span>}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <span>{new Date(run.timestamp).toLocaleDateString('en-GB')}</span>
                                <span className="opacity-50">|</span>
                                <span>{new Date(run.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </p>
                        </div>
                    </div>
                </td>

                {/* Progress */}
                <td className="p-3 cursor-pointer" onClick={toggleExpand}>
                    {isDraft ? (
                        <div className="text-xs font-bold text-gray-400">{run.orders.length} طلبات</div>
                    ) : (
                        <div className="flex flex-col gap-1 w-24">
                            <div className="flex justify-between text-[10px] font-bold text-gray-500">
                                <span>{completedCount}/{totalOrders}</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{width: `${progress}%`}}></div>
                            </div>
                        </div>
                    )}
                </td>

                {/* Totals - Calculated from helper */}
                <td className="p-3 text-center cursor-pointer" onClick={toggleExpand}>
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] text-gray-400 mb-0.5">المطلوب تحصيله</span>
                        <span className="font-mono font-black text-sm text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">
                            {run.totalCashToCollect.toLocaleString()}
                        </span>
                    </div>
                </td>
                <td className="p-3 text-center cursor-pointer" onClick={toggleExpand}>
                    <div className="flex flex-col items-center">
                        <span className="text-[9px] text-gray-400 mb-0.5">تم تحصيله</span>
                        <span className={`font-mono font-black text-sm px-2 py-1 rounded-lg ${run.actuallyCollected >= run.totalCashToCollect && run.totalCashToCollect > 0 ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-50'}`}>
                            {run.actuallyCollected.toLocaleString()}
                        </span>
                    </div>
                </td>
                
                {/* Actions */}
                <td className="p-3 text-center cursor-default">
                    <div 
                        className="flex items-center justify-center gap-2" 
                        onClick={e => e.stopPropagation()}
                    >
                        {!run.isSettled ? (
                            <>
                                {isDraft ? (
                                    <>
                                        {canProcess && (
                                            <ActionBtn 
                                                onClick={() => handleAction('launch', onLaunch)} 
                                                loading={loadingAction === 'launch'}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md"
                                            >
                                                انطلاق <ArrowRight size={14}/>
                                            </ActionBtn>
                                        )}
                                        {canProcess && (
                                            <ActionBtn 
                                                onClick={() => handleTrigger(onDelete)}
                                                className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl" 
                                                title="إلغاء المهمة"
                                            >
                                                <Trash2 size={16}/>
                                            </ActionBtn>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <ActionBtn 
                                            onClick={() => handleAction('print', onLaunch)} 
                                            loading={loadingAction === 'print'}
                                            className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl" 
                                            title="طباعة المانيفست"
                                        >
                                            <Printer size={16}/>
                                        </ActionBtn>
                                        
                                        {canProcess && (
                                            <>
                                                {isReadyForSettlement ? (
                                                    <ActionBtn 
                                                        onClick={onSettle} 
                                                        className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 shadow-md flex items-center gap-2"
                                                    >
                                                        <HandCoins size={16}/> تصفية
                                                    </ActionBtn>
                                                ) : (
                                                    <>
                                                        <ActionBtn 
                                                            onClick={() => handleTrigger(onConfirmAll)} 
                                                            className="flex items-center gap-1 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl font-bold text-xs" 
                                                            title="تسليم الكل"
                                                        >
                                                            <CheckCheck size={16}/>
                                                            <span className="hidden xl:inline">تسليم الكل</span>
                                                        </ActionBtn>
                                                        
                                                        <ActionBtn 
                                                            onClick={() => handleTrigger(onDelete)} 
                                                            className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl" 
                                                            title="حذف/إلغاء"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </ActionBtn>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-lg text-xs font-bold flex items-center gap-1 border border-gray-200 dark:border-gray-700">
                                <CheckCircle2 size={14}/> مغلق
                            </span>
                        )}
                        
                        {!canProcess && !run.isSettled && (
                            <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2 py-1 rounded-lg">للمشاهدة فقط</span>
                        )}

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                        
                        <button 
                            className={`p-1.5 text-gray-400 hover:text-primary transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : ''}`} 
                            onClick={toggleExpand}
                        >
                            <ChevronDown size={20}/>
                        </button>
                    </div>
                </td>
            </tr>

            {/* EXPANDED DETAILS */}
            {isExpanded && (
                <tr className="bg-gray-50 dark:bg-black/20 cursor-default">
                    <td colSpan={6} className="p-0">
                        <div 
                            className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 border-b border-gray-100 dark:border-gray-700 shadow-inner" 
                            onClick={e => e.stopPropagation()}
                        >
                            {sortedRunOrders.map((o: Order) => {
                                const client = clients.find(c => c.id === o.clientId);
                                const isCompleted = o.status === OrderStatus.COMPLETED;
                                const isOut = o.status === OrderStatus.OUT_FOR_DELIVERY;
                                const isDraftOrder = o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE;
                                
                                // Consistent Calculation for "Cash To Collect"
                                const cashToCollect = calculateCashToCollect(o);

                                return (
                                    <div key={o.id} className={`relative flex items-center justify-between p-3 rounded-xl border transition-all hover:shadow-md ${isCompleted ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800' : isDraft ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${isCompleted ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                                {isCompleted ? <Check size={14} strokeWidth={3}/> : <Box size={14}/>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-gray-800 dark:text-white font-mono tracking-tight">{o.localOrderId}</span>
                                                    {cashToCollect > 0 && !isCompleted ? (
                                                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">
                                                            مطلوب: {cashToCollect.toLocaleString()}
                                                        </span>
                                                    ) : !isCompleted ? (
                                                        <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold border border-green-200">خالص</span>
                                                    ) : null}
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-bold truncate">{client?.name}</p>
                                            </div>
                                        </div>
                                        
                                        {!run.isSettled && canProcess && (
                                            <div className="flex gap-2">
                                                {!isCompleted && isOut && (
                                                    <ActionBtn 
                                                        onClick={() => onCompleteOrder(o)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm"
                                                        title="تأكيد التسليم"
                                                    >
                                                        <Check size={12}/> تسليم
                                                    </ActionBtn>
                                                )}
                                                <ActionBtn 
                                                    onClick={() => onReturnOrder(o)}
                                                    className="p-1.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100" 
                                                    title={isDraftOrder ? "إزالة" : "إرجاع"}
                                                >
                                                    {isDraftOrder ? <Trash2 size={16}/> : <RotateCcw size={16}/>}
                                                </ActionBtn>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

// --- Main Page ---

const DeliveryPage: React.FC<DeliveryPageProps> = ({ 
    orders, clients, stores, setOrders, companyInfo, settings, cities = [], paymentMethods,
    activeTab: parentActiveTab, setActiveTab: setParentActiveTab, searchTerm, isDriverModalOpen, setIsDriverModalOpen 
}) => {
    const { currentUser } = useContext(AuthContext);
    const { showToast } = useToast();
    
    // Permission Check
    const canProcess = currentUser?.permissions.delivery.process ?? false;
    
    const [internalTab, setInternalTab] = useState<InternalTab>('ready');
    const [selectedViewClientId, setSelectedViewClientId] = useState<string | null>(null);
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    
    const [cityFilter, setCityFilter] = useState<string>('all');

    // Modals
    const [viewOrder, setViewOrder] = useState<Order | null>(null);
    const [manifestData, setManifestData] = useState<{ driver: Driver, orders: Order[] } | null>(null);
    const [tempSelectedDriver, setTempSelectedDriver] = useState<string | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);
    const [settlementData, setSettlementData] = useState<{ driver: Driver, orders: Order[] } | null>(null);
    const [ordersToSettle, setOrdersToSettle] = useState<Order[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void>;
        confirmText?: string;
        confirmColor?: string;
    } | null>(null);

    useEffect(() => {
        if (parentActiveTab === 'ready' && internalTab !== 'ready') setInternalTab('ready');
        else if (parentActiveTab === 'active' && internalTab === 'ready') setInternalTab('active');
    }, [parentActiveTab]);

    const handleTabChange = (tab: InternalTab) => {
        setInternalTab(tab);
        setParentActiveTab(tab === 'ready' ? 'ready' : 'active');
    };

    useEffect(() => {
        const fetchDrivers = async () => {
            if (supabase) {
                const { data } = await supabase.from('Drivers').select('*');
                if (data) setDrivers(data.map((d: any) => ({ ...d, nationalId: d.national_id, vehicleType: d.vehicle_type, vehicleNumber: d.vehicle_number, isActive: d.is_active })));
            }
        };
        fetchDrivers();
    }, []);

    // --- DATA PROCESSING ---
    const clientGroups = useMemo(() => {
        const groups: Record<string, { client: Client, orders: Order[], totalDue: number, totalWeight: number, orderIds: string[], cityId?: string }> = {};
        
        orders.forEach(o => {
            if ((o.status !== OrderStatus.STORED && o.status !== OrderStatus.ARRIVED_AT_OFFICE) || o.deliveryRunId) return;
            const client = clients.find(c => c.id === o.clientId);
            
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!o.localOrderId.toLowerCase().includes(term) && !client?.name.toLowerCase().includes(term) && !client?.phone.includes(term)) return;
            }
            if (cityFilter !== 'all' && client?.cityId !== cityFilter) return;

            if (client) {
                if (!groups[client.id]) {
                    groups[client.id] = { client, orders: [], totalDue: 0, totalWeight: 0, orderIds: [], cityId: client.cityId };
                }
                groups[client.id].orders.push(o);
                groups[client.id].orderIds.push(o.id);
                
                const totalCost = (Number(o.priceInMRU) || 0) + (Number(o.commission) || 0) + (Number(o.shippingCost) || 0) + (Number(o.localDeliveryCost) || 0);
                const paid = (Number(o.amountPaid) || 0);
                const due = Math.max(0, totalCost - paid);
                
                groups[client.id].totalDue += due;
                groups[client.id].totalWeight += (Number(o.weight) || 0);
            }
        });
        
        // Sorting groups by number of orders
        const sortedGroups = Object.values(groups).sort((a, b) => b.orders.length - a.orders.length);
        
        // --- ENSURE ORDERS INSIDE GROUPS ARE SORTED ---
        sortedGroups.forEach(g => {
            g.orders.sort((a, b) => b.localOrderId.localeCompare(a.localOrderId, undefined, { numeric: true, sensitivity: 'base' }));
        });

        return sortedGroups;
    }, [orders, clients, searchTerm, cityFilter]);

    const runsData = useMemo(() => {
        const runs: Record<string, any> = {};
        
        orders.filter(o => o.deliveryRunId).forEach(o => {
            const runKey = o.deliveryRunId!;
            if (!o.driverId) return;
            const driver = drivers.find(d => d.id === o.driverId);
            if (!driver) return;

            if (!runs[runKey]) {
                runs[runKey] = { 
                    runId: runKey, 
                    driver, 
                    orders: [], 
                    totalCashToCollect: 0, 
                    actuallyCollected: 0,
                    completedCount: 0,
                    isSettled: !!o.withdrawalDate, 
                    timestamp: o.history?.find(h => h.activity.includes('Assigned'))?.timestamp || new Date().toISOString()
                };
            }
            runs[runKey].orders.push(o);
            
            if (o.status === OrderStatus.OUT_FOR_DELIVERY || o.status === OrderStatus.COMPLETED) {
                // Consistent calculation using the helper
                const cashToCollect = calculateCashToCollect(o);
                runs[runKey].totalCashToCollect += cashToCollect; 
                
                if (o.status === OrderStatus.COMPLETED) {
                    runs[runKey].completedCount++;
                    // For collected amount, we assume driver collected what was required (cashToCollect)
                    runs[runKey].actuallyCollected += cashToCollect;
                }
            }
            if (!o.withdrawalDate) runs[runKey].isSettled = false;
        });

        const all = Object.values(runs).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return {
            active: all.filter((r: any) => !r.isSettled),
            archive: all.filter((r: any) => r.isSettled)
        };
    }, [orders, drivers]);

    // --- Actions ---

    const handleToggleOrderSelect = (orderId: string) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(orderId)) newSet.delete(orderId);
        else newSet.add(orderId);
        setSelectedOrderIds(newSet);
    };

    const handleSelectAllForClient = (orderIds: string[]) => {
        const allSelected = orderIds.every(id => selectedOrderIds.has(id));
        const newSet = new Set(selectedOrderIds);
        if (allSelected) orderIds.forEach(id => newSet.delete(id));
        else orderIds.forEach(id => newSet.add(id));
        setSelectedOrderIds(newSet);
    };

    const handleQuickAssign = async () => {
        if (!tempSelectedDriver || !supabase) return;
        const driver = drivers.find(d => d.id === tempSelectedDriver);
        const ordersToDispatch = orders.filter(o => selectedOrderIds.has(o.id));
        if (!driver || ordersToDispatch.length === 0) return;

        setIsAssigning(true);
        try {
            // Check if the driver has an active run (not settled)
            const existingDraftRun = orders.find(o => 
                o.driverId === driver.id && 
                o.deliveryRunId && 
                !o.withdrawalDate && 
                o.status !== OrderStatus.OUT_FOR_DELIVERY && 
                o.status !== OrderStatus.COMPLETED
            );

            const runIdToUse = existingDraftRun?.deliveryRunId || generateSafeUUID();
            const isMerging = !!existingDraftRun;

            const orderIds = ordersToDispatch.map(o => o.id);

            const { error } = await supabase.from('Orders').update({
                driver_id: driver.id,
                driver_name: driver.name,
                delivery_run_id: runIdToUse,
                history: [...(ordersToDispatch[0].history || []), { timestamp: new Date().toISOString(), activity: `Assigned to driver ${driver.name} ${isMerging ? '(Merged)' : '(Draft)'}`, user: currentUser?.username }]
            }).in('id', orderIds);

            if (error) throw error;

            setOrders(prev => prev.map(o => {
                if (orderIds.includes(o.id)) {
                    return { ...o, driverId: driver.id, driverName: driver.name, delivery_run_id: runIdToUse, deliveryRunId: runIdToUse };
                }
                return o;
            }));

            showToast(isMerging 
                ? `تم دمج الطلبات مع المهمة الحالية للسائق (${orderIds.length} طلبات).`
                : `تم التكليف بنجاح (${orderIds.length} طلبات).`, 
            'success');
            
            setIsDispatchModalOpen(false);
            setTempSelectedDriver(null);
            setSelectedOrderIds(new Set());
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsAssigning(false);
        }
    };

    const handleLaunchRun = async (prepaidClientIds: Set<string>, feeOverrides: Record<string, number>) => {
        if (!manifestData || !supabase) return;
        const ordersToDispatch = manifestData.orders;
        
        // Update local state first
        setOrders(prev => prev.map(o => {
            if (ordersToDispatch.some(m => m.id === o.id)) {
                const newFee = feeOverrides[o.id] !== undefined ? feeOverrides[o.id] : o.localDeliveryCost;
                return { 
                    ...o, 
                    status: OrderStatus.OUT_FOR_DELIVERY,
                    isDeliveryFeePrepaid: prepaidClientIds.has(o.clientId),
                    localDeliveryCost: newFee
                };
            }
            return o;
        }));

        setManifestData(null); // Close modal immediately

        try {
            // Background DB update
            for (const order of ordersToDispatch) {
                const isPrepaid = prepaidClientIds.has(order.clientId);
                const deliveryFee = feeOverrides[order.id] !== undefined ? feeOverrides[order.id] : order.localDeliveryCost;

                await supabase.from('Orders').update({
                    status: OrderStatus.OUT_FOR_DELIVERY,
                    is_delivery_fee_prepaid: isPrepaid,
                    local_delivery_cost: deliveryFee,
                    history: [...(order.history || []), { timestamp: new Date().toISOString(), activity: `Run Launched (Out for Delivery)`, user: currentUser?.username }]
                }).eq('id', order.id);
            }
            showToast('انطلقت المهمة بنجاح', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const handleDeleteRunTrigger = (run: any) => {
        setConfirmModal({
            isOpen: true,
            title: 'تأكيد حذف المهمة',
            message: 'هل أنت متأكد من حذف المهمة وإرجاع كافة الطلبات للمخزن؟',
            confirmText: 'نعم، حذف واسترجاع',
            confirmColor: 'bg-red-600',
            onConfirm: async () => await handleDeleteRun(run)
        });
    };

    const handleDeleteRun = async (run: any) => {
        const ids = run.orders.map((o: Order) => o.id);
        
        setOrders(prev => prev.map(o => ids.includes(o.id) ? { 
            ...o, 
            status: OrderStatus.STORED, 
            driverId: undefined, 
            driverName: undefined, 
            deliveryRunId: undefined 
        } : o));

        try {
            if (supabase) {
                const { error } = await supabase.from('Orders').update({
                    status: OrderStatus.STORED,
                    driver_id: null,
                    driver_name: null,
                    delivery_run_id: null,
                    history: [...(run.orders[0]?.history || []), { timestamp: new Date().toISOString(), activity: 'Run Deleted (Reset)', user: currentUser?.username }]
                }).in('id', ids);
                
                if (error) throw error;
            }
            showToast('تم حذف المهمة وإرجاع الطلبات', 'success');
        } catch(e: any) { 
            showToast(getErrorMessage(e), 'error'); 
        }
    };

    const handleReturnOrder = async (order: Order) => {
        setOrders(prev => prev.map(o => o.id === order.id ? { 
            ...o, 
            status: OrderStatus.STORED, 
            driverId: undefined, 
            driverName: undefined, 
            deliveryRunId: undefined 
        } : o));

        try {
            if (supabase) {
                const { error } = await supabase.from('Orders').update({
                    status: OrderStatus.STORED,
                    driver_id: null,
                    driver_name: null,
                    delivery_run_id: null,
                    history: [...(order.history || []), { timestamp: new Date().toISOString(), activity: 'Returned/Removed from Run', user: currentUser?.username }]
                }).eq('id', order.id);
                
                if (error) throw error;
            }
            showToast('تم إرجاع الطلب للمخزن', 'info');
        } catch (e: any) { showToast(getErrorMessage(e), 'error'); }
    };

    const handleCompleteOrder = async (order: Order) => {
        // STRICT REQUIREMENT: BLOCK DELIVERY IF WEIGHT IS MISSING
        if (!order.weight || Number(order.weight) <= 0) {
            showToast(`لا يمكن تسليم الطلب #${order.localOrderId} بدون تحديد وزنه. يرجى وزنه أولاً.`, 'error');
            return;
        }

        const user = currentUser?.username || 'System';

        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: OrderStatus.COMPLETED } : o));

        try {
            if (supabase) {
                const { error } = await supabase.from('Orders').update({
                    status: OrderStatus.COMPLETED,
                    payment_method: 'Cash',
                    history: [...(order.history || []), { timestamp: new Date().toISOString(), activity: 'Delivered by Driver', user }]
                }).eq('id', order.id);
                
                if (error) throw error;
            }
            showToast('تم تسليم الطلب (في عهدة السائق)', 'success');
        } catch (e: any) { showToast(getErrorMessage(e), 'error'); }
    };

    const handleConfirmAllRunTrigger = (run: any) => {
        const pending = run.orders.filter((o: Order) => o.status === OrderStatus.OUT_FOR_DELIVERY);
        if (pending.length === 0) return;

        // CHECK IF ANY PENDING ORDERS LACK WEIGHT
        const unweighted = pending.filter((o: Order) => !o.weight || Number(o.weight) <= 0);
        if (unweighted.length > 0) {
            showToast(`يوجد ${unweighted.length} طلبات بدون وزن في هذه المهمة. لا يمكن تسليم الكل قبل تحديد الأوزان.`, 'error');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'تأكيد تسليم الكل',
            message: `هل أنت متأكد من تسليم ${pending.length} طلبات متبقية دفعة واحدة؟`,
            confirmText: 'نعم، تسليم الكل',
            confirmColor: 'bg-green-600',
            onConfirm: async () => await handleConfirmAllRun(run)
        });
    };

    const handleConfirmAllRun = async (run: any) => {
        const pending = run.orders.filter((o: Order) => o.status === OrderStatus.OUT_FOR_DELIVERY);
        if (pending.length === 0) return;
        
        const user = currentUser?.username || 'System';
        const ids = pending.map((o:Order) => o.id);

        setOrders(prev => prev.map(o => {
            if (ids.includes(o.id)) {
                return { ...o, status: OrderStatus.COMPLETED };
            }
            return o;
        }));
        
        try {
            if (supabase) {
                await Promise.all(pending.map((order: Order) => {
                    return supabase.from('Orders').update({
                        status: OrderStatus.COMPLETED,
                        payment_method: 'Cash',
                        history: [...(order.history || []), { timestamp: new Date().toISOString(), activity: 'Bulk Delivered', user }]
                    }).eq('id', order.id);
                }));
            }
            showToast(`تم تسليم ${pending.length} طلبات بنجاح`, 'success');
        } catch (e: any) { showToast(getErrorMessage(e), 'error'); }
    };

    const handleSettleRun = async (run: any) => { setSettlementData({ driver: run.driver, orders: run.orders }); };

    const confirmSettlement = async () => {
        if (!settlementData) return;
        try {
            const completedOrders = settlementData.orders.filter((o: Order) => o.status === OrderStatus.COMPLETED);
            
            if (completedOrders.length > 0 && supabase) {
                const ids = completedOrders.map(o => o.id);
                await supabase.from('Orders').update({ withdrawal_date: new Date().toISOString() }).in('id', ids);

                for (const order of completedOrders) {
                    const total = (Number(order.priceInMRU)||0) + (Number(order.commission)||0) + (Number(order.shippingCost)||0) + (Number(order.localDeliveryCost)||0);
                    
                    await supabase.from('Orders').update({ 
                        amount_paid: total 
                    }).eq('id', order.id);
                }
            }

            setOrders(prev => prev.map(o => {
                const inRun = settlementData.orders.some(so => so.id === o.id);
                if (inRun && o.status === OrderStatus.COMPLETED) {
                    const total = (Number(o.priceInMRU)||0) + (Number(o.commission)||0) + (Number(o.shippingCost)||0) + (Number(o.localDeliveryCost)||0);
                    return { 
                        ...o, 
                        withdrawalDate: new Date().toISOString(),
                        amountPaid: total 
                    };
                }
                return o;
            }));

            showToast('تمت التصفية، استلام الكاش، والأرشفة بنجاح', 'success');
            setSettlementData(null);
        } catch (e: any) { showToast(getErrorMessage(e), 'error'); }
    };

    const handleDirectDelivery = () => {
        const selected = orders.filter(o => selectedOrderIds.has(o.id));
        
        // CHECK WEIGHT REQUIREMENT FOR DIRECT DELIVERY
        const unweighted = selected.filter(o => !o.weight || Number(o.weight) <= 0);
        if (unweighted.length > 0) {
            showToast(`الطلب #${unweighted[0].localOrderId} و ${unweighted.length - 1} أخرى بدون وزن. لا يمكن التسليم المباشر بدون وزن.`, 'error');
            return;
        }

        setOrdersToSettle(selected);
        setIsPaymentModalOpen(true);
    };

    const handleBulkPaymentConfirm = async (orderId: string, paymentDetails: any) => {
        if (!supabase) return;
        try {
            const user = currentUser?.username || 'System';
            const timestamp = new Date().toISOString();
            let remainingPool = paymentDetails.amountPaid;

            for (const order of ordersToSettle) {
                const prevPaid = order.amountPaid || 0;
                const totalCost = (order.priceInMRU || 0) + (order.commission || 0) + (order.shippingCost || 0) + (order.localDeliveryCost || 0);
                const due = Math.max(0, totalCost - prevPaid);
                const allocated = Math.min(remainingPool, due);
                remainingPool -= allocated;
                const newAmountPaid = prevPaid + allocated;

                if (allocated > 0 || paymentDetails.amountPaid === 0) {
                    await supabase.from('OrderPayments').insert({
                        order_id: order.id,
                        amount: allocated,
                        payment_method: paymentDetails.paymentMethod,
                        receipt_images: paymentDetails.receiptImages,
                        created_by: user,
                        notes: ordersToSettle.length > 1 ? `Bulk Payment` : ''
                    });
                }

                await supabase.from('Orders').update({
                    status: OrderStatus.COMPLETED,
                    amount_paid: newAmountPaid,
                    payment_method: paymentDetails.paymentMethod,
                    history: [...(order.history || []), { timestamp, activity: 'Direct Delivery', user }]
                }).eq('id', order.id);
            }

            setOrders(prev => prev.map(o => {
                if (selectedOrderIds.has(o.id)) {
                    return { ...o, status: OrderStatus.COMPLETED, amountPaid: (o.amountPaid || 0) + (paymentDetails.amountPaid / ordersToSettle.length) };
                }
                return o;
            }));
            
            setSelectedOrderIds(new Set());
            setOrdersToSettle([]);
            setIsPaymentModalOpen(false);
            showToast('تم تسليم الطلبات بنجاح', 'success');

        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const overallStats = useMemo(() => ({
        readyOrders: clientGroups.reduce((acc, g) => acc + g.orders.length, 0),
        activeDrivers: runsData.active.length,
        cashOnRoad: runsData.active.reduce((acc: number, r: any) => acc + r.totalCashToCollect, 0)
    }), [clientGroups, runsData]);

    const activeGroup = clientGroups.find(g => g.client.id === selectedViewClientId);

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Confirmation Modal */}
            {confirmModal && (
                <ConfirmModal 
                    isOpen={confirmModal.isOpen} 
                    onClose={() => setConfirmModal(null)} 
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    confirmText={confirmModal.confirmText}
                    confirmColor={confirmModal.confirmColor}
                />
            )}

            {/* Modals */}
            <OrderDetailsModal isOpen={!!viewOrder} onClose={() => setViewOrder(null)} order={viewOrder} client={clients.find(c => c.id === viewOrder?.clientId)} store={stores.find(s => s.id === viewOrder?.storeId)} />
            <DriverManagementModal isOpen={isDriverModalOpen} onClose={() => setIsDriverModalOpen(false)} drivers={drivers} setDrivers={setDrivers} />
            {manifestData && <DeliveryManifestModal isOpen={!!manifestData} onClose={() => setManifestData(null)} driver={manifestData.driver} orders={manifestData.orders} clients={clients} companyInfo={companyInfo} onConfirmDispatch={handleLaunchRun} />}
            {settlementData && <DriverSettlementModal isOpen={!!settlementData} onClose={() => setSettlementData(null)} onConfirm={confirmSettlement} driver={settlementData.driver} orders={settlementData.orders} />}
            <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} onConfirm={handleBulkPaymentConfirm} order={null} bulkOrders={ordersToSettle} paymentMethods={paymentMethods} />

            {/* Header Stats */}
            <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm flex-shrink-0 z-10">
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <CompactStat label="طلبات جاهزة" value={overallStats.readyOrders.toString()} icon={Package} color="bg-blue-500"/>
                        <CompactStat label="سائقين" value={overallStats.activeDrivers.toString()} icon={Bike} color="bg-purple-500"/>
                        <CompactStat label="سيولة متوقعة" value={overallStats.cashOnRoad.toLocaleString()} icon={Wallet} color="bg-green-500"/>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
                        {(['ready', 'active', 'archive'] as const).map(tab => (
                            <button key={tab} onClick={() => handleTabChange(tab)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${internalTab === tab ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                {tab === 'ready' ? 'الانتظار' : tab === 'active' ? 'التوصيل' : 'الأرشيف'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {internalTab === 'ready' && (
                    <>
                        <aside className={`w-full md:w-80 lg:w-96 flex flex-col bg-white dark:bg-gray-800 border-r dark:border-gray-700/50 ${selectedViewClientId ? 'hidden md:flex' : 'flex'}`}>
                            {/* Filter Bar */}
                            <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 sticky top-0">
                                <div className="relative mb-2">
                                    <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full pl-2 pr-8 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary appearance-none text-gray-600 dark:text-gray-300">
                                        <option value="all">كل المدن</option>
                                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={12}/>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {clientGroups.length > 0 ? (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {clientGroups.map(group => {
                                            const isSelected = selectedViewClientId === group.client.id;
                                            return (
                                                <div key={group.client.id} onClick={() => { setSelectedViewClientId(group.client.id); setSelectedOrderIds(new Set()); }} className={`p-4 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 flex justify-between items-center group relative ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                                                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                                                    <div className="min-w-0">
                                                        <h4 className={`font-bold text-sm truncate ${isSelected ? 'text-primary' : 'text-gray-800 dark:text-white'}`}>{group.client.name}</h4>
                                                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{group.client.phone}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-[10px] text-gray-400 mb-0.5">مطلوب</span>
                                                        <span className="font-mono font-bold text-xs text-green-600">{group.totalDue.toLocaleString()}</span>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ml-2 ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                        {group.orders.length}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-400"><p className="text-xs">لا توجد طلبات جاهزة</p></div>
                                )}
                            </div>
                        </aside>
                        
                        {/* Detail View */}
                        <main className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 min-w-0 ${!selectedViewClientId ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
                            {activeGroup ? (
                                <>
                                    <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm flex items-center justify-between flex-shrink-0">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <button onClick={() => setSelectedViewClientId(null)} className="md:hidden p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500"><ArrowRight size={18}/></button>
                                            <div className="min-w-0">
                                                <h2 className="text-lg font-black text-gray-900 dark:text-white truncate">{activeGroup.client.name}</h2>
                                                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                                    <span className="font-mono">{activeGroup.client.phone}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                    <span>{cities.find(c => c.id === activeGroup.cityId)?.name || 'غير محدد'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-[9px] text-gray-400 uppercase font-bold">المجموع</p>
                                            <p className="text-lg font-black text-primary font-mono leading-none">{activeGroup.totalDue.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800/50 border-b dark:border-gray-700 flex justify-between items-center gap-2">
                                        <button onClick={() => handleSelectAllForClient(activeGroup.orderIds)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-colors">
                                            {activeGroup.orderIds.every(id => selectedOrderIds.has(id)) ? <CheckSquare size={14} className="text-primary"/> : <Square size={14}/>}
                                            تحديد الكل ({selectedOrderIds.size})
                                        </button>
                                        {selectedOrderIds.size > 0 && canProcess && (
                                            <div className="flex gap-2">
                                                <button onClick={handleDirectDelivery} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-transform active:scale-95 font-bold text-xs animate-in zoom-in">
                                                    <HandCoins size={14}/> تسليم مباشر
                                                </button>
                                                <button onClick={() => setIsDispatchModalOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-md shadow-sm transition-transform active:scale-95 font-bold text-xs animate-in zoom-in">
                                                    <Truck size={14}/> إسناد سائق
                                                </button>
                                            </div>
                                        )}
                                        {selectedOrderIds.size > 0 && !canProcess && (
                                            <div className="flex items-center gap-2 text-xs text-gray-400 font-bold bg-white dark:bg-gray-800 px-3 py-1.5 rounded border dark:border-gray-700">
                                                <Lock size={12}/> لا تملك صلاحية التسليم
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-white dark:bg-gray-900">
                                        <table className="w-full text-sm text-right border-collapse">
                                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-bold border-b dark:border-gray-700 sticky top-0 z-10 text-xs uppercase tracking-wider">
                                                <tr><th className="p-3 w-10 text-center">#</th><th className="p-3">تفاصيل الطلب</th><th className="p-3 text-center w-24">الوزن</th><th className="p-3 text-center w-28">المطلوب</th><th className="p-3 w-10"></th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {activeGroup.orders.map(order => {
                                                    const due = ((order.priceInMRU || 0) + (order.commission || 0) + (order.shippingCost || 0) + (order.localDeliveryCost || 0) - (order.amountPaid || 0));
                                                    const isSelected = selectedOrderIds.has(order.id);
                                                    return (
                                                        <tr key={order.id} onClick={() => handleToggleOrderSelect(order.id)} className={`cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                                                            <td className="p-3 text-center"><div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600'}`}>{isSelected && <Check size={10} strokeWidth={4}/>}</div></td>
                                                            <td className="p-3"><span className="font-mono font-bold text-gray-800 dark:text-white text-sm block">{order.localOrderId}</span><span className="text-[10px] text-gray-400">{stores.find(s=>s.id===order.storeId)?.name} • {order.storageDate ? new Date(order.storageDate).toLocaleDateString('en-GB') : '-'}</span></td>
                                                            <td className="p-3 text-center text-xs font-bold text-gray-600 dark:text-gray-400 font-mono">{order.weight} KG</td>
                                                            <td className="p-3 text-center"><span className={`font-mono font-black text-sm ${due > 0 ? 'text-red-500' : 'text-green-500'}`}>{due > 0 ? due.toLocaleString() : 'خالص'}</span></td>
                                                            <td className="p-3 text-center"><button onClick={(e) => {e.stopPropagation(); setViewOrder(order);}} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"><Eye size={16}/></button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 select-none"><Package size={64} strokeWidth={1} className="mb-4 opacity-50"/><p className="font-bold text-lg">اختر عميلاً لعرض الطلبات</p></div>
                            )}
                        </main>
                    </>
                )}

                {(internalTab === 'active' || internalTab === 'archive') && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 p-0">
                        <table className="w-full text-right text-sm border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-bold border-b dark:border-gray-700 sticky top-0 z-10 text-xs uppercase">
                                <tr><th className="p-3">السائق</th><th className="p-3">التقدم</th><th className="p-3 text-center">المطلوب تحصيله</th><th className="p-3 text-center">تم تحصيله</th><th className="p-3 text-center">إجراءات</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {(internalTab === 'active' ? runsData.active : runsData.archive).map((run: any) => (
                                    <RunTableRow 
                                        key={run.runId} 
                                        run={run} 
                                        onLaunch={() => setManifestData({ driver: run.driver, orders: run.orders })} 
                                        onSettle={() => handleSettleRun(run)} 
                                        onDelete={() => handleDeleteRunTrigger(run)} 
                                        onCompleteOrder={handleCompleteOrder} 
                                        onReturnOrder={handleReturnOrder} 
                                        onConfirmAll={() => handleConfirmAllRunTrigger(run)} 
                                        clients={clients} 
                                        canProcess={canProcess}
                                    />
                                ))}
                                {(internalTab === 'active' ? runsData.active : runsData.archive).length === 0 && (
                                    <tr><td colSpan={5} className="p-20 text-center text-gray-400"><Bike size={48} strokeWidth={1} className="mx-auto mb-4 opacity-20"/><p>لا توجد رحلات {internalTab === 'active' ? 'نشطة' : 'مؤرشفة'}</p></td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isDispatchModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[130] p-4 backdrop-blur-sm" onClick={() => setIsDispatchModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-base text-gray-800 dark:text-white">اختر السائق للمهمة</h3>
                        </div>
                        <div className="p-2 max-h-80 overflow-y-auto space-y-1 custom-scrollbar">
                            {drivers.filter(d => d.isActive).map(driver => (
                                <button key={driver.id} onClick={() => setTempSelectedDriver(driver.id)} className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group text-right border ${tempSelectedDriver === driver.id ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 border-transparent hover:border-blue-100'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-gray-500 shadow-sm ${tempSelectedDriver === driver.id ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 group-hover:text-blue-600 group-hover:bg-white'}`}>
                                            {driver.vehicleType === 'Car' ? <Car size={14}/> : driver.vehicleType === 'Truck' ? <Truck size={14}/> : <Bike size={14}/>}
                                        </div>
                                        <div><p className={`font-bold text-sm ${tempSelectedDriver === driver.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-white'}`}>{driver.name}</p><p className="text-[10px] text-gray-500 font-mono">{driver.phone}</p></div>
                                    </div>
                                    {tempSelectedDriver === driver.id && <CheckCircle2 size={18} className="text-blue-500"/>}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
                            <button onClick={() => setIsDispatchModalOpen(false)} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg font-bold text-sm">إلغاء</button>
                            <button onClick={handleQuickAssign} disabled={!tempSelectedDriver || isAssigning} className="flex-[2] py-2.5 bg-primary text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors shadow-lg">
                                {isAssigning ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} إسناد (تجهيز)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliveryPage;

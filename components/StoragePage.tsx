import React, { useState, useMemo, useContext } from 'react';
import type { StorageDrawer, Order, Client, Store, CompanyInfo, City } from '../types';
import { OrderStatus } from '../types';
import { 
    PlusCircle, Archive, X, Search, Package, Grid3X3, Activity, 
    Trash2, User, Calendar, MapPin, Box, ArrowRight, LayoutGrid,
    ZoomIn, ChevronRight, Layers, Loader2
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface StoragePageProps {
    drawers: StorageDrawer[];
    setDrawers: React.Dispatch<React.SetStateAction<StorageDrawer[]>>;
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    clients: Client[];
    stores: Store[];
    companyInfo: CompanyInfo;
    cities: City[];
    settings: any;
}

// --- Visual Inspector Component ---
const DrawerInspector: React.FC<{
    drawer: StorageDrawer;
    orders: Order[];
    clients: Client[];
    onClose: () => void;
}> = ({ drawer, orders, clients, onClose }) => {
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    // Filter orders specifically in this drawer
    const drawerOrders = useMemo(() => 
        orders.filter(o => o.status === OrderStatus.STORED && o.storageLocation?.startsWith(drawer.name + '-')),
    [orders, drawer]);

    // Calculate Grid Dimensions
    const rows = drawer.rows || 1;
    const cols = drawer.columns || 1;
    const totalSlots = rows * cols;

    // Helper to get orders in a specific slot (e.g., "A1-05")
    const getOrdersInSlot = (slotIndex: number) => {
        const slotId = String(slotIndex + 1).padStart(2, '0');
        const locationKey = `${drawer.name}-${slotId}`;
        return drawerOrders.filter(o => o.storageLocation === locationKey);
    };

    const selectedOrders = selectedSlot ? getOrdersInSlot(parseInt(selectedSlot) - 1) : [];

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex overflow-hidden border border-gray-200 dark:border-gray-700">
                
                {/* Left Side: Visual Grid */}
                <div className="flex-grow flex flex-col min-w-0 border-r dark:border-gray-800">
                    {/* Header */}
                    <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <LayoutGrid className="text-primary"/> {drawer.name}
                            </h2>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                السعة: {totalSlots} خانة | المشغول: {drawerOrders.length} طلب
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <X size={24} className="text-gray-500"/>
                        </button>
                    </div>

                    {/* Grid Container */}
                    <div className="flex-grow overflow-y-auto p-6 bg-gray-100 dark:bg-black/40 custom-scrollbar">
                        <div 
                            className="grid gap-3 mx-auto"
                            style={{
                                gridTemplateColumns: `repeat(${cols}, minmax(80px, 1fr))`,
                                maxWidth: '100%'
                            }}
                        >
                            {Array.from({ length: totalSlots }).map((_, idx) => {
                                const ordersInSlot = getOrdersInSlot(idx);
                                const count = ordersInSlot.length;
                                const isSelected = selectedSlot === String(idx + 1);
                                const slotLabel = String(idx + 1).padStart(2, '0');

                                let bgClass = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-primary/50';
                                let textClass = 'text-gray-400 dark:text-gray-500';
                                
                                if (count > 0) {
                                    bgClass = 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm';
                                    textClass = 'text-blue-600 dark:text-blue-400';
                                }
                                if (isSelected) {
                                    bgClass = 'bg-primary text-white border-primary shadow-lg ring-4 ring-primary/20 scale-105 z-10';
                                    textClass = 'text-white';
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedSlot(String(idx + 1))}
                                        className={`
                                            relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-200 group
                                            ${bgClass}
                                        `}
                                    >
                                        <span className={`text-2xl font-black ${textClass}`}>{slotLabel}</span>
                                        {count > 0 && (
                                            <div className={`mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200'}`}>
                                                <Box size={10}/> {count}
                                            </div>
                                        )}
                                        {/* Tooltip for hover */}
                                        {count > 0 && !isSelected && (
                                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl">
                                                {count} طلبات
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Side: Slot Details Panel */}
                <div className={`w-96 bg-white dark:bg-gray-900 flex flex-col border-l dark:border-gray-800 transition-all duration-300 ${!selectedSlot ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'}`}>
                    <div className="p-6 border-b dark:border-gray-800 bg-gray-50 dark:bg-black/20">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                            محتويات الخانة <span className="font-mono text-primary text-xl">#{selectedSlot?.padStart(2,'0')}</span>
                        </h3>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar space-y-3">
                        {selectedOrders.length > 0 ? selectedOrders.map(order => {
                            const client = clients.find(c => c.id === order.clientId);
                            return (
                                <div key={order.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-mono font-black text-primary text-lg">{order.localOrderId}</span>
                                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500">{order.weight} KG</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                                            {client?.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{client?.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{client?.phone}</p>
                                        </div>
                                    </div>

                                    {/* Images Preview */}
                                    {(order.productImages || order.packageImage) && (
                                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                            {[...(order.productImages || []), order.packageImage].filter(Boolean).map((img, i) => (
                                                <img key={i} src={img} className="w-12 h-12 rounded-lg object-cover border dark:border-gray-600 cursor-pointer hover:scale-110 transition-transform" onClick={() => window.open(img, '_blank')} />
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-3 pt-2 border-t dark:border-gray-700 flex justify-between items-center text-xs text-gray-400">
                                        <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(order.storageDate || '').toLocaleDateString('en-GB')}</span>
                                        {order.shipmentId && <span className="flex items-center gap-1 text-orange-500 font-medium"><Layers size={12}/> شحنة</span>}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                                <Box size={48} strokeWidth={1} className="mb-2"/>
                                <p>هذه الخانة فارغة</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StoragePage: React.FC<StoragePageProps> = ({ drawers, setDrawers, orders, setOrders, clients }) => {
    const { currentUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
    const [newDrawer, setNewDrawer] = useState<Partial<StorageDrawer>>({ name: '', rows: 4, columns: 5 });
    const [isSaving, setIsSaving] = useState(false);
    const [inspectingDrawer, setInspectingDrawer] = useState<StorageDrawer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Stats Calculation
    const stats = useMemo(() => {
        const stored = orders.filter(o => o.status === OrderStatus.STORED);
        const capacity = drawers.reduce((acc, d) => acc + (d.capacity || (d.rows * d.columns)), 0);
        return {
            storedCount: stored.length,
            totalCapacity: capacity,
            occupancy: capacity > 0 ? Math.round((stored.length / capacity) * 100) : 0
        };
    }, [orders, drawers]);

    const handleAddDrawer = async () => {
        if(!newDrawer.name) return;
        if(!currentUser?.permissions.storage.create) {
            showToast("ليس لديك صلاحية إضافة وحدات تخزين", "error");
            return;
        }

        setIsSaving(true);
        try {
            const capacity = (newDrawer.rows || 1) * (newDrawer.columns || 1);
            const payload = { name: newDrawer.name, rows: newDrawer.rows, columns: newDrawer.columns, capacity };
            const { data, error } = await supabase!.from('StorageDrawers').insert(payload).select().single();
            if(error) throw error;
            setDrawers(prev => [...prev, data]);
            setIsAddDrawerOpen(false);
            setNewDrawer({ name: '', rows: 4, columns: 5 });
            showToast('تم إضافة وحدة التخزين', 'success');
        } catch(e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDrawer = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!currentUser?.permissions.storage.delete) {
            showToast("ليس لديك صلاحية الحذف", "error");
            return;
        }
        if(!confirm('هل أنت متأكد؟ سيتم حذف الوحدة.')) return;
        try {
            const { error } = await supabase!.from('StorageDrawers').delete().eq('id', id);
            if(error) throw error;
            setDrawers(prev => prev.filter(d => d.id !== id));
            showToast('تم الحذف', 'success');
        } catch(e:any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    // Filter drawers if searching for an order
    const filteredDrawers = useMemo(() => {
        if (!searchTerm) return drawers;
        // Find which drawer contains the searched order
        const matchingOrders = orders.filter(o => 
            o.status === OrderStatus.STORED && 
            (o.localOrderId.toLowerCase().includes(searchTerm.toLowerCase()) || 
             clients.find(c => c.id === o.clientId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        const drawerNames = new Set(matchingOrders.map(o => o.storageLocation?.split('-')[0]));
        return drawers.filter(d => drawerNames.has(d.name));
    }, [drawers, orders, searchTerm, clients]);

    return (
        <div className="space-y-8 pb-20">
            {/* Visual Inspector Modal */}
            {inspectingDrawer && (
                <DrawerInspector 
                    drawer={inspectingDrawer} 
                    orders={orders} 
                    clients={clients}
                    onClose={() => setInspectingDrawer(null)} 
                />
            )}

            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                        <Archive className="text-primary" size={32}/> إدارة المخزن الدقيق
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">تتبع بصري لمواقع الطلبات داخل الأدراج</p>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:flex-grow-0 md:w-64">
                        <input 
                            type="text" 
                            placeholder="بحث عن طلب مخزن..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border-none rounded-xl shadow-sm focus:ring-2 focus:ring-primary text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                    </div>
                    {currentUser?.permissions.storage.create && (
                        <button onClick={() => setIsAddDrawerOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl shadow-lg hover:bg-primary-dark transition-transform hover:scale-105 font-bold">
                            <PlusCircle size={20}/> <span className="hidden sm:inline">وحدة جديدة</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">الطلبات المخزنة</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.storedCount}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                        <Package size={24}/>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">السعة الكلية</p>
                        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{stats.totalCapacity}</p>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl">
                        <Grid3X3 size={24}/>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">نسبة الإشغال</p>
                        <p className={`text-3xl font-black mt-1 ${stats.occupancy > 90 ? 'text-red-500' : 'text-green-500'}`}>{stats.occupancy}%</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stats.occupancy > 90 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        <Activity size={24}/>
                    </div>
                </div>
            </div>

            {/* Add Drawer Form */}
            {isAddDrawerOpen && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border-2 border-primary/20 animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><PlusCircle size={20} className="text-primary"/> إضافة وحدة تخزين</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">اسم الوحدة</label>
                            <input type="text" placeholder="مثال: A1" value={newDrawer.name} onChange={e => setNewDrawer({...newDrawer, name: e.target.value.toUpperCase()})} className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary font-bold"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">عدد الصفوف (Rows)</label>
                            <input type="number" value={newDrawer.rows} onChange={e => setNewDrawer({...newDrawer, rows: parseInt(e.target.value)})} className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary font-bold text-center"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">عدد الأعمدة (Columns)</label>
                            <input type="number" value={newDrawer.columns} onChange={e => setNewDrawer({...newDrawer, columns: parseInt(e.target.value)})} className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary font-bold text-center"/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsAddDrawerOpen(false)} className="px-6 py-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-bold transition-colors">إلغاء</button>
                        <button onClick={handleAddDrawer} disabled={isSaving} className="px-8 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors font-bold shadow-lg flex items-center gap-2">
                            {isSaving ? <Loader2 className="animate-spin" size={18}/> : 'حفظ الوحدة'}
                        </button>
                    </div>
                </div>
            )}

            {/* Drawers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDrawers.map(drawer => {
                    const drawerOrders = orders.filter(o => o.status === OrderStatus.STORED && o.storageLocation?.startsWith(drawer.name + '-'));
                    const capacity = drawer.capacity || (drawer.rows * drawer.columns);
                    const occupancyPct = capacity > 0 ? (drawerOrders.length / capacity) * 100 : 0;
                    
                    return (
                        <div 
                            key={drawer.id} 
                            onClick={() => setInspectingDrawer(drawer)}
                            className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer group hover:shadow-xl hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300 relative overflow-hidden"
                        >
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 dark:bg-white/5 rounded-bl-[3rem] -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                                        <Archive size={24}/>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-xl text-gray-800 dark:text-white">{drawer.name}</h4>
                                        <p className="text-xs text-gray-400 font-bold">{drawer.rows}x{drawer.columns} وحدة</p>
                                    </div>
                                </div>
                                {currentUser?.permissions.storage.delete && (
                                    <button 
                                        onClick={(e) => handleDeleteDrawer(drawer.id, e)} 
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 relative z-10">
                                <div className="flex justify-between text-xs font-bold text-gray-500">
                                    <span>ممتلئ: {drawerOrders.length}</span>
                                    <span>فارغ: {capacity - drawerOrders.length}</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 h-3 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className={`h-full transition-all duration-700 ease-out ${occupancyPct > 90 ? 'bg-red-500' : occupancyPct > 50 ? 'bg-orange-500' : 'bg-green-500'}`} 
                                        style={{width: `${occupancyPct}%`}}
                                    ></div>
                                </div>
                            </div>

                            <div className="mt-5 pt-4 border-t dark:border-gray-700 flex justify-between items-center relative z-10">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">انقر للفحص</span>
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                    <ZoomIn size={16}/>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {filteredDrawers.length === 0 && (
                <div className="text-center py-20 text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed dark:border-gray-800">
                    <Grid3X3 size={64} className="mx-auto mb-4 opacity-10"/>
                    <p className="font-bold text-lg">لا توجد وحدات تخزين مطابقة</p>
                    <p className="text-sm opacity-60">أضف وحدات جديدة أو غير معايير البحث</p>
                </div>
            )}
        </div>
    );
};

export default StoragePage;
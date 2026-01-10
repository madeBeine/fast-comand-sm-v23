
import React, { useState, useEffect } from 'react';
import type { StorageDrawer, Order, Client } from '../types';
import { OrderStatus } from '../types';
import { X, Grid3X3, AlertTriangle, Ban, CheckCircle2, GripHorizontal, Box, ArrowRight, ChevronLeft, Layers } from 'lucide-react';

interface StorageSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (location: string) => void;
    drawers: StorageDrawer[];
    allOrders: Order[];
    suggestedLocation: string | null;
    clients: Client[];
}

const StorageSelectorModal: React.FC<StorageSelectorModalProps> = ({ isOpen, onClose, onSelect, drawers, allOrders, suggestedLocation, clients }) => {
    const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    // Ensure drawers is always an array
    const safeDrawers = Array.isArray(drawers) ? drawers : [];

    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen && safeDrawers.length > 0) {
            // Only auto-select on desktop. On mobile, we want the user to pick the drawer first.
            if (!isMobileView) {
                if (suggestedLocation) {
                    const suggestedDrawerName = suggestedLocation.split('-')[0];
                    const targetDrawer = safeDrawers.find(d => d.name === suggestedDrawerName);
                    if (targetDrawer) {
                        setActiveDrawerId(targetDrawer.id);
                        return;
                    }
                }
                // Default to first drawer on desktop if no suggestion
                if (!activeDrawerId) {
                    setActiveDrawerId(safeDrawers[0].id);
                }
            } else {
                // On Mobile: Ensure we start at the list view (null)
                setActiveDrawerId(null);
            }
        }
    }, [isOpen, safeDrawers, suggestedLocation, isMobileView]);

    if (!isOpen) return null;

    const activeDrawer = safeDrawers.find(d => d.id === activeDrawerId);
    const storedOrders = allOrders.filter(o => o.status === OrderStatus.STORED);

    // Function to get orders in a specific slot
    const getOrdersInSlot = (location: string) => {
        return storedOrders.filter(o => o.storageLocation === location);
    };

    const handleSlotSelect = (fullLocation: string) => {
        onSelect(fullLocation);
    };

    const handleFloorStorage = () => {
        onSelect('Floor');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60] p-0 md:p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark md:rounded-xl shadow-2xl w-full max-w-5xl h-full md:h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 md:rounded-t-xl flex-shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {isMobileView && activeDrawerId ? (
                            <button 
                                onClick={() => setActiveDrawerId(null)}
                                className="p-2 mr-1 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200"
                            >
                                <ArrowRight size={20}/>
                            </button>
                        ) : (
                            <Grid3X3 className="text-primary hidden md:block" size={24}/>
                        )}
                        
                        <div className="flex flex-col">
                            <h3 className="text-lg md:text-xl font-bold truncate">
                                {activeDrawer ? `محتويات: ${activeDrawer.name}` : 'اختر موقع التخزين'}
                            </h3>
                            {activeDrawer && isMobileView && <span className="text-xs text-gray-500">اضغط للعودة للقائمة</span>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleFloorStorage}
                            className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:hover:bg-orange-900 px-3 py-2 rounded-lg text-xs md:text-sm font-bold flex items-center gap-1 border border-orange-300 dark:border-orange-800 whitespace-nowrap"
                        >
                            <Box size={16}/> تخزين أرضي
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {safeDrawers.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-gray-500 p-6 text-center">
                         <AlertTriangle size={48} className="mb-4 text-yellow-500"/>
                         <p className="text-lg font-semibold">لا توجد وحدات تخزين (أدراج) مضافة.</p>
                         <p className="text-sm mt-2">يرجى الذهاب إلى صفحة الإعدادات &rarr; المخزن لإضافة أدراج جديدة.</p>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row h-full overflow-hidden relative">
                        
                        {/* Drawer List (Sidebar on Desktop, Full view on Mobile if no drawer selected) */}
                        <div className={`
                            w-full md:w-1/4 bg-gray-50 dark:bg-gray-900/50 border-l dark:border-gray-700 
                            flex-col overflow-y-auto custom-scrollbar p-3 space-y-3
                            ${activeDrawerId && isMobileView ? 'hidden' : 'flex'}
                        `}>
                            <h4 className="font-bold text-gray-500 dark:text-gray-400 text-sm mb-1 px-1">قائمة الوحدات</h4>
                            {safeDrawers.map(drawer => {
                                const isSuggestedDrawer = suggestedLocation?.startsWith(drawer.name + '-');
                                const isActive = activeDrawerId === drawer.id;
                                
                                const ordersInDrawerCount = storedOrders.filter(o => o.storageLocation?.startsWith(drawer.name + '-')).length;
                                const capacity = drawer.capacity || (drawer.rows || 1) * (drawer.columns || 5);
                                const occupancyRate = capacity > 0 ? Math.min(ordersInDrawerCount / capacity, 1) : 0;

                                return (
                                    <button
                                        key={drawer.id}
                                        onClick={() => setActiveDrawerId(drawer.id)}
                                        className={`
                                            w-full relative p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2
                                            ${isActive 
                                                ? 'border-primary bg-primary text-white shadow-lg scale-[1.02]' 
                                                : 'border-white dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm'}
                                            ${isSuggestedDrawer && !isActive ? 'ring-2 ring-yellow-400 ring-offset-2 dark:ring-offset-gray-900 border-yellow-400' : ''}
                                        `}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                                    <Layers size={20}/>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-lg block leading-none">{drawer.name}</span>
                                                    <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>وحدة تخزين</span>
                                                </div>
                                            </div>
                                            {isMobileView && <ChevronLeft size={18} className="opacity-50"/>}
                                        </div>
                                        
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden mt-1">
                                            <div 
                                                className={`h-full ${isActive ? 'bg-white' : occupancyRate > 0.9 ? 'bg-red-500' : 'bg-green-500'}`} 
                                                style={{width: `${occupancyRate * 100}%`}}
                                            ></div>
                                        </div>
                                        <div className="w-full flex justify-between text-[10px] font-mono opacity-80 px-1">
                                            <span>{ordersInDrawerCount} ممتلئ</span>
                                            <span>{capacity} كلي</span>
                                        </div>
                                        
                                        {/* Suggestion Badge for List View */}
                                        {isSuggestedDrawer && !isActive && (
                                            <div className="absolute top-2 left-2 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                                مقترح
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Drawer Interior (Grid) */}
                        <div className={`
                            flex-grow bg-gray-100 dark:bg-gray-900 p-2 md:p-6 overflow-hidden flex flex-col
                            ${!activeDrawerId && isMobileView ? 'hidden' : 'flex'}
                        `}>
                            {activeDrawer ? (
                                <>
                                    {/* Grid Legend */}
                                    <div className="flex justify-center gap-4 text-xs mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                         <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded"></div> فارغ</span>
                                         <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-100 border-2 border-blue-500 rounded"></div> مشغول</span>
                                         <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-400 rounded ring-2 ring-white"></div> مقترح</span>
                                    </div>

                                    {/* Scrollable Grid Area */}
                                    <div className="flex-grow overflow-y-auto custom-scrollbar px-1 pb-20 md:pb-0">
                                        <div 
                                            className="grid gap-3 mx-auto" 
                                            style={{ 
                                                gridTemplateColumns: `repeat(${isMobileView ? 3 : (activeDrawer.columns || 5)}, 1fr)`,
                                                maxWidth: isMobileView ? '100%' : 'fit-content'
                                            }}
                                        >
                                            {Array.from({ length: (activeDrawer.rows || 1) * (activeDrawer.columns || 5) }, (_, i) => {
                                                const slotNum = String(i + 1).padStart(2, '0');
                                                const fullLocation = `${activeDrawer.name}-${slotNum}`;
                                                const itemsInSlot = getOrdersInSlot(fullLocation);
                                                const itemCount = itemsInSlot.length;
                                                const isSuggested = fullLocation === suggestedLocation;
                                                const hasItems = itemCount > 0;

                                                return (
                                                    <button
                                                        key={fullLocation}
                                                        onClick={() => handleSlotSelect(fullLocation)}
                                                        className={`
                                                            relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm
                                                            ${hasItems 
                                                                ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50' 
                                                                : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'}
                                                            ${isSuggested ? 'ring-4 ring-yellow-400 z-10 animate-pulse scale-105 shadow-xl' : ''}
                                                            ${isMobileView ? 'min-h-[80px]' : 'w-24 h-24'}
                                                        `}
                                                    >
                                                        <span className={`text-xl font-black ${hasItems ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                            {slotNum}
                                                        </span>
                                                        
                                                        {hasItems ? (
                                                            <div className="mt-1 px-2 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                                                                {itemCount}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1 w-2 h-2 rounded-full bg-green-400/30"></div>
                                                        )}

                                                        {isSuggested && (
                                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-white whitespace-nowrap z-20">
                                                                هنا
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <GripHorizontal size={64} className="mb-6 opacity-20"/>
                                    <p className="text-lg">اختر وحدة تخزين لعرض التفاصيل</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageSelectorModal;

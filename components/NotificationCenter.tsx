
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Hash, ChevronRight, Truck, PackageX, History, Wallet, AlertOctagon, TrendingUp, Users, UserMinus, UserPlus, Edit3, Globe, Archive, CheckCircle2 } from 'lucide-react';
import type { Order, Store, AppSettings, Client, GlobalActivityLog, User } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useSound } from '../contexts/SoundContext';

interface NotificationCenterProps {
    orders: Order[];
    stores: Store[];
    clients: Client[];
    settings?: AppSettings;
    globalActivityLog?: GlobalActivityLog[];
    currentUser?: User | null;
    onNavigateToOrder: (orderId: string) => void;
}

interface NotificationItem {
    id: string;
    type: 'urgent' | 'warning' | 'info' | 'success';
    category: 'shipping' | 'tracking' | 'inventory' | 'billing' | 'financial' | 'operations' | 'activity' | 'system';
    title: string;
    message: string;
    orderId?: string; 
    localOrderId?: string;
    clientId?: string; 
    date: Date;
    score?: number; // Priority Score
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ orders, stores, clients, settings, globalActivityLog, currentUser, onNavigateToOrder }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Load read status from local storage
    const [readIds, setReadIds] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('notification_read_ids');
            return new Set(saved ? JSON.parse(saved) : []);
        } catch { return new Set(); }
    });

    const menuRef = useRef<HTMLDivElement>(null);
    const { dir } = useLanguage();
    const { playSound } = useSound();

    // Persist read status
    useEffect(() => {
        localStorage.setItem('notification_read_ids', JSON.stringify(Array.from(readIds)));
    }, [readIds]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const notifications = useMemo(() => {
        const list: NotificationItem[] = [];
        const now = new Date();

        // Helper to calculate days difference
        const getDaysDiff = (dateStr: string) => {
            const date = new Date(dateStr);
            const diffTime = now.getTime() - date.getTime();
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        };

        // --- 1. SMART FINANCIAL WATCHDOG (كاشف السيولة والديون) ---
        const clientDebtMap: Record<string, { debt: number, count: number, names: string[] }> = {};
        
        orders.forEach(o => {
            if (o.status === OrderStatus.COMPLETED || o.status === OrderStatus.CANCELLED || o.status === OrderStatus.NEW) return;
            const total = (o.priceInMRU || 0) + (o.commission || 0) + (o.shippingCost || 0) + (o.localDeliveryCost || 0);
            const paid = o.amountPaid || 0;
            const debt = total - paid;
            
            if (debt > 0) {
                if (!clientDebtMap[o.clientId]) clientDebtMap[o.clientId] = { debt: 0, count: 0, names: [] };
                clientDebtMap[o.clientId].debt += debt;
                clientDebtMap[o.clientId].count += 1;
                if (clientDebtMap[o.clientId].names.length < 2) clientDebtMap[o.clientId].names.push(o.localOrderId);
            }
        });

        Object.entries(clientDebtMap).forEach(([clientId, data]) => {
            // Threshold: 20,000 MRU Debt
            if (data.debt > 20000) {
                const clientName = clients.find(c => c.id === clientId)?.name || 'عميل';
                list.push({
                    id: `debt-${clientId}`,
                    type: 'urgent',
                    category: 'financial',
                    title: `تنبيه تحصيل: ${clientName}`,
                    message: `العميل مدين بـ ${Math.round(data.debt).toLocaleString()} MRU على ${data.count} طلبات نشطة (${data.names.join(', ')}...). يرجى المتابعة.`,
                    clientId: clientId,
                    date: now,
                    score: 10
                });
            }
        });

        // --- 2. OPERATION BOTTLENECK (اختناق العمليات) ---
        const stuckAtOffice = orders.filter(o => o.status === OrderStatus.ARRIVED_AT_OFFICE && o.arrivalDateAtOffice);
        stuckAtOffice.forEach(o => {
            const hoursDiff = (now.getTime() - new Date(o.arrivalDateAtOffice!).getTime()) / (1000 * 60 * 60);
            if (hoursDiff > 24) {
                list.push({
                    id: `bottleneck-${o.id}`,
                    type: 'urgent',
                    category: 'operations',
                    title: `تأخر معالجة (${o.localOrderId})`,
                    message: `وصل الطلب منذ ${Math.floor(hoursDiff)} ساعة ولم يتم وزنه وتخزينه بعد.`,
                    orderId: o.id,
                    localOrderId: o.localOrderId,
                    date: now,
                    score: 8
                });
            }
        });

        // --- 3. STALLED DELIVERY (طلبات منسية في المخزن) ---
        const stagnantOrders = orders.filter(o => o.status === OrderStatus.STORED && o.storageDate);
        stagnantOrders.forEach(o => {
            const days = getDaysDiff(o.storageDate!);
            if (days > 15) {
                list.push({
                    id: `stale-${o.id}`,
                    type: 'warning',
                    category: 'inventory',
                    title: `مخزون راكد (${o.localOrderId})`,
                    message: `الطلب يشغل مساحة في ${o.storageLocation} منذ ${days} يوماً دون استلام.`,
                    orderId: o.id,
                    localOrderId: o.localOrderId,
                    date: now,
                    score: 5
                });
            }
        });

        // --- 4. TRACKING ALERT (تحديث التتبع) ---
        const ordersNeedingTracking = orders.filter(o => o.status === OrderStatus.ORDERED && !o.trackingNumber);
        ordersNeedingTracking.forEach(order => {
            const store = stores.find(s => s.id === order.storeId);
            const estimatedDays = store?.estimatedDeliveryDays || 14; 
            const daysPassed = getDaysDiff(order.orderDate);

            if (daysPassed >= Math.ceil(estimatedDays / 2)) {
                list.push({
                    id: `track-${order.id}`,
                    type: 'warning',
                    category: 'tracking',
                    title: `نقص تتبع (${order.localOrderId})`,
                    message: `مرت ${daysPassed} أيام على الطلب من ${store?.name} ولم يتم إدخال رقم التتبع.`,
                    orderId: order.id,
                    localOrderId: order.localOrderId,
                    date: now,
                    score: 4
                });
            }
        });

        // --- 5. FAST SHIPPING DELAY (تأخر الشحن السريع) ---
        const fastOrders = orders.filter(o => o.shippingType === ShippingType.FAST && 
            [OrderStatus.NEW, OrderStatus.ORDERED, OrderStatus.SHIPPED_FROM_STORE].includes(o.status)
        );
        fastOrders.forEach(order => {
            const daysPassed = getDaysDiff(order.orderDate);
            if (daysPassed >= 7) { 
                list.push({
                    id: `fast-${order.id}`,
                    type: 'urgent',
                    category: 'shipping',
                    title: `تأخر شحن سريع (${order.localOrderId})`,
                    message: `طلب شحن سريع معلق منذ ${daysPassed} أيام!`,
                    orderId: order.id,
                    localOrderId: order.localOrderId,
                    date: now,
                    score: 9
                });
            }
        });

        // --- 6. TEAM ACTIVITY (نشاط الفريق الذكي) ---
        if (globalActivityLog && currentUser) {
            const recentLogs = globalActivityLog
                .filter(log => log.user !== currentUser.username) // Exclude self
                .filter(log => new Date(log.timestamp).getTime() > now.getTime() - (24 * 60 * 60 * 1000)) // Last 24h
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 15); 

            recentLogs.forEach(log => {
                let relatedOrder = null;
                let displayTitle = '';
                let displayMessage = '';
                let iconType: NotificationItem['type'] = 'info';
                let category: NotificationItem['category'] = 'activity';

                const act = log.action.toLowerCase();
                const user = (log.user || 'Unknown').split(' ')[0];
                const details = log.details || '';
                
                // --- PRECISE DETECTION ---
                
                if (log.entityType === 'Order') {
                    relatedOrder = orders.find(o => o.id === log.entityId);
                    const orderRef = relatedOrder ? relatedOrder.localOrderId : (details.match(/FCD\d+|#\d+/)?.[0] || 'طلب');

                    if (details.includes('Added Global ID')) {
                        displayTitle = 'إضافة رقم عالمي';
                        displayMessage = `قام ${user} بإضافة الرقم العالمي للطلب ${orderRef}`;
                        category = 'tracking';
                        iconType = 'info';
                    } else if (details.includes('Added Tracking')) {
                        displayTitle = 'إضافة تتبع';
                        displayMessage = `قام ${user} بإضافة رقم تتبع للطلب ${orderRef}`;
                        category = 'tracking';
                        iconType = 'success';
                    } else if (details.includes('Stored')) {
                        displayTitle = 'تخزين طلب';
                        displayMessage = `قام ${user} بتخزين الطلب ${orderRef} في المخزن`;
                        category = 'inventory';
                        iconType = 'success';
                    } else if (details.includes('Delivered')) {
                        displayTitle = 'تسليم طلب';
                        displayMessage = `قام ${user} بتسليم الطلب ${orderRef} وإنهاء المعاملة`;
                        category = 'operations';
                        iconType = 'success';
                    } else if (act.includes('create')) {
                        displayTitle = 'طلب جديد';
                        displayMessage = `أنشأ ${user} طلباً جديداً ${orderRef}`;
                        category = 'operations';
                        iconType = 'success';
                    } else if (act.includes('delete')) {
                        displayTitle = 'حذف طلب';
                        displayMessage = `حذف ${user} الطلب ${orderRef}`;
                        category = 'operations';
                        iconType = 'urgent';
                    } else {
                        // Generic Update
                        displayTitle = `تحديث على ${orderRef}`;
                        displayMessage = `قام ${user} بإجراء تعديلات على الطلب`;
                    }
                } else if (log.entityType === 'Client') {
                    displayTitle = 'تحديث عملاء';
                    displayMessage = `قام ${user} بتعديل بيانات العملاء`;
                } else if (log.entityType === 'Shipment') {
                    const shipRef = details.match(/SH-\d+/)?.[0] || 'شحنة';
                    displayTitle = 'حركة شحن';
                    displayMessage = `قام ${user} بتحديث الشحنة ${shipRef}`;
                    category = 'shipping';
                }

                if (displayTitle) {
                    list.push({
                        id: `act-${log.id}`,
                        type: iconType,
                        category: category,
                        title: displayTitle,
                        message: displayMessage,
                        date: new Date(log.timestamp),
                        score: 3, // Prioritize user actions slightly above generic warnings
                        localOrderId: relatedOrder?.localOrderId,
                        orderId: relatedOrder?.id
                    });
                }
            });
        }

        return list.sort((a, b) => (b.score || 0) - (a.score || 0));
    }, [orders, stores, clients, globalActivityLog, currentUser]);

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    // Audio Reminder
    useEffect(() => {
        if (!settings?.notificationReminderEnabled || unreadCount === 0) return;
        const intervalMs = (settings.notificationReminderInterval || 60) * 60 * 1000;
        const intervalId = setInterval(() => {
            // Only play sound for urgent/financial alerts
            const hasUrgent = notifications.some(n => !readIds.has(n.id) && (n.type === 'urgent' || n.category === 'financial'));
            if (hasUrgent) playSound('warning');
        }, intervalMs);
        return () => clearInterval(intervalId);
    }, [settings?.notificationReminderEnabled, settings?.notificationReminderInterval, unreadCount, playSound, notifications, readIds]);

    const handleItemClick = (item: NotificationItem) => {
        setReadIds(prev => new Set(prev).add(item.id));
        if (item.localOrderId) {
            onNavigateToOrder(item.localOrderId);
            setIsOpen(false);
        } else if (item.orderId) {
            onNavigateToOrder(item.orderId);
            setIsOpen(false);
        }
    };

    const handleMarkAllRead = () => {
        const allIds = notifications.map(n => n.id);
        setReadIds(new Set([...Array.from(readIds), ...allIds]));
        playSound('pop');
    };

    const getIcon = (item: NotificationItem) => {
        // Precise Icons
        if (item.title.includes('Global ID') || item.title.includes('رقم عالمي')) return <Globe size={18}/>;
        if (item.title.includes('Tracking') || item.title.includes('تتبع')) return <Hash size={18}/>;
        if (item.title.includes('Stored') || item.title.includes('تخزين')) return <Archive size={18}/>;
        if (item.title.includes('Delivered') || item.title.includes('تسليم')) return <CheckCircle2 size={18}/>;

        if (item.category === 'activity') {
            if (item.type === 'urgent') return <UserMinus size={18}/>; // Delete
            if (item.type === 'success') return <UserPlus size={18}/>; // Create
            if (item.type === 'warning') return <Edit3 size={18}/>; // Edit
            return <Users size={18}/>;
        }
        if (item.category === 'financial') return <Wallet size={18}/>;
        if (item.category === 'operations') return <TrendingUp size={18}/>;
        if (item.category === 'tracking') return <Hash size={18}/>;
        if (item.category === 'shipping') return <Truck size={18}/>;
        if (item.category === 'inventory') return <PackageX size={18}/>;
        if (item.type === 'urgent') return <AlertOctagon size={18}/>;
        return <Bell size={18}/>;
    };

    const getColors = (type: string) => {
        switch (type) {
            case 'urgent': return "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900";
            case 'warning': return "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900";
            case 'success': return "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900";
            default: return "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900";
        }
    };

    const dropdownPositionClass = dir === 'rtl' ? 'md:left-0 origin-top-left' : 'md:right-0 origin-top-right';

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            >
                <Bell size={22} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)}/>
                    <div className={`fixed inset-x-4 top-20 z-50 md:absolute md:inset-auto md:top-full md:mt-2 w-auto md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${dropdownPositionClass}`}>
                        <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                                <History size={16}/> التنبيهات
                            </h3>
                            <div className="flex gap-2">
                                {unreadCount > 0 && (
                                    <button 
                                        onClick={handleMarkAllRead}
                                        className="text-[10px] flex items-center gap-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-300"
                                        title="تحديد الكل كمقروء"
                                    >
                                        <CheckCheck size={12}/> الكل
                                    </button>
                                )}
                                {unreadCount > 0 && (
                                    <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="max-h-[70vh] md:max-h-96 overflow-y-auto custom-scrollbar">
                            {notifications.length > 0 ? (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {notifications.map(item => {
                                        const isRead = readIds.has(item.id);
                                        const colors = getColors(item.type);

                                        return (
                                            <div 
                                                key={item.id} 
                                                onClick={() => handleItemClick(item)}
                                                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer flex gap-3 group relative ${isRead ? 'opacity-60' : 'opacity-100'}`}
                                            >
                                                {!isRead && <div className="absolute top-4 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"></div>}
                                                
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-sm ${colors}`}>
                                                    {getIcon(item)}
                                                </div>
                                                
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className={`text-sm font-bold truncate ${isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                            {item.title}
                                                        </h4>
                                                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                            {item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                                                        {item.message}
                                                    </p>
                                                    {(item.localOrderId || item.clientId) && (
                                                        <div className="mt-2 flex items-center text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-200">
                                                            عرض التفاصيل <ChevronRight size={12}/>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-10 text-center text-gray-400 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                                        <CheckCheck size={32} className="text-green-500 opacity-80"/>
                                    </div>
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-300">الكل مقروء</p>
                                    <p className="text-xs opacity-60 mt-1">لا توجد تنبيهات جديدة حالياً.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;

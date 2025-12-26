
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, getErrorMessage } from '../supabaseClient';
import type { Order, Client, Store, Shipment, ShippingCompany, StorageDrawer, Currency, CompanyInfo, AppSettings, User, GlobalActivityLog, PaymentMethod, City, DashboardStats } from '../types';
import { ShippingType, OrderStatus } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useSound } from '../contexts/SoundContext';

const CACHE_KEY_PREFIX = 'fast_comand_v4_';

const DEFAULT_SETTINGS: AppSettings = {
    commissionRate: 10,
    shippingRates: { fast: 450, normal: 280 },
    shippingZones: [], 
    deliveryDays: {
        fast: { min: 3, max: 5 },
        normal: { min: 9, max: 12 },
    },
    defaultShippingType: ShippingType.NORMAL,
    defaultOriginCenter: '',
    paymentMethods: [], 
    orderIdPrefix: 'FCD',
    defaultCurrency: 'AED',
    viewOrder: ['dashboard', 'orders', 'shipments', 'clients', 'storage', 'delivery', 'billing', 'settings'],
    whatsappTemplates: {
        ar: `مرحباً {clientName} 👋\n\nيسعدنا إخبارك بأن طلبك رقم *{orderId}* قد وصل! 🎉✅\n\n📦 *تفاصيل المستحقات:*\n⚖️ الوزن: {weight} كغ\n✈️ قيمة الشحن: {shippingCost} MRU\n{productRemainingLine}\n{deliveryLine}\n\n💰 *المجموع الكلي (شامل التوصيل إن وجد):*\n👈 *{totalDue} MRU*\n\nشكراً لثقتكم بنا في {companyName} ❤️`,
        en: `Hello {clientName} 👋\n\nGood news! Your order *#{orderId}* has arrived! 🎉✅\n\n📦 *Payment Details:*\n⚖️ Weight: {weight} kg\n✈️ Shipping Fee: {shippingCost} MRU\n{productRemainingLine}\n{deliveryLine}\n\n💰 *Grand Total (Inc. Delivery):*\\n👈 *{totalDue} MRU*\\n\\nThank you for trusting {companyName} ❤️`,
        fr: `Bonjour {clientName} 👋\n\nBonne nouvelle ! Votre commande *#{orderId}* est arrivée ! 🎉✅\n\n📦 *Détails du paiement :*\n⚖️ Poids : {weight} kg\n✈️ Frais de port : {shippingCost} MRU\n{productRemainingLine}\n{deliveryLine}\n\n💰 *Total à payer (Livraison incluse) :*\\n👈 *{totalDue} MRU*\n\nMerci de votre confiance en {companyName} ❤️`
    },
    calculatorShortLink: '',
    notificationReminderEnabled: true,
    notificationReminderInterval: 60,
    mobileDockViews: ['dashboard', 'orders', 'delivery', 'clients'],
};

const mapSettings = (data: any): AppSettings => {
    if (!data) return DEFAULT_SETTINGS;
    return {
        id: data.id,
        commissionRate: data.commission_rate ?? data.commissionRate ?? DEFAULT_SETTINGS.commissionRate,
        shippingRates: data.shipping_rates ?? data.shippingRates ?? DEFAULT_SETTINGS.shippingRates,
        shippingZones: data.shipping_zones ?? data.shippingZones ?? DEFAULT_SETTINGS.shippingZones,
        deliveryDays: data.delivery_days ?? data.delivery_days ?? DEFAULT_SETTINGS.deliveryDays,
        defaultShippingType: data.default_shipping_type ?? data.defaultShippingType ?? DEFAULT_SETTINGS.defaultShippingType,
        defaultOriginCenter: data.default_origin_center ?? data.defaultOriginCenter ?? DEFAULT_SETTINGS.defaultOriginCenter,
        paymentMethods: [], 
        orderIdPrefix: data.order_id_prefix ?? data.orderIdPrefix ?? DEFAULT_SETTINGS.orderIdPrefix,
        defaultCurrency: data.default_currency ?? data.defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
        viewOrder: data.view_order ?? data.viewOrder ?? DEFAULT_SETTINGS.viewOrder,
        whatsappTemplates: data.whatsapp_templates ?? data.whatsappTemplates ?? DEFAULT_SETTINGS.whatsappTemplates,
        calculatorShortLink: data.calculator_short_link ?? data.calculatorShortLink ?? DEFAULT_SETTINGS.calculatorShortLink,
        notificationReminderEnabled: data.notification_reminder_enabled ?? data.notificationReminderEnabled ?? DEFAULT_SETTINGS.notificationReminderEnabled,
        notificationReminderInterval: data.notification_reminder_interval ?? data.notificationReminderInterval ?? DEFAULT_SETTINGS.notificationReminderInterval,
        minCommissionThreshold: data.min_commission_threshold,
        minCommissionValue: data.min_commission_value,
        mobileDockViews: data.mobile_dock_views ?? data.mobileDockViews ?? DEFAULT_SETTINGS.mobileDockViews,
    };
};

const mapCompanyInfo = (data: any): CompanyInfo => {
    if (!data) return { name: '', email: '', phone: '', address: '', logo: '', website: '' };
    return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        logo: data.logo,
        website: data.website,
        invoiceTerms: data.invoiceTerms ?? data.invoice_terms,
        invoiceSignature: data.invoiceSignature ?? data.invoice_signature
    };
};

const mapStore = (s: any): Store => ({
    ...s,
    estimatedDeliveryDays: s.estimated_delivery_days,
    defaultOrigin: s.default_origin,
    defaultShippingCompanyId: s.default_shipping_company_id,
    defaultTransportMode: s.default_transport_mode,
    defaultShippingType: s.default_shipping_type,
    deliveryDaysFast: s.delivery_days_fast,
    deliveryDaysNormal: s.delivery_days_normal
});

const mapLog = (l: any): GlobalActivityLog => ({
    ...l,
    entityType: l.entity_type ?? l.entityType,
    entityId: l.entity_id ?? l.entityId
});

const mapOrder = (o: any): Order => ({
    ...o,
    localOrderId: o.local_order_id ?? o.localOrderId,
    globalOrderId: o.global_order_id ?? o.globalOrderId,
    clientId: o.clientId ?? o.client_id,
    storeId: o.store_id ?? o.storeId,
    priceInMRU: o.price_in_mru ?? o.priceInMRU,
    amountPaid: o.amount_paid ?? o.amountPaid,
    paymentMethod: o.payment_method ?? o.paymentMethod,
    transactionFee: o.transaction_fee ?? o.transactionFee ?? 0,
    shippingType: o.shipping_type ?? o.shippingType,
    orderDate: o.order_date ?? o.orderDate,
    arrivalDateAtOffice: o.arrival_date_at_office ?? o.arrivalDateAtOffice,
    expectedArrivalDate: o.expected_arrival_date ?? o.expectedArrivalDate,
    expectedHubArrivalStartDate: o.expected_hub_arrival_start_date ?? o.expectedHubArrivalStartDate,
    expectedHubArrivalEndDate: o.expected_hub_arrival_end_date ?? o.expectedHubArrivalEndDate,
    commissionType: o.commission_type ?? o.commissionType,
    commissionRate: o.commission_rate ?? o.commissionRate,
    productLinks: o.product_links ?? o.productLinks,
    productImages: o.product_images ?? [], 
    orderImages: o.order_images ?? [],
    hubArrivalImages: o.hub_arrival_images ?? [],
    weighingImages: o.weighing_images ?? [],
    receiptImages: o.receipt_images ?? [], 
    receiptImage: o.receipt_image ?? null,
    trackingNumber: o.tracking_number ?? o.trackingNumber,
    shippingCost: o.shipping_cost ?? o.shippingCost,
    storageLocation: o.storage_location ?? o.storageLocation,
    storageDate: o.storage_date ?? o.storageDate,
    withdrawalDate: o.withdrawal_date ?? o.withdrawalDate,
    shipmentId: o.shipment_id ?? o.shipmentId,
    boxId: o.box_id ?? o.boxId,
    originCenter: o.origin_center ?? o.originCenter,
    receivingCompanyId: o.receiving_company_id ?? o.receivingCompanyId,
    whatsappNotificationSent: o.whatsapp_notification_sent ?? o.whatsappNotificationSent ?? false,
    isInvoicePrinted: o.is_invoice_printed ?? o.is_invoice_printed ?? false,
    history: o.history ?? [],
    localDeliveryCost: o.local_delivery_cost ?? o.localDeliveryCost ?? 0,
});

const saveToCache = (key: string, data: any) => {
    try {
        const cachePayload = { timestamp: Date.now(), data };
        localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cachePayload));
    } catch (e) {
        try { localStorage.clear(); } catch {}
    }
};

const loadFromCache = (key: string): any | null => {
    try {
        const stored = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (!stored) return null;
        const { data } = JSON.parse(stored);
        return data;
    } catch (e) {
        return null;
    }
};

const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[^\w\s\u0600-\u06FF]/g, '')
        .replace(/\s+/g, ' ');
};

const PAGE_SIZE = 50;

const ORDER_SELECT_FIELDS = `
    id, local_order_id, global_order_id, client_id, store_id, price, currency, price_in_mru, 
    commission, quantity, amount_paid, payment_method, transaction_fee, shipping_type, transport_mode, order_date, 
    arrival_date_at_office, expected_arrival_date, commission_type, commission_rate, product_links, 
    notes, status, tracking_number, weight, shipping_cost, storage_location, storage_date, 
    withdrawal_date, shipment_id, box_id, origin_center, receiving_company_id, 
    whatsapp_notification_sent, is_invoice_printed, local_delivery_cost, history, created_at
`;

export const useAppData = (currentUser: User | null, isPublicCalculator: boolean) => {
    const { showToast } = useToast();
    const { playSound } = useSound();

    const [orders, setOrders] = useState<Order[]>(() => (loadFromCache('Orders') || []).map(mapOrder));
    const [clients, setClients] = useState<Client[]>(() => loadFromCache('Clients') || []);
    const [stores, setStores] = useState<Store[]>(() => (loadFromCache('Stores') || []).map(mapStore));
    const [shipments, setShipments] = useState<Shipment[]>(() => loadFromCache('Shipments') || []);
    const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>(() => loadFromCache('ShippingCompanies') || []);
    const [drawers, setDrawers] = useState<StorageDrawer[]>(() => loadFromCache('StorageDrawers') || []);
    const [currencies, setCurrencies] = useState<Currency[]>(() => loadFromCache('Currencies') || []);
    const [users, setUsers] = useState<User[]>(() => loadFromCache('Users') || []);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => loadFromCache('PaymentMethods') || []);
    const [cities, setCities] = useState<City[]>(() => loadFromCache('Cities') || []);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => {
        const cached = loadFromCache('CompanyInfo');
        return cached?.[0] ? mapCompanyInfo(cached[0]) : { name: 'Fast Comand', logo: '', email: '', phone: '', address: '' };
    });
    const [settings, setSettings] = useState<AppSettings>(() => {
        const cached = loadFromCache('AppSettings');
        return cached?.[0] ? mapSettings(cached[0]) : DEFAULT_SETTINGS;
    });
    const [globalActivityLog, setGlobalActivityLog] = useState<GlobalActivityLog[]>([]);
    
    // Pagination & Stats States
    const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
    
    // Orders Pagination
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [hasMoreOrders, setHasMoreOrders] = useState(true);
    const [orderPage, setOrderPage] = useState(0);
    
    // Clients Pagination & Counts
    const [isClientsLoading, setIsClientsLoading] = useState(false);
    const [hasMoreClients, setHasMoreClients] = useState(true);
    const [clientsPage, setClientsPage] = useState(0);
    const [totalClientsCount, setTotalClientsCount] = useState(0);

    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isInitializedRef = useRef(false);

    // --- REALTIME SUBSCRIPTIONS ---
    useEffect(() => {
        if (!currentUser || isPublicCalculator || !supabase) return;

        console.log("Subscribing to Realtime...");

        const ordersChannel = supabase.channel('public:Orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Orders' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newOrder = mapOrder(payload.new);
                    // CRITICAL: Prevent Duplicate Orders via Realtime
                    setOrders(prev => {
                        if (prev.some(o => o.id === newOrder.id)) return prev;
                        playSound('success'); 
                        showToast(`طلب جديد: ${newOrder.localOrderId}`, 'success');
                        return [newOrder, ...prev];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const updated = mapOrder(payload.new);
                    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(o => o.id !== payload.old.id));
                }
            })
            .subscribe();

        const clientsChannel = supabase.channel('public:Clients')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Clients' }, (payload) => {
                if (payload.eventType === 'INSERT') setClients(prev => [payload.new as Client, ...prev]);
                else if (payload.eventType === 'UPDATE') setClients(prev => prev.map(c => c.id === payload.new.id ? payload.new as Client : c));
                else if (payload.eventType === 'DELETE') setClients(prev => prev.filter(c => c.id !== payload.old.id));
            })
            .subscribe();

        const shipmentsChannel = supabase.channel('public:Shipments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Shipments' }, (payload) => {
                const mapShip = (s:any) => ({ ...s, shipmentNumber: s.shipment_number, shippingType: s.shipping_type, shippingCompanyId: s.shipping_company_id, departureDate: s.departure_date, expectedArrivalDate: s.expected_arrival_date, numberOfBoxes: s.number_of_boxes });
                if (payload.eventType === 'INSERT') {
                    setShipments(prev => [mapShip(payload.new), ...prev]);
                    showToast('تم إضافة شحنة جديدة', 'info');
                }
                else if (payload.eventType === 'UPDATE') setShipments(prev => prev.map(s => s.id === payload.new.id ? mapShip(payload.new) : s));
                else if (payload.eventType === 'DELETE') setShipments(prev => prev.filter(s => s.id !== payload.old.id));
            })
            .subscribe();

        const logsChannel = supabase.channel('public:GlobalActivityLog')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'GlobalActivityLog' }, (payload) => {
                setGlobalActivityLog(prev => [mapLog(payload.new), ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(clientsChannel);
            supabase.removeChannel(shipmentsChannel);
            supabase.removeChannel(logsChannel);
        };
    }, [currentUser, isPublicCalculator, playSound, showToast]);

    const calculateDashboardStats = (allData: any[], pMethods: PaymentMethod[]): DashboardStats => {
        const stats = {
            profit: 0,
            revenue: 0, 
            debt: 0,
            cash: 0,
            totalOrders: 0,
            readyOrders: 0,
            transitOrders: 0,
            chartData: [] as { name: string; count: number; val: number }[]
        };

        const last7Days = new Map<string, { count: number; val: number }>();
        const today = new Date();
        for(let i=0; i<7; i++) {
            const d = new Date(); d.setDate(today.getDate() - i);
            last7Days.set(d.toISOString().split('T')[0], { count: 0, val: 0 });
        }

        allData.forEach(o => {
            if (o.status === OrderStatus.CANCELLED) return;
            if (o.status === OrderStatus.NEW) return;

            const price = Number(o.price_in_mru || 0);
            const comm = Number(o.commission || 0);
            const ship = Number(o.shipping_cost || 0);
            const del = Number(o.local_delivery_cost || 0);
            const paid = Number(o.amount_paid || 0);
            const dbFee = Number(o.transaction_fee || 0);

            let fee = 0;
            const pmName = normalizeText(o.payment_method || '');
            
            if (pmName && paid > 0) {
                const matchedPm = pMethods.find(pm => normalizeText(pm.name) === pmName);
                const rate = Number(matchedPm?.feeRate || 0);
                if (rate > 0) {
                    fee = (paid * rate) / 100;
                } else {
                    fee = dbFee;
                }
            } else {
                fee = dbFee;
            }

            const totalInvoiceValue = price + comm + ship + del;
            const netProfit = comm - fee;

            stats.profit += netProfit; 
            stats.revenue += totalInvoiceValue; 
            
            const remaining = Math.max(0, totalInvoiceValue - paid);
            stats.debt += remaining;
            
            stats.cash += paid;
            stats.totalOrders++;

            if (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) {
                stats.readyOrders++;
            }
            if (o.status === OrderStatus.SHIPPED_FROM_STORE) {
                stats.transitOrders++;
            }

            if (o.order_date && last7Days.has(o.order_date)) {
                const entry = last7Days.get(o.order_date)!;
                entry.count++;
                entry.val += netProfit;
            }
        });

        stats.chartData = Array.from(last7Days.entries())
            .map(([date, data]) => ({
                name: new Date(date).toLocaleDateString('ar-EG', { weekday: 'short' }),
                count: data.count,
                val: data.val
            }))
            .reverse();

        return stats;
    };

    const fetchFreshData = useCallback(async () => {
        if (!supabase) return;
        setIsBackgroundUpdating(true);
        
        try {
            const [sRes, cRes, curRes, uRes] = await Promise.all([
                supabase.from('AppSettings').select('*').limit(1),
                supabase.from('CompanyInfo').select('*').limit(1),
                supabase.from('Currencies').select('*'),
                supabase.from('Users').select('*')
            ]);

            if (sRes.data?.[0]) setSettings(mapSettings(sRes.data[0]));
            if (cRes.data?.[0]) setCompanyInfo(mapCompanyInfo(cRes.data[0]));
            if (curRes.data) setCurrencies(curRes.data);
            if (uRes.data) setUsers(uRes.data);

            let fetchedPaymentMethods: PaymentMethod[] = [];

            await Promise.allSettled([
                supabase.from('Stores').select('*').then(({ data }) => {
                    if (data) setStores(data.map(mapStore));
                }),
                supabase.from('PaymentMethods').select('*').then(({ data }) => {
                    if (data) {
                        const mapped = data.map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            number: p.number,
                            logo: p.logo,
                            note: p.note,
                            feeRate: p.fee_rate
                        }));
                        setPaymentMethods(mapped);
                        fetchedPaymentMethods = mapped;
                    }
                }),
                supabase.from('Cities').select('*').order('name').then(({ data }) => {
                    if (data) setCities(data.map((c: any) => ({ ...c, deliveryCost: c.delivery_cost, isLocal: c.is_local })));
                }),
                // Orders: Fetch ONLY first page
                supabase.from('Orders').select(ORDER_SELECT_FIELDS).order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1).then(({ data }) => {
                    if (data) {
                        setOrders(data.map(mapOrder));
                        saveToCache('Orders', data); 
                        setOrderPage(0);
                        setHasMoreOrders(data.length === PAGE_SIZE);
                    }
                }),
                // Clients: Fetch ALL (No pagination to ensure offline access to all clients)
                supabase.from('Clients').select('*', { count: 'exact' }).order('created_at', { ascending: false }).then(({ data, count }) => {
                    if (data) {
                        const mappedClients = data.map((c: any) => ({ ...c, whatsappNumber: c.whatsapp_number, cityId: c.city_id }));
                        setClients(mappedClients);
                        saveToCache('Clients', data); // Save ALL clients to cache
                        setClientsPage(0);
                        setHasMoreClients(false); // No more to fetch
                    }
                    if (count !== null) setTotalClientsCount(count);
                }),
                supabase.from('Shipments').select('id, shipment_number, shipping_type, transport_mode, shipping_company_id, departure_date, expected_arrival_date, status, country, total_weight, number_of_boxes').order('created_at', { ascending: false }).limit(50).then(({ data }) => {
                    if (data) {
                        setShipments(data.map((s: any) => ({ ...s, shipmentNumber: s.shipment_number, shippingType: s.shipping_type, shippingCompanyId: s.shipping_company_id, departureDate: s.departure_date, expectedArrivalDate: s.expected_arrival_date, numberOfBoxes: s.number_of_boxes })));
                    }
                })
            ]);

            const statsQuery = await supabase
                .from('Orders')
                .select('status, price_in_mru, commission, shipping_cost, local_delivery_cost, amount_paid, transaction_fee, payment_method, order_date')
                .neq('status', 'cancelled');
            
            if (statsQuery.data) {
                const stats = calculateDashboardStats(statsQuery.data, fetchedPaymentMethods);
                setDashboardStats(stats);
            }

            loadSecondaryData();

        } catch (e) {
            console.error("Critical Data Load Error:", e);
            setError(getErrorMessage(e));
        } finally {
            setIsBackgroundUpdating(false);
        }
    }, []);

    const loadSecondaryData = async () => {
        if (!supabase) return;
        const [shipComp, drawers, logs] = await Promise.all([
            supabase.from('ShippingCompanies').select('*'),
            supabase.from('StorageDrawers').select('*'),
            supabase.from('GlobalActivityLog').select('*').order('timestamp', { ascending: false }).limit(100)
        ]);

        if (shipComp.data) setShippingCompanies(shipComp.data.map((s: any) => ({ ...s, originCountry: s.origin_country, destinationCountry: s.destination_country, contactMethods: s.contact_methods })));
        if (drawers.data) setDrawers(drawers.data);
        if (logs.data) setGlobalActivityLog(logs.data.map(mapLog));
    };

    const loadMoreOrders = async () => {
        if (!supabase || isOrdersLoading || !hasMoreOrders) return;
        setIsOrdersLoading(true);
        const nextPage = orderPage + 1;
        const from = nextPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        try {
            const { data, error } = await supabase
                .from('Orders')
                .select(ORDER_SELECT_FIELDS)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            if (data && data.length > 0) {
                setOrders(prev => {
                    // Manual deduplication for load more
                    const newOrders = data.map(mapOrder);
                    const existingIds = new Set(prev.map(o => o.id));
                    const uniqueNew = newOrders.filter(o => !existingIds.has(o.id));
                    return [...prev, ...uniqueNew];
                });
                setOrderPage(nextPage);
                if (data.length < PAGE_SIZE) setHasMoreOrders(false);
            } else {
                setHasMoreOrders(false);
            }
        } catch (e) {
            console.error("Load more orders error:", e);
        } finally {
            setIsOrdersLoading(false);
        }
    };

    const loadMoreClients = async () => {
        // Disabled since we load all clients upfront for offline support
        return;
    };

    const searchOrders = async (term: string) => {
        if (!supabase) return;
        setIsOrdersLoading(true);
        try {
            if (!term) {
                // Reset to initial page
                const { data } = await supabase.from('Orders').select(ORDER_SELECT_FIELDS).order('created_at', { ascending: false }).limit(PAGE_SIZE);
                if (data) {
                    setOrders(data.map(mapOrder));
                    setOrderPage(0);
                    setHasMoreOrders(true);
                }
                return;
            }

            const { data, error } = await supabase
                .from('Orders')
                .select(ORDER_SELECT_FIELDS)
                .or(`local_order_id.ilike.%${term}%,tracking_number.ilike.%${term}%,global_order_id.ilike.%${term}%`)
                .limit(50);

            if (error) throw error;
            
            if (data) {
                setOrders(data.map(mapOrder));
                setHasMoreOrders(false); // Disable load more during search
            }
        } catch (e) {
            console.error("Search error:", e);
        } finally {
            setIsOrdersLoading(false);
        }
    };

    const searchClients = async (term: string) => {
        // Since we load all clients, we can rely on client-side filtering if needed, 
        // but if this function is called, we can still fetch from server if online to ensure freshness.
        // However, with "load all" strategy, the `clients` state already has data.
        // If we want to support partial search from server (in case "all" was too big and we reverted), we keep this.
        // For now, if online, searching server is fine, but if offline, the UI should use the local list.
        if (!supabase) return;
        
        // If we really fetched ALL clients in initial load, we don't strictly need server search unless the list is huge.
        // But let's keep it functional for consistency if the user is online.
        setIsClientsLoading(true);
        try {
            if (!term) {
                // If term is cleared, we might want to re-fetch all to ensure sync? 
                // Or just do nothing if we already have them. 
                // Let's re-fetch all to be safe and consistent with "Refresh".
                const { data, count } = await supabase.from('Clients').select('*', { count: 'exact' }).order('created_at', { ascending: false });
                if (data) {
                    const mappedClients = data.map((c: any) => ({ ...c, whatsappNumber: c.whatsapp_number, cityId: c.city_id }));
                    setClients(mappedClients);
                    saveToCache('Clients', data);
                    setHasMoreClients(false);
                    if (count !== null) setTotalClientsCount(count);
                }
                return;
            }

            const { data, error } = await supabase
                .from('Clients')
                .select('*')
                .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
                .limit(50);

            if (error) throw error;

            if (data) {
                setClients(data.map((c: any) => ({ ...c, whatsappNumber: c.whatsapp_number, cityId: c.city_id })));
                setHasMoreClients(false);
            }
        } catch (e) {
            console.error("Search clients error:", e);
        } finally {
            setIsClientsLoading(false);
        }
    };

    useEffect(() => {
        if (!isPublicCalculator && currentUser && !isInitializedRef.current) {
            fetchFreshData();
            isInitializedRef.current = true;
        }
    }, [currentUser, isPublicCalculator, fetchFreshData]);

    const logAction = async (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => {
        if (!supabase) return;
        const user = currentUser?.username || 'System';
        try {
            const newLog: GlobalActivityLog = {
                id: Math.random().toString(),
                timestamp: new Date().toISOString(),
                user,
                action,
                entityType,
                entityId,
                details
            };
            setGlobalActivityLog(prev => [newLog, ...prev]);

            await supabase.from('GlobalActivityLog').insert({
                user,
                action,
                entity_type: entityType,
                entity_id: entityId,
                details
            });
        } catch (e) { 
            console.error("Log failed", e); 
        }
    };

    return {
        orders, setOrders,
        clients, setClients,
        stores, setStores,
        shipments, setShipments,
        shippingCompanies, setShippingCompanies,
        drawers, setDrawers,
        currencies, setCurrencies,
        users, setUsers,
        paymentMethods, setPaymentMethods,
        cities, setCities, 
        companyInfo, setCompanyInfo,
        settings, setSettings,
        globalActivityLog,
        isBackgroundUpdating,
        error,
        setError,
        logAction,
        // Order Pagination
        loadMoreOrders,
        searchOrders,
        hasMoreOrders,
        isOrdersLoading,
        // Client Pagination & Stats
        loadMoreClients,
        searchClients,
        hasMoreClients,
        isClientsLoading,
        totalClientsCount,
        dashboardStats
    };
};

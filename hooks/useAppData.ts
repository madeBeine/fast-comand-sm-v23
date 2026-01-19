
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase, getErrorMessage } from '../supabaseClient';
import type { Order, Client, Store, Shipment, ShippingCompany, StorageDrawer, Currency, CompanyInfo, AppSettings, User, GlobalActivityLog, PaymentMethod, City, DashboardStats, Driver } from '../types';
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
        fr: `Bonjour {clientName} 👋\n\nBonne nouvelle ! Votre commande *#{orderId}* est arrivée ! 🎉✅\n\n📦 *Détails du paiement :*\n⚖️ Poids : {weight} kg\n✈️ Frais de port : {shippingCost} MRU\n{productRemainingLine}\n{deliveryLine}\n\n💰 *Total à payer (Livraison incluse) :*\\n👈 *{totalDue} MRU*\\n\\nMerci de votre confiance en {companyName} ❤️`
    },
    calculatorShortLink: '',
    notificationReminderEnabled: true,
    notificationReminderInterval: 60,
    mobileDockViews: ['dashboard', 'orders', 'delivery', 'clients'],
};

// --- Mappers ---
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
        invoiceTerms: data.invoice_terms ?? data.invoiceTerms,
        invoiceSignature: data.invoice_signature ?? data.invoiceSignature
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

export const mapOrder = (o: any): Order => ({
    ...o,
    localOrderId: o.local_order_id ?? o.localOrderId,
    globalOrderId: o.global_order_id ?? o.globalOrderId,
    clientId: o.client_id ?? o.clientId,
    storeId: o.store_id ?? o.storeId, 
    priceInMRU: o.price_in_mru ?? o.priceInMRU,
    amountPaid: o.amount_paid ?? o.amountPaid,
    paymentMethod: o.payment_method ?? o.paymentMethod,
    transactionFee: o.transaction_fee ?? o.transactionFee ?? 0,
    shippingType: o.shipping_type ?? o.shippingType,
    transportMode: o.transport_mode ?? o.transportMode,
    orderDate: o.order_date ?? o.orderDate,
    arrivalDateAtOffice: o.arrival_date_at_office ?? o.arrivalDateAtOffice,
    expectedArrivalDate: o.expected_arrival_date ?? o.expectedArrivalDate,
    commissionType: o.commission_type ?? o.commissionType,
    commissionRate: o.commission_rate ?? o.commissionRate,
    productLinks: o.product_links ?? o.productLinks,
    productImages: o.product_images ?? [], 
    orderImages: o.order_images ?? [],
    hubArrivalImages: o.hub_arrival_images ?? [],
    weighingImages: o.weighing_images ?? [],
    receiptImages: o.receipt_images ?? [], 
    trackingImages: o.tracking_images ?? [],
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
    isInvoicePrinted: o.is_invoice_printed ?? o.isInvoicePrinted ?? false,
    history: Array.isArray(o.history) ? o.history : [],
    localDeliveryCost: o.local_delivery_cost ?? o.localDeliveryCost ?? 0,
    driverName: o.driver_name ?? o.driverName,
    driverId: o.driver_id ?? o.driverId,
    deliveryRunId: o.delivery_run_id ?? o.deliveryRunId,
    isDeliveryFeePrepaid: o.is_delivery_fee_prepaid ?? o.isDeliveryFeePrepaid ?? false
});

const mapShipment = (d: any): Shipment => ({
    ...d,
    shipmentNumber: d.shipment_number,
    shippingType: d.shipping_type,
    transportMode: d.transport_mode,
    shippingCompanyId: d.shipping_company_id,
    departureDate: d.departure_date,
    expectedArrivalDate: d.expected_arrival_date,
    numberOfBoxes: d.number_of_boxes,
    containerNumber: d.container_number,
    receiptImage: d.receipt_image
});

const mapClient = (c: any): Client => ({
    ...c,
    whatsappNumber: c.whatsapp_number ?? c.whatsappNumber,
    cityId: c.city_id ?? c.cityId
});

const mapDriver = (d: any): Driver => ({
    ...d,
    nationalId: d.national_id ?? d.nationalId,
    vehicleType: d.vehicle_type ?? d.vehicleType,
    vehicleNumber: d.vehicle_number ?? d.vehicleNumber,
    isActive: d.is_active ?? d.isActive
});

// --- Constants ---
const PAGE_SIZE = 100;
const ORDER_SELECT_FIELDS = 'id, local_order_id, global_order_id, client_id, store_id, price, currency, price_in_mru, commission, quantity, amount_paid, payment_method, transaction_fee, shipping_type, transport_mode, order_date, arrival_date_at_office, expected_arrival_date, commission_type, commission_rate, product_links, notes, status, tracking_number, weight, shipping_cost, storage_location, storage_date, withdrawal_date, whatsapp_notification_sent, shipment_id, box_id, origin_center, receiving_company_id, is_invoice_printed, local_delivery_cost, driver_id, driver_name, delivery_run_id, is_delivery_fee_prepaid, history, created_at';
const SHIPMENT_SELECT_FIELDS = 'id, shipment_number, shipping_type, transport_mode, shipping_company_id, departure_date, expected_arrival_date, status, number_of_boxes, container_number, total_weight, history, rates_snapshot, created_at';

export const useAppData = (currentUser: User | null, isPublicCalculator: boolean) => {
    const { showToast } = useToast();
    const { playSound } = useSound();

    const [orders, setOrders] = useState<Order[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
    const [drawers, setDrawers] = useState<StorageDrawer[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: 'Fast Comand', logo: '', email: '', phone: '', address: '' });
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [globalActivityLog, setGlobalActivityLog] = useState<GlobalActivityLog[]>([]);
    
    const [isBackgroundUpdating, setIsBackgroundUpdating] = useState(false);
    const [isOrdersLoading, setIsOrdersLoading] = useState(false);
    const [isClientsLoading, setIsClientsLoading] = useState(false);
    const [hasMoreOrders, setHasMoreOrders] = useState(true);
    const [orderPage, setOrderPage] = useState(0);
    const [totalClientsCount, setTotalClientsCount] = useState(0);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isInitializedRef = useRef(false);

    // --- Helper to fetch missing clients in bulk ---
    const syncMissingClients = useCallback(async (orderList: Order[]) => {
        if (!supabase) return;
        
        const currentClientIds = new Set(clients.map(c => c.id));
        const missingIds = Array.from(new Set(orderList.map(o => o.clientId).filter(id => id && !currentClientIds.has(id))));
        
        if (missingIds.length > 0) {
            const { data: newClients } = await supabase.from('Clients').select('*').in('id', missingIds);
            if (newClients && newClients.length > 0) {
                setClients(prev => {
                    const existing = new Set(prev.map(c => c.id));
                    return [...prev, ...newClients.filter(nc => !existing.has(nc.id)).map(mapClient)];
                });
            }
        }
    }, [clients]);

    // --- REALTIME ---
    useEffect(() => {
        if (!currentUser || isPublicCalculator || !supabase) return;

        const channel = supabase.channel('schema-db-changes');

        const handleTableChange = async (payload: any, tableName: string) => {
            if (payload.eventType === 'DELETE') {
                const id = payload.old.id;
                if (tableName === 'Orders') setOrders(prev => prev.filter(o => o.id !== id));
                else if (tableName === 'Clients') setClients(prev => prev.filter(c => c.id !== id));
                else if (tableName === 'Shipments') setShipments(prev => prev.filter(s => s.id !== id));
                else if (tableName === 'Drivers') setDrivers(prev => prev.filter(d => d.id !== id));
                else if (tableName === 'Stores') setStores(prev => prev.filter(s => s.id !== id));
                else if (tableName === 'PaymentMethods') setPaymentMethods(prev => prev.filter(p => p.id !== id));
                else if (tableName === 'Cities') setCities(prev => prev.filter(c => c.id !== id));
                return;
            }

            const { data: freshRow, error: fetchError } = await supabase
                .from(tableName)
                .select(tableName === 'Orders' ? ORDER_SELECT_FIELDS : tableName === 'Shipments' ? SHIPMENT_SELECT_FIELDS : '*')
                .eq('id', payload.new.id)
                .single();

            if (fetchError || !freshRow) return;

            const updateState = (setter: React.Dispatch<React.SetStateAction<any[]>>, mapper: (item: any) => any) => {
                const mapped = mapper(freshRow);
                setter(prev => {
                    const exists = prev.some(item => item.id === mapped.id);
                    if (exists) return prev.map(item => item.id === mapped.id ? mapped : item);
                    return [mapped, ...prev];
                });
            };

            switch (tableName) {
                case 'Orders': 
                    const mappedOrder = mapOrder(freshRow);
                    updateState(setOrders, () => mappedOrder); 
                    if (payload.eventType === 'INSERT') {
                        playSound('success');
                        showToast(`طلب جديد: ${freshRow.local_order_id}`, 'success');
                        syncMissingClients([mappedOrder]);
                    }
                    break;
                case 'Clients': updateState(setClients, mapClient); break;
                case 'Shipments': updateState(setShipments, mapShipment); break;
                case 'Drivers': updateState(setDrivers, mapDriver); break;
                case 'Stores': updateState(setStores, mapStore); break;
                case 'PaymentMethods': updateState(setPaymentMethods, (p) => ({...p, feeRate: p.fee_rate})); break;
                case 'Cities': updateState(setCities, (c) => ({...c, deliveryCost: c.delivery_cost, isLocal: c.is_local})); break;
                case 'AppSettings': setSettings(mapSettings(freshRow)); break;
                case 'CompanyInfo': setCompanyInfo(mapCompanyInfo(freshRow)); break;
                case 'GlobalActivityLog': updateState(setGlobalActivityLog, mapLog); break;
                case 'Currencies': updateState(setCurrencies, (c) => c); break;
                case 'Users': updateState(setUsers, (u) => u); break;
            }
        };

        const tables = [
            'Orders', 'Clients', 'Shipments', 'Drivers', 'Stores', 
            'PaymentMethods', 'Cities', 'AppSettings', 'CompanyInfo', 
            'GlobalActivityLog', 'Currencies', 'Users', 'StorageDrawers'
        ];

        tables.forEach(table => {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, (p) => handleTableChange(p, table));
        });

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUser, isPublicCalculator, playSound, showToast, syncMissingClients]);

    // --- Statistics ---
    useEffect(() => {
        const calculateStats = () => {
            let profit = 0; let revenue = 0; let debt = 0; let cash = 0;
            let totalOrders = 0; let readyOrders = 0; let transitOrders = 0;
            const chartMap: Record<string, { revenue: number, profit: number }> = {};

            orders.forEach(o => {
                totalOrders++;
                if (o.status === OrderStatus.CANCELLED || o.status === OrderStatus.NEW) return;
                if (o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE) readyOrders++;
                if (o.status === OrderStatus.SHIPPED_FROM_STORE) transitOrders++;

                const price = Number(o.priceInMRU || 0); const comm = Number(o.commission || 0);
                const ship = Number(o.shippingCost || 0); const del = Number(o.localDeliveryCost || 0);
                const paid = Number(o.amountPaid || 0); 
                
                let fee = Number(o.transactionFee || 0);
                if (fee === 0 && paid > 0 && o.paymentMethod) {
                    const method = paymentMethods.find(m => m.name === o.paymentMethod);
                    if (method && method.feeRate > 0) {
                        fee = (paid * method.feeRate) / 100;
                    }
                }

                const total = price + comm + ship + del;
                revenue += total; cash += paid; debt += Math.max(0, total - paid);
                
                const orderProfit = comm - fee;
                profit += orderProfit;

                const date = o.orderDate;
                if (!chartMap[date]) chartMap[date] = { revenue: 0, profit: 0 };
                chartMap[date].revenue += total; 
                chartMap[date].profit += orderProfit;
            });

            const chartData = Object.entries(chartMap)
                .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
                .slice(-7)
                .map(([date, val]) => ({
                    name: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    val: Math.round(val.profit),
                    count: orders.filter(o => o.orderDate === date && o.status !== OrderStatus.CANCELLED).length
                }));

            setDashboardStats({ 
                profit: Math.round(profit), 
                revenue: Math.round(revenue), 
                debt: Math.round(debt), 
                cash: Math.round(cash), 
                totalOrders, 
                readyOrders, 
                transitOrders, 
                chartData 
            });
        };
        if (orders.length > 0) calculateStats();
    }, [orders, paymentMethods]);

    const fetchFreshData = useCallback(async () => {
        if (!supabase || isPublicCalculator) return;
        setIsBackgroundUpdating(true);
        try {
            const [
                { data: ordersData },
                { data: storesData },
                { data: companiesData },
                { data: drawersData },
                { data: currenciesData },
                { data: usersData },
                { data: paymentsData },
                { data: settingsData },
                { data: companyInfoData },
                { data: citiesData },
                { data: driversData }
            ] = await Promise.all([
                supabase.from('Orders').select(ORDER_SELECT_FIELDS, { count: 'exact' }).order('local_order_id', { ascending: false }).limit(PAGE_SIZE),
                supabase.from('Stores').select('*'),
                supabase.from('ShippingCompanies').select('*'),
                supabase.from('StorageDrawers').select('*'),
                supabase.from('Currencies').select('*'),
                supabase.from('Users').select('*'),
                supabase.from('PaymentMethods').select('*'),
                supabase.from('AppSettings').select('*').limit(1).maybeSingle(),
                supabase.from('CompanyInfo').select('*').limit(1).maybeSingle(),
                supabase.from('Cities').select('*'),
                supabase.from('Drivers').select('*')
            ]);

            const mappedOrders = ordersData ? ordersData.map(mapOrder) : [];
            if (ordersData) setOrders(mappedOrders);
            if (storesData) setStores(storesData.map(mapStore));
            
            const { data: shipmentsData } = await supabase.from('Shipments').select(SHIPMENT_SELECT_FIELDS).order('created_at', { ascending: false }).limit(20);
            if (shipmentsData) setShipments(shipmentsData.map(mapShipment));

            const { data: clientsData, count: clientsCount } = await supabase.from('Clients').select('*', { count: 'exact' }).order('created_at', { ascending: false });
            if (clientsData) setClients(clientsData.map(mapClient));
            if (clientsCount !== null) setTotalClientsCount(clientsCount);

            if (companiesData) setShippingCompanies(companiesData.map(d => ({ ...d, originCountry: d.origin_country, destinationCountry: d.destination_country, contactMethods: d.contact_methods })));
            if (drawersData) setDrawers(drawersData);
            if (currenciesData) setCurrencies(currenciesData);
            if (usersData) setUsers(usersData);
            if (paymentsData) setPaymentMethods(paymentsData.map(d => ({ ...d, feeRate: d.fee_rate })));
            if (settingsData) setSettings(mapSettings(settingsData));
            if (companyInfoData) setCompanyInfo(mapCompanyInfo(companyInfoData));
            if (citiesData) setCities(citiesData.map(d => ({...d, deliveryCost: d.delivery_cost, isLocal: d.is_local})));
            if (driversData) setDrivers(driversData.map(mapDriver));

            const { data: logData } = await supabase.from('GlobalActivityLog').select('*').order('timestamp', { ascending: false }).limit(50);
            if (logData) setGlobalActivityLog(logData.map(mapLog));

            if (mappedOrders.length > 0) syncMissingClients(mappedOrders);

        } catch (e) {
            console.error("Fetch data error", e);
        } finally {
            setIsBackgroundUpdating(false);
        }
    }, [isPublicCalculator, syncMissingClients]);

    useEffect(() => {
        if (!isInitializedRef.current && currentUser && !isPublicCalculator) {
            isInitializedRef.current = true;
            fetchFreshData();
        }
    }, [currentUser, isPublicCalculator, fetchFreshData]);

    const logAction = useCallback(async (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => {
        if (!currentUser || isPublicCalculator || !supabase) return;
        try {
            await supabase.from('GlobalActivityLog').insert({
                user: currentUser.username,
                action,
                entity_type: entityType,
                entity_id: entityId,
                details,
                timestamp: new Date().toISOString()
            });
        } catch (error) { console.error("Log action failed", error); }
    }, [currentUser, isPublicCalculator]);

    const loadMoreOrders = async () => {
        if (!hasMoreOrders || isOrdersLoading || !supabase) return;
        setIsOrdersLoading(true);
        try {
            const nextPage = orderPage + 1;
            const from = nextPage * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data } = await supabase.from('Orders').select(ORDER_SELECT_FIELDS).order('local_order_id', { ascending: false }).range(from, to);
            if (data && data.length > 0) {
                const mapped = data.map(mapOrder);
                setOrders(prev => [...prev, ...mapped]);
                setOrderPage(nextPage);
                syncMissingClients(mapped);
            } else setHasMoreOrders(false);
        } finally { setIsOrdersLoading(false); }
    };

    const searchOrders = async (term: string): Promise<Order[]> => {
        if (!supabase) return [];
        try {
            if (!term.trim()) return orders;
            const { data: clientData } = await supabase.from('Clients').select('id').or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(50);
            const clientIds = clientData?.map(c => c.id) || [];
            let query = supabase.from('Orders').select(ORDER_SELECT_FIELDS);
            const conditions = [`local_order_id.ilike.%${term}%`, `global_order_id.ilike.%${term}%`, `tracking_number.ilike.%${term}%`];
            if (clientIds.length > 0) conditions.push(`client_id.in.(${clientIds.join(',')})`);
            query = query.or(conditions.join(','));
            const { data } = await query.order('local_order_id', { ascending: false }).limit(50);
            const result = data ? data.map(mapOrder) : [];
            if (result.length > 0) syncMissingClients(result);
            return result;
        } catch (e) { return []; }
    };

    const searchClients = async (term: string) => {
        if (!supabase) return;
        setIsClientsLoading(true);
        try {
            const { data } = await supabase.from('Clients').select('*').or(`name.ilike.%${term}%,phone.ilike.%${term}%`).limit(50);
            if (data) {
                setClients(prev => {
                    // Combine lists while preventing duplicates at the state level
                    const existingMap = new Map(prev.map(c => [c.id, c]));
                    data.forEach(item => {
                        const mapped = mapClient(item);
                        existingMap.set(mapped.id, mapped);
                    });
                    return Array.from(existingMap.values());
                });
            }
        } finally {
            setIsClientsLoading(false);
        }
    };

    return {
        orders, setOrders, clients, setClients, stores, setStores, shipments, setShipments,
        shippingCompanies, setShippingCompanies, drawers, setDrawers, currencies, setCurrencies,
        users, setUsers, paymentMethods, setPaymentMethods, cities, setCities, drivers, setDrivers,
        companyInfo, setCompanyInfo, settings, setSettings, globalActivityLog, isBackgroundUpdating, error, setError,
        logAction, loadMoreOrders, searchOrders, hasMoreOrders, isOrdersLoading,
        loadMoreClients: async () => {}, searchClients, hasMoreClients: false, isClientsLoading, totalClientsCount, dashboardStats
    };
};

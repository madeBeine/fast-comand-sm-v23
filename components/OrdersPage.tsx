
import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import type { Order, Client, Store, Currency, ShippingCompany, StorageDrawer, AppSettings, User, CompanyInfo, PaymentMethod, City, GlobalActivityLog } from '../types';
import { OrderStatus, ShippingType } from '../types';
import { Search, Loader2, ArrowDown, X, Zap, FileText, Printer, Trash2, Truck, RefreshCw, Layers, History, DollarSign, Ban, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase, getErrorMessage } from '../supabaseClient';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import OrderCard from './OrderCard';
import OrderFormModal from './OrderFormModal';
import OrderStatusModal from './OrderStatusModal';
import OrderDetailsModal from './OrderDetailsModal';
import SplitOrderModal from './SplitOrderModal';
import HistoryLogModal from './HistoryLogModal';
import PaymentModal from './PaymentModal';
import PasswordConfirmationModal from './PasswordConfirmationModal';
import ClientDetailsModal from './ClientDetailsModal';
import NotificationLanguageModal, { NotificationLanguage } from './NotificationLanguageModal';

interface OrdersPageProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    clients: Client[];
    stores: Store[];
    currencies: Currency[];
    shippingCompanies: ShippingCompany[];
    activeFilter: string | null;
    clearFilter: () => void;
    commissionRate: number;
    drawers: StorageDrawer[];
    paymentMethods: PaymentMethod[]; 
    settings: AppSettings;
    shouldOpenModal: boolean;
    onModalOpenHandled: () => void;
    companyInfo: CompanyInfo;
    users: User[];
    cities: City[];
    loadMoreOrders: () => void;
    searchOrders: (term: string) => Promise<Order[]>; 
    hasMoreOrders: boolean;
    isOrdersLoading: boolean;
    searchClients: (term: string) => void; 
    logAction: (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => void;
    externalSearchTerm?: string; 
    externalStoreFilter?: string | 'all'; 
    externalSmartFilter?: string; 
}

const OrdersPage: React.FC<OrdersPageProps> = ({ 
    orders, setOrders, clients, stores, currencies, shippingCompanies, 
    commissionRate, drawers, paymentMethods, 
    settings, shouldOpenModal, onModalOpenHandled, companyInfo, users, cities,
    loadMoreOrders, searchOrders, hasMoreOrders, isOrdersLoading, logAction, 
    externalSearchTerm, externalStoreFilter = 'all', externalSmartFilter = 'all', searchClients
}) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const { showToast } = useToast();

    // Search Results State
    const [searchResults, setSearchResults] = useState<Order[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modal Visibility States
    const [isFormModalOpen, setFormModalOpen] = useState(false);
    const [isStatusModalOpen, setStatusModalOpen] = useState(false);
    const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
    const [isSplitModalOpen, setSplitModalOpen] = useState(false);
    const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
    
    // Selection States
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (shouldOpenModal) {
            setSelectedOrder(null);
            setFormModalOpen(true);
            onModalOpenHandled();
        }
    }, [shouldOpenModal, onModalOpenHandled]);

    useEffect(() => {
        if (externalSearchTerm !== undefined) {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            if (externalSearchTerm.trim()) {
                setIsSearching(true);
                searchTimeoutRef.current = setTimeout(async () => {
                    const results = await searchOrders(externalSearchTerm);
                    setSearchResults(results);
                    setIsSearching(false);
                }, 600);
            } else {
                setSearchResults(null);
                setIsSearching(false);
            }
        }
    }, [externalSearchTerm, searchOrders]);

    const filteredOrders = useMemo(() => {
        let result = searchResults !== null ? searchResults : orders;
        if (!externalSearchTerm && externalSmartFilter !== 'all') {
            switch (externalSmartFilter) {
                case 'ready_pickup': 
                    result = result.filter(o => o.status === OrderStatus.STORED || o.status === OrderStatus.ARRIVED_AT_OFFICE); 
                    break;
                case 'late':
                    const today = new Date().toISOString().split('T')[0];
                    result = result.filter(o => (o.status === OrderStatus.ORDERED || o.status === OrderStatus.SHIPPED_FROM_STORE) && o.expectedArrivalDate && o.expectedArrivalDate < today);
                    break;
                case 'needs_tracking':
                    result = result.filter(o => o.status === OrderStatus.ORDERED && !o.trackingNumber);
                    break;
                case 'pending_invoice':
                    result = result.filter(o => o.status === OrderStatus.ORDERED && !o.isInvoicePrinted);
                    break;
                default: 
                    result = result.filter(o => o.status === externalSmartFilter);
            }
        }
        if (externalStoreFilter !== 'all') {
            result = result.filter(o => o.storeId === externalStoreFilter);
        }

        // --- ENHANCED SORTING LOGIC ---
        return [...result].sort((a, b) => {
            // 1. Status Check: Completed orders always at the bottom
            const aIsCompleted = a.status === OrderStatus.COMPLETED;
            const bIsCompleted = b.status === OrderStatus.COMPLETED;

            if (aIsCompleted && !bIsCompleted) return 1;
            if (!aIsCompleted && bIsCompleted) return -1;

            // 2. Both are same "group" (active or completed), sort by local ID
            // Natural Numeric Sorting for localOrderId (FCD-100, FCD-99, FCD-1)
            // Using Descending order (newer/larger IDs first within their group)
            return b.localOrderId.localeCompare(a.localOrderId, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [orders, searchResults, externalSmartFilter, externalStoreFilter, externalSearchTerm]);

    // --- ACTIONS ---

    const handleSaveOrder = async (orderData: Order) => {
        if (!supabase) return;
        setIsSaving(true);
        try {
            const dbPayload: any = {
                local_order_id: orderData.localOrderId,
                global_order_id: orderData.globalOrderId,
                client_id: orderData.clientId,
                store_id: orderData.storeId,
                price: orderData.price,
                currency: orderData.currency,
                price_in_mru: orderData.priceInMRU,
                commission: orderData.commission,
                quantity: orderData.quantity,
                amount_paid: orderData.amountPaid,
                payment_method: orderData.paymentMethod,
                shipping_type: orderData.shippingType,
                transport_mode: orderData.transportMode,
                order_date: orderData.orderDate,
                expected_arrival_date: orderData.expectedArrivalDate,
                product_links: orderData.productLinks,
                product_images: orderData.productImages,
                receipt_images: orderData.receiptImages,
                notes: orderData.notes,
                status: orderData.status,
                origin_center: orderData.originCenter,
                history: [...(orderData.history || []), { timestamp: new Date().toISOString(), activity: orderData.id ? 'Updated Order' : 'Created Order', user: currentUser?.username }]
            };
            let res;
            if (orderData.id) res = await supabase.from('Orders').update(dbPayload).eq('id', orderData.id).select().single();
            else res = await supabase.from('Orders').insert(dbPayload).select().single();
            if (res.error) throw res.error;
            showToast(orderData.id ? 'تم تحديث الطلب بنجاح' : 'تم إضافة الطلب بنجاح', 'success');
            setFormModalOpen(false);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateOrderStatus = async (orderId: string, payload: Partial<Order>) => {
        if (!supabase) return;
        try {
            const dbPayload: any = {};
            if (payload.status) dbPayload.status = payload.status;
            if (payload.globalOrderId) dbPayload.global_order_id = payload.globalOrderId;
            if (payload.trackingNumber) dbPayload.tracking_number = payload.trackingNumber;
            if (payload.weight !== undefined) dbPayload.weight = payload.weight;
            if (payload.shippingCost !== undefined) dbPayload.shipping_cost = payload.shippingCost;
            if (payload.storageLocation) dbPayload.storage_location = payload.storageLocation;
            if (payload.arrivalDateAtOffice) dbPayload.arrival_date_at_office = payload.arrivalDateAtOffice;
            if (payload.storageDate) dbPayload.storage_date = payload.storageDate;
            if (payload.withdrawalDate) dbPayload.withdrawal_date = payload.withdrawalDate;
            if (payload.orderImages) dbPayload.order_images = payload.orderImages;
            if (payload.trackingImages) dbPayload.tracking_images = payload.trackingImages;
            if (payload.weighingImages) dbPayload.weighing_images = payload.weighingImages;
            if (payload.hubArrivalImages) dbPayload.hub_arrival_images = payload.hubArrivalImages;
            if (payload.originCenter) dbPayload.origin_center = payload.originCenter;
            if (payload.shippingType) dbPayload.shipping_type = payload.shippingType;
            if (payload.localDeliveryCost !== undefined) dbPayload.local_delivery_cost = payload.localDeliveryCost;
            
            const order = orders.find(o => o.id === orderId);
            dbPayload.history = [...(order?.history || []), { 
                timestamp: new Date().toISOString(), 
                activity: `Status changed to ${payload.status || 'Updated'}`, 
                user: currentUser?.username 
            }];

            const { error } = await supabase.from('Orders').update(dbPayload).eq(orderId.includes('-') ? 'id' : 'local_order_id', orderId);
            if (error) throw error;
            showToast('تم تحديث حالة الطلب', 'success');
            setStatusModalOpen(false);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const handlePaymentConfirm = async (orderId: string, details: any) => {
        if (!supabase || !selectedOrder) return;
        try {
            const user = currentUser?.username || 'System';
            const timestamp = new Date().toISOString();
            
            const { error: payError } = await supabase.from('OrderPayments').insert({
                order_id: selectedOrder.id,
                amount: details.amountPaid,
                payment_method: details.paymentMethod,
                receipt_images: details.receiptImages,
                created_by: user,
                notes: `Manual Update from Card`
            });
            if (payError) throw payError;

            const newTotalPaid = (Number(selectedOrder.amountPaid) || 0) + details.amountPaid;
            const { error: orderError } = await supabase.from('Orders').update({
                amount_paid: newTotalPaid,
                local_delivery_cost: details.localDeliveryCost,
                transaction_fee: (Number(selectedOrder.transactionFee) || 0) + details.transactionFee,
                history: [...(selectedOrder.history || []), { timestamp, activity: `Registered payment: ${details.amountPaid} MRU`, user }]
            }).eq('id', selectedOrder.id);
            if (orderError) throw orderError;

            showToast('تم تسجيل الدفعة بنجاح', 'success');
            setIsPaymentModalOpen(false);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const handleNotificationConfirm = async (lang: NotificationLanguage) => {
        if (!selectedOrder || !supabase) return;
        const client = clients.find(c => c.id === selectedOrder.clientId);
        if (!client) return;

        try {
            const template = settings.whatsappTemplates?.[lang] || settings.whatsappTemplates?.['ar'];
            if (!template) throw new Error("Template not found");

            const totalDue = (Number(selectedOrder.priceInMRU) || 0) + (Number(selectedOrder.commission) || 0) + (Number(selectedOrder.shippingCost) || 0) + (Number(selectedOrder.localDeliveryCost) || 0);
            const remaining = Math.round(totalDue - (selectedOrder.amountPaid || 0));

            const prodRem = (Number(selectedOrder.priceInMRU) || 0) + (Number(selectedOrder.commission) || 0) - (selectedOrder.amountPaid || 0);
            const productRemainingLine = prodRem > 0 
                ? (lang === 'ar' ? `💰 متبقي من ثمن الطلب: ${prodRem} MRU` : `💰 Product Balance: ${prodRem} MRU`)
                : (lang === 'ar' ? `✅ ثمن المنتج مدفوع مسبقاً` : `✅ Product fully prepaid`);
            
            const deliveryLine = (selectedOrder.localDeliveryCost || 0) > 0 
                ? (lang === 'ar' ? `🚗 توصيل منزلي: ${selectedOrder.localDeliveryCost} MRU` : `🚗 Delivery Fee: ${selectedOrder.localDeliveryCost} MRU`)
                : '';

            const message = template
                .replace(/{clientName}/g, client.name)
                .replace(/{orderId}/g, selectedOrder.localOrderId)
                .replace(/{weight}/g, (selectedOrder.weight || 0).toString())
                .replace(/{shippingCost}/g, (selectedOrder.shippingCost || 0).toString())
                .replace(/{totalDue}/g, remaining.toString())
                .replace(/{productRemainingLine}/g, productRemainingLine)
                .replace(/{deliveryLine}/g, deliveryLine)
                .replace(/{companyName}/g, companyInfo.name);

            const whatsappUrl = `https://wa.me/${(client.whatsappNumber || client.phone).replace(/\s+/g, '')}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');

            // UPDATE DATABASE & HISTORY FOR REAL-TIME SYNC
            await supabase.from('Orders').update({ 
                whatsapp_notification_sent: true,
                history: [...(selectedOrder.history || []), { 
                    timestamp: new Date().toISOString(), 
                    activity: `WhatsApp Alert sent (${lang})`, 
                    user: currentUser?.username || 'System' 
                }]
            }).eq('id', selectedOrder.id);
            
            showToast('تم فتح واتساب لتنبيه العميل وتحديث الحالة', 'success');
            setIsNotificationModalOpen(false);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const handleInvoiceSent = async (order: Order) => {
        if (!supabase) return;
        try {
            const { error } = await supabase.from('Orders').update({ is_invoice_printed: true }).eq('id', order.id);
            if (error) throw error;
            
            // 1. Update main orders list
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, isInvoicePrinted: true } : o));
            
            // 2. Update search results list if it exists
            if (searchResults) {
                setSearchResults(prev => prev ? prev.map(o => o.id === order.id ? { ...o, isInvoicePrinted: true } : o) : null);
            }
            
            showToast('تم تحديث حالة الفاتورة بنجاح', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const handleRevertStatus = async (orderId: string, password?: string): Promise<boolean> => {
        if (!supabase) return false;
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) return false;
            let prevStatus: OrderStatus;
            switch (order.status) {
                case OrderStatus.ORDERED: prevStatus = OrderStatus.NEW; break;
                case OrderStatus.SHIPPED_FROM_STORE: prevStatus = OrderStatus.ORDERED; break;
                case OrderStatus.ARRIVED_AT_OFFICE: prevStatus = OrderStatus.SHIPPED_FROM_STORE; break;
                case OrderStatus.STORED: prevStatus = OrderStatus.ARRIVED_AT_OFFICE; break;
                case OrderStatus.OUT_FOR_DELIVERY: prevStatus = OrderStatus.STORED; break;
                case OrderStatus.COMPLETED: prevStatus = OrderStatus.OUT_FOR_DELIVERY; break;
                default: return false;
            }
            const { error } = await supabase.from('Orders').update({ 
                status: prevStatus,
                history: [...(order.history || []), { timestamp: new Date().toISOString(), activity: `Status reverted to ${prevStatus}`, user: currentUser?.username }]
            }).eq('id', orderId);
            if (error) throw error;
            showToast('تم التراجع عن الحالة بنجاح', 'success');
            return true;
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
            return false;
        }
    };

    const handleDeleteOrder = async (password: string) => {
        if (!supabase || !selectedOrder) return;
        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: currentUser?.email || '',
                password
            });
            if (authError) throw new Error('كلمة المرور غير صحيحة');
            const { error } = await supabase.from('Orders').delete().eq('id', selectedOrder.id);
            if (error) throw error;
            showToast('تم حذف الطلب بنجاح', 'success');
            setIsDeleteModalOpen(false);
            setSelectedOrder(null);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    return (
        <div className="space-y-4 pb-20 relative">
            {/* Modals Container */}
            <OrderFormModal 
                isOpen={isFormModalOpen} 
                onClose={() => setFormModalOpen(false)} 
                onSave={handleSaveOrder} 
                order={selectedOrder} 
                clients={clients} 
                stores={stores} 
                currencies={currencies} 
                commissionRate={commissionRate} 
                settings={settings} 
                shippingCompanies={shippingCompanies} 
                paymentMethods={paymentMethods} 
                orders={orders} 
                onClientSearch={searchClients} 
                isSaving={isSaving}
            />
            
            <OrderStatusModal 
                isOpen={isStatusModalOpen} 
                onClose={() => setStatusModalOpen(false)} 
                order={selectedOrder} 
                allOrders={orders} 
                drawers={drawers} 
                clients={clients} 
                onUpdate={handleUpdateOrderStatus} 
                onRevert={handleRevertStatus} 
                shippingCompanies={shippingCompanies} 
                settings={settings} 
                cities={cities} 
            />

            <OrderDetailsModal 
                isOpen={isDetailsModalOpen} 
                onClose={() => setDetailsModalOpen(false)} 
                order={selectedOrder} 
                client={clients.find(c => c.id === selectedOrder?.clientId)} 
                store={stores.find(s => s.id === selectedOrder?.storeId)} 
            />

            <SplitOrderModal 
                isOpen={isSplitModalOpen} 
                onClose={() => setSplitModalOpen(false)} 
                onSplit={async (id, data) => { /* Logic handled in component */ }} 
                order={selectedOrder} 
            />

            <HistoryLogModal 
                isOpen={isHistoryModalOpen} 
                onClose={() => setHistoryModalOpen(false)} 
                history={selectedOrder?.history} 
                title={`سجل تتبع الطلب #${selectedOrder?.localOrderId}`} 
            />

            <PaymentModal 
                isOpen={isPaymentModalOpen} 
                onClose={() => setIsPaymentModalOpen(false)} 
                order={selectedOrder} 
                paymentMethods={paymentMethods} 
                onConfirm={handlePaymentConfirm}
            />

            <NotificationLanguageModal 
                isOpen={isNotificationModalOpen} 
                onClose={() => setIsNotificationModalOpen(false)} 
                onConfirm={handleNotificationConfirm} 
            />

            <PasswordConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteOrder}
                title="حذف طلب"
                message={`هل أنت متأكد من حذف الطلب #${selectedOrder?.localOrderId}؟ هذا الإجراء لا يمكن التراجع عنه.`}
            />

            {selectedClientForDetails && (
                <ClientDetailsModal 
                    isOpen={!!selectedClientForDetails}
                    onClose={() => setSelectedClientForDetails(null)}
                    client={selectedClientForDetails}
                    clientOrders={orders.filter(o => o.clientId === selectedClientForDetails.id)}
                    cities={cities}
                    onUpdateClient={async (c) => {}}
                />
            )}

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                {filteredOrders.map(order => (
                    <div key={order.id} className="relative group">
                        <OrderCard 
                            order={order} 
                            client={clients.find(c => c.id === order.clientId)} 
                            store={stores.find(s => s.id === order.storeId)} 
                            users={users} 
                            settings={settings} 
                            companyInfo={companyInfo}
                            onEdit={() => { setSelectedOrder(order); setFormModalOpen(true); }}
                            onDelete={() => { setSelectedOrder(order); setIsDeleteModalOpen(true); }}
                            onCancel={() => {}}
                            onChangeStatus={() => { setSelectedOrder(order); setStatusModalOpen(true); }}
                            onUpdatePayment={(o) => { setSelectedOrder(o); setIsPaymentModalOpen(true); }}
                            onHistory={() => { setSelectedOrder(order); setHistoryModalOpen(true); }}
                            onView={() => { setSelectedOrder(order); setDetailsModalOpen(true); }}
                            onSplit={() => { setSelectedOrder(order); setSplitModalOpen(true); }}
                            onPrintInvoice={(o) => { setSelectedOrder(o); }}
                            onSendNotification={(o) => { setSelectedOrder(o); setIsNotificationModalOpen(true); }}
                            onShareInvoice={(o) => { setSelectedOrder(o); }}
                            onInvoiceSent={handleInvoiceSent}
                            onClientClick={setSelectedClientForDetails}
                            searchTerm={externalSearchTerm}
                        />
                    </div>
                ))}
            </div>

            {filteredOrders.length === 0 && !isOrdersLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <History size={64} strokeWidth={1} className="mb-4 opacity-20"/>
                    <p className="font-bold">{t('noOrdersFound')}</p>
                </div>
            )}

            {hasMoreOrders && !externalSearchTerm && (
                <div className="flex justify-center mt-8">
                    <button 
                        onClick={loadMoreOrders} 
                        disabled={isOrdersLoading}
                        className="px-8 py-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-full shadow-md hover:shadow-lg transition-all font-bold flex items-center gap-2"
                    >
                        {isOrdersLoading ? <Loader2 className="animate-spin" size={20}/> : <ArrowDown size={20}/>}
                        {isOrdersLoading ? 'جاري التحميل...' : 'تحميل المزيد'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;

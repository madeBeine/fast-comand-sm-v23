
import React, { useState, useContext, useRef, useEffect } from 'react';
import type { Store, ShippingCompany, Currency, AppSettings, CompanyInfo, User, GlobalActivityLog, View, PaymentMethod, City, ShippingZone, Order } from '../types';
import { 
    Building, Truck, DollarSign, Settings, Users, 
    Plus, Save, Loader2, X, Trash2, ShoppingBag, 
    Upload, CreditCard, MapPin, Edit2, 
    Smartphone, FileText, Globe, Plane, Ship, Phone, Hash, Wallet, Coins, ArrowRightLeft, Calculator, RefreshCw, Database, Smartphone as SmartphoneIcon, ArrowUp, ArrowDown, Menu, Lock, FileSpreadsheet, Download, Sparkles
} from 'lucide-react';
import UsersPage from './UsersPage';
import AuditLogPage from './AuditLogPage';
import { supabase, getErrorMessage } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useSound } from '../contexts/SoundContext';
import { AuthContext } from '../contexts/AuthContext';
import PasswordConfirmationModal from './PasswordConfirmationModal';
import { DEFAULT_SETUP_CODE, DEFAULT_SETUP_USERNAME } from '../constants';
import * as XLSX from 'xlsx';
import HelpIcon from './HelpIcon';
import { HELP_CONTENT } from '../utils/helpContent';

// --- Constants & Types ---
const SETTINGS_NAV = [
    { id: 'company', label: 'ملف الشركة', icon: Building, helpKey: 'company_profile' as const },
    { id: 'system', label: 'إعدادات النظام', icon: Settings, helpKey: 'system_config' as const },
    { id: 'data_management', label: 'إدارة البيانات', icon: FileSpreadsheet, helpKey: 'system_config' as const },
    { id: 'payment_methods', label: 'وسائل الدفع', icon: CreditCard, helpKey: 'payment_methods' as const },
    { id: 'currencies', label: 'العملات', icon: DollarSign, helpKey: 'currencies' as const },
    { id: 'cities', label: 'المناطق والمدن', icon: MapPin, helpKey: 'cities' as const },
    { id: 'stores', label: 'المتاجر', icon: ShoppingBag, helpKey: 'stores' as const },
    { id: 'shipping', label: 'شركات الشحن', icon: Truck, helpKey: 'stores' as const },
    { id: 'users', label: 'المستخدمين', icon: Users, helpKey: 'user_roles' as const },
    { id: 'audit', label: 'سجل العمليات', icon: FileText, helpKey: 'system_config' as const },
];

const AVAILABLE_VIEWS: { id: string, label: string }[] = [
    { id: 'dashboard', label: 'لوحة التحكم' },
    { id: 'orders', label: 'الطلبات' },
    { id: 'shipments', label: 'الشحنات' },
    { id: 'clients', label: 'العملاء' },
    { id: 'storage', label: 'المخزن' },
    { id: 'delivery', label: 'السحب والتسليم' },
    { id: 'billing', label: 'الفوترة' },
    { id: 'finance', label: 'المالية' },
    { id: 'settings', label: 'الإعدادات' },
];

interface SettingsPageProps {
    stores: Store[];
    setStores: React.Dispatch<React.SetStateAction<Store[]>>;
    shippingCompanies: ShippingCompany[];
    setShippingCompanies: React.Dispatch<React.SetStateAction<ShippingCompany[]>>;
    currencies: Currency[];
    setCurrencies: React.Dispatch<React.SetStateAction<Currency[]>>;
    settings: AppSettings;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    paymentMethods: PaymentMethod[];
    onUpdatePaymentMethods: (methods: PaymentMethod[]) => void;
    companyInfo: CompanyInfo;
    setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    globalActivityLog: GlobalActivityLog[];
    logAction: (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => void;
    setView: (view: View) => void; 
    cities: City[];
    setCities: React.Dispatch<React.SetStateAction<City[]>>;
    orders: Order[];
}

const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async (event) => {
            if (!event.target?.result) return reject("Failed to read file");
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject("Canvas error");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const outputType = (file.type === 'image/png' || file.type === 'image/webp') ? file.type : 'image/jpeg';
                resolve(canvas.toDataURL(outputType, 0.9));
            };
        };
        reader.onerror = error => reject(error);
    });
};

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    stores, setStores, shippingCompanies, setShippingCompanies, currencies, setCurrencies,
    settings, setSettings, paymentMethods, onUpdatePaymentMethods, companyInfo, setCompanyInfo,
    users, setUsers, globalActivityLog, logAction, cities, setCities, orders
}) => {
    const { playSound } = useSound();
    const { showToast } = useToast();
    const { currentUser } = useContext(AuthContext);
    const isAdmin = currentUser?.role === 'admin';
    
    const [activeTab, setActiveTab] = useState<string>('company');
    const [isSaving, setIsSaving] = useState(false);
    
    const [modalType, setModalType] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, type: string } | null>(null);

    const [isClearCacheModalOpen, setIsClearCacheModalOpen] = useState(false);

    const [tempCompanyInfo, setTempCompanyInfo] = useState<CompanyInfo>(companyInfo);
    const [tempSettings, setTempSettings] = useState<AppSettings>(settings);
    
    const [localSetupUser, setLocalSetupUser] = useState(() => localStorage.getItem('local_setup_username') || DEFAULT_SETUP_USERNAME);
    const [localSetupCode, setLocalSetupCode] = useState(() => localStorage.getItem('local_setup_code') || DEFAULT_SETUP_CODE);

    const [newZone, setNewZone] = useState<Partial<ShippingZone>>({ name: '', rates: { fast: 0, normal: 0 } });

    const [isProcessingData, setIsProcessingData] = useState(false);
    const clientsInputRef = useRef<HTMLInputElement>(null);
    const ordersInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (companyInfo) setTempCompanyInfo(prev => ({ ...companyInfo }));
    }, [companyInfo]);

    useEffect(() => {
        if (settings) setTempSettings(settings);
    }, [settings]);

    const openModal = (type: string, item: any = null) => {
        setModalType(type);
        setEditingItem(item || {}); 
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setModalType(null);
    };

    const confirmDelete = (id: string, type: string) => {
        setItemToDelete({ id, type });
        setIsDeleteModalOpen(true);
    };

    const handleDeleteExecution = async (password: string) => {
        if (!itemToDelete || !supabase) return;
        setIsSaving(true);
        try {
            let table = '';
            let setter: any = null;

            switch (itemToDelete.type) {
                case 'payment_method': table = 'PaymentMethods'; setter = onUpdatePaymentMethods; break;
                case 'currency': table = 'Currencies'; setter = setCurrencies; break;
                case 'store': table = 'Stores'; setter = setStores; break;
                case 'city': table = 'Cities'; setter = setCities; break;
                case 'shipping_company': table = 'ShippingCompanies'; setter = setShippingCompanies; break;
            }

            if (table) {
                const { error } = await supabase.from(table).delete().eq('id', itemToDelete.id);
                if (error) throw error;
                
                if (itemToDelete.type === 'payment_method') onUpdatePaymentMethods(paymentMethods.filter(i => i.id !== itemToDelete.id));
                else setter((prev: any[]) => prev.filter((i: any) => i.id !== itemToDelete.id));
                
                showToast('تم الحذف بنجاح', 'success');
                logAction('Delete', itemToDelete.type as any, itemToDelete.id, 'Deleted item via settings');
            }
        } catch (error: any) {
            showToast(getErrorMessage(error), 'error');
        } finally {
            setIsSaving(false);
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
        }
    };

    const handleGenericSave = async (table: string, data: any, setter: any, isList = true) => {
        if (!supabase) return;
        setIsSaving(true);
        try {
            if (table === 'AppSettings') {
                localStorage.setItem('local_setup_username', localSetupUser);
                localStorage.setItem('local_setup_code', localSetupCode);
            }

            const payload = { ...data };
            
            if (table === 'PaymentMethods') {
                if ('feeRate' in payload) { payload.fee_rate = payload.feeRate; delete payload.feeRate; }
            }
            if (table === 'AppSettings') {
                if ('commissionRate' in payload) { payload.commission_rate = payload.commissionRate; delete payload.commissionRate; }
                if ('minCommissionThreshold' in payload) { payload.min_commission_threshold = payload.minCommissionThreshold; delete payload.minCommissionThreshold; }
                if ('minCommissionValue' in payload) { payload.min_commission_value = payload.minCommissionValue; delete payload.minCommissionValue; }
                if ('shippingRates' in payload) { payload.shipping_rates = payload.shippingRates; delete payload.shippingRates; }
                if ('shippingZones' in payload) { payload.shipping_zones = payload.shippingZones; delete payload.shippingZones; }
                if ('deliveryDays' in payload) { payload.delivery_days = payload.deliveryDays; delete payload.deliveryDays; }
                if ('defaultShippingType' in payload) { payload.default_shipping_type = payload.defaultShippingType; delete payload.defaultShippingType; }
                if ('defaultOriginCenter' in payload) { payload.default_origin_center = payload.defaultOriginCenter; delete payload.defaultOriginCenter; }
                if ('orderIdPrefix' in payload) { payload.order_id_prefix = payload.orderIdPrefix; delete payload.orderIdPrefix; }
                if ('defaultCurrency' in payload) { payload.default_currency = payload.defaultCurrency; delete payload.defaultCurrency; }
                if ('viewOrder' in payload) { payload.view_order = payload.viewOrder; delete payload.viewOrder; }
                if ('whatsappTemplates' in payload) { payload.whatsapp_templates = payload.whatsappTemplates; delete payload.whatsappTemplates; }
                if ('calculatorShortLink' in payload) { payload.calculator_short_link = payload.calculatorShortLink; delete payload.calculatorShortLink; }
                if ('notificationReminderEnabled' in payload) { payload.notification_reminder_enabled = payload.notificationReminderEnabled; delete payload.notificationReminderEnabled; }
                if ('notificationReminderInterval' in payload) { payload.notification_reminder_interval = payload.notificationReminderInterval; delete payload.notificationReminderInterval; }
                if ('mobileDockViews' in payload) { payload.mobile_dock_views = payload.mobileDockViews; delete payload.mobileDockViews; }
                if ('paymentMethods' in payload) delete payload.paymentMethods;
            }
            if (table === 'CompanyInfo') {
                if ('invoiceTerms' in payload) { payload.invoice_terms = payload.invoiceTerms; delete payload.invoiceTerms; }
                if ('invoiceSignature' in payload) { payload.invoice_signature = payload.invoiceSignature; delete payload.invoiceSignature; }
            }
            if (table === 'ShippingCompanies') {
                if ('originCountry' in payload) { payload.origin_country = payload.originCountry; delete payload.originCountry; }
                if ('destinationCountry' in payload) { payload.destination_country = payload.destinationCountry; delete payload.destinationCountry; }
                if ('contactMethods' in payload) { payload.contact_methods = payload.contactMethods; delete payload.contactMethods; }
            }
            if (table === 'Stores') {
                if ('estimatedDeliveryDays' in payload) { payload.estimated_delivery_days = payload.estimatedDeliveryDays; delete payload.estimatedDeliveryDays; }
                if ('defaultOrigin' in payload) { payload.default_origin = payload.defaultOrigin; delete payload.defaultOrigin; }
                if ('defaultShippingCompanyId' in payload) { payload.default_shipping_company_id = payload.defaultShippingCompanyId; delete payload.defaultShippingCompanyId; }
                if ('defaultTransportMode' in payload) { payload.default_transport_mode = payload.defaultTransportMode; delete payload.defaultTransportMode; }
                if ('defaultShippingType' in payload) { payload.default_shipping_type = payload.defaultShippingType; delete payload.defaultShippingType; }
                if ('deliveryDaysFast' in payload) { payload.delivery_days_fast = payload.deliveryDaysFast; delete payload.deliveryDaysFast; }
                if ('deliveryDaysNormal' in payload) { payload.delivery_days_normal = payload.deliveryDaysNormal; delete payload.deliveryDaysNormal; }
            }
            if (table === 'Cities') {
                if ('deliveryCost' in payload) { payload.delivery_cost = payload.deliveryCost; delete payload.deliveryCost; }
                if ('isLocal' in payload) { payload.is_local = payload.isLocal; delete payload.isLocal; }
            }

            let res;
            if (data.id) {
                res = await supabase.from(table).update(payload).eq('id', data.id).select().single();
            } else {
                if (table === 'CompanyInfo' || table === 'AppSettings') {
                    const { data: existing } = await supabase.from(table).select('id').limit(1).maybeSingle();
                    if (existing) {
                        res = await supabase.from(table).update(payload).eq('id', existing.id).select().single();
                    } else {
                        res = await supabase.from(table).insert(payload).select().single();
                    }
                } else {
                    res = await supabase.from(table).insert(payload).select().single();
                }
            }

            if (res.error) throw res.error;

            if (isList) {
                const resultData = res.data;
                if (table === 'PaymentMethods') resultData.feeRate = resultData.fee_rate;
                if (table === 'ShippingCompanies') {
                    resultData.originCountry = resultData.origin_country;
                    resultData.destinationCountry = resultData.destination_country;
                    resultData.contactMethods = resultData.contact_methods;
                }
                if (table === 'Stores') {
                    resultData.estimatedDeliveryDays = resultData.estimated_delivery_days;
                    resultData.defaultOrigin = resultData.default_origin;
                    resultData.defaultShippingCompanyId = resultData.default_shipping_company_id;
                    resultData.defaultTransportMode = resultData.default_transport_mode;
                    resultData.defaultShippingType = resultData.default_shipping_type;
                    resultData.deliveryDaysFast = resultData.delivery_days_fast;
                    resultData.deliveryDaysNormal = resultData.delivery_days_normal;
                }
                if (table === 'Cities') {
                    resultData.deliveryCost = resultData.delivery_cost;
                    resultData.isLocal = resultData.is_local;
                }

                setter((prev: any[]) => {
                    if (data.id) return prev.map(i => i.id === data.id ? resultData : i);
                    return [...prev, resultData];
                });
            } else {
                if (table === 'AppSettings') {
                    setSettings({ ...settings, ...res.data, 
                        commissionRate: res.data.commission_rate,
                        shippingRates: res.data.shipping_rates,
                        orderIdPrefix: res.data.order_id_prefix,
                        defaultCurrency: res.data.default_currency
                    });
                } else if (table === 'CompanyInfo') {
                    setCompanyInfo({ ...companyInfo, ...res.data, invoiceTerms: res.data.invoice_terms });
                } else {
                    setter(res.data);
                }
            }

            showToast('تم الحفظ بنجاح', 'success');
            logAction(data.id ? 'Update' : 'Create', table as any, res.data.id || 'N/A', `Updated/Created ${table} entry`);
            closeModal();
        } catch (error: any) {
            console.error("Save Error:", error);
            showToast(getErrorMessage(error), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearCacheClick = () => {
        if (orders.length > 0) {
            showToast("لا يمكن تنظيف الذاكرة وتحديث البيانات: يوجد طلبات في النظام. يرجى التأكد من عدم وجود أي طلبات قبل إجراء هذه العملية.", "error");
            return;
        }
        setIsClearCacheModalOpen(true);
    };

    const handleExecuteClearCache = async (code: string) => {
        if (code !== localSetupCode) {
            throw new Error("كود المستخدم (رمز الوصول) غير صحيح.");
        }
        localStorage.clear();
        window.location.reload();
    };

    const handleDockViewToggle = (viewId: string) => {
        const currentViews = tempSettings.mobileDockViews || [];
        if (currentViews.includes(viewId)) {
            setTempSettings({ ...tempSettings, mobileDockViews: currentViews.filter(v => v !== viewId) });
        } else {
            setTempSettings({ ...tempSettings, mobileDockViews: [...currentViews, viewId] });
        }
    };

    const handleAddZone = () => {
        if (!newZone.name || !newZone.rates) return;
        const currentZones = tempSettings.shippingZones || [];
        setTempSettings({
            ...tempSettings,
            shippingZones: [...currentZones, { name: newZone.name, rates: { fast: Number(newZone.rates.fast), normal: Number(newZone.rates.normal) } }]
        });
        setNewZone({ name: '', rates: { fast: 0, normal: 0 } });
    };

    const handleRemoveZone = (index: number) => {
        const currentZones = tempSettings.shippingZones || [];
        const updatedZones = [...currentZones];
        updatedZones.splice(index, 1);
        setTempSettings({
            ...tempSettings,
            shippingZones: updatedZones
        });
    };

    const handleMoveView = (index: number, direction: 'up' | 'down') => {
        const currentOrder = tempSettings.viewOrder || AVAILABLE_VIEWS.map(v => v.id);
        const newOrder = [...currentOrder];
        
        if (direction === 'up' && index > 0) {
            [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        
        setTempSettings({ ...tempSettings, viewOrder: newOrder });
    };

    const handleGenerateDemoData = async () => {
        if (!supabase) return;
        setIsProcessingData(true);
        try {
            let { data: currentClients } = await supabase.from('Clients').select('id').limit(5);
            if (!currentClients || currentClients.length < 2) {
                const newClients = Array.from({ length: 5 }).map((_, i) => ({
                    name: `عميل تجريبي ${i + 1}`,
                    phone: `2${Math.floor(Math.random() * 10000000)}`,
                    gender: Math.random() > 0.5 ? 'male' : 'female'
                }));
                const { data } = await supabase.from('Clients').insert(newClients).select();
                if (data) currentClients = data;
            }

            let { data: currentStores } = await supabase.from('Stores').select('id').limit(2);
            if (!currentStores || currentStores.length < 1) {
                const newStores = [
                    { name: 'متجر تجريبي 1', country: 'China', estimated_delivery_days: 15 },
                    { name: 'متجر تجريبي 2', country: 'USA', estimated_delivery_days: 20 }
                ];
                const { data } = await supabase.from('Stores').insert(newStores).select();
                if (data) currentStores = data;
            }

            const { data: currenciesData } = await supabase.from('Currencies').select('*');
            const defaultRate = currenciesData?.find(c => c.code === settings.defaultCurrency)?.rate || 10; 

            if (!currentClients?.length || !currentStores?.length) {
                throw new Error("فشل في إنشاء عملاء أو متاجر للربط");
            }

            const statuses = ['new', 'ordered', 'shipped_from_store', 'arrived_at_office', 'stored', 'completed'];
            const ordersToCreate: any[] = [];
            
            for (let i = 0; i < 30; i++) {
                const status = statuses[i % statuses.length];
                const client = currentClients[Math.floor(Math.random() * currentClients.length)];
                const store = currentStores[Math.floor(Math.random() * currentStores.length)];
                
                const foreignPrice = Math.floor(Math.random() * 500) + 50; 
                const priceInMRU = Math.round(foreignPrice * defaultRate);
                const commission = Math.round(priceInMRU * 0.1); 
                const shippingCost = ['arrived_at_office', 'stored', 'completed'].includes(status) ? 450 : 0; 
                const deliveryCost = 0; 
                
                const totalDue = priceInMRU + commission + shippingCost + deliveryCost;
                
                let amountPaid = 0;
                let globalId = null;
                let tracking = null;
                let weight = null;
                let location = null;
                let arrivalDate = null;
                let storageDate = null;
                let withdrawalDate = null;

                if (status === 'new') {
                    const paymentScenario = i % 3; 
                    if (paymentScenario === 0) amountPaid = 0; 
                    else if (paymentScenario === 1) amountPaid = Math.floor(totalDue / 2); 
                    else amountPaid = totalDue; 
                } 
                else {
                    if (status !== 'new') {
                        globalId = `GLB-${Math.floor(Math.random() * 100000)}`;
                    }
                    
                    if (['shipped_from_store', 'arrived_at_office', 'stored', 'completed'].includes(status)) {
                        tracking = `TRK-${Math.floor(Math.random() * 10000000)}`;
                    }

                    if (['arrived_at_office', 'stored', 'completed'].includes(status)) {
                        weight = (Math.random() * 5 + 0.5).toFixed(1); 
                        arrivalDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(); 
                    }

                    if (['stored', 'completed'].includes(status)) {
                        location = `A${Math.floor(Math.random()*5)+1}-0${Math.floor(Math.random()*9)+1}`;
                        storageDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(); 
                    }

                    if (status === 'completed') {
                        amountPaid = totalDue; 
                        withdrawalDate = new Date().toISOString();
                    }
                }

                ordersToCreate.push({
                    local_order_id: `DEMO-${Math.floor(Math.random() * 100000)}`,
                    client_id: client.id,
                    store_id: store.id,
                    price: foreignPrice,
                    currency: settings.defaultCurrency || 'AED',
                    price_in_mru: priceInMRU,
                    commission: commission,
                    shipping_cost: shippingCost,
                    local_delivery_cost: deliveryCost,
                    amount_paid: amountPaid,
                    quantity: Math.ceil(Math.random() * 3),
                    status: status,
                    order_date: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
                    
                    global_order_id: globalId,
                    tracking_number: tracking,
                    weight: weight ? parseFloat(weight) : null,
                    storage_location: location,
                    arrival_date_at_office: arrivalDate,
                    storage_date: storageDate,
                    withdrawal_date: withdrawalDate,
                    
                    notes: `تم إنشاء هذا الطلب آلياً للتجربة (الحالة: ${status})`
                });
            }

            const { error } = await supabase.from('Orders').insert(ordersToCreate);
            if (error) throw error;

            showToast(`تم إنشاء ${ordersToCreate.length} طلب تجريبي موزع على الحالات بنجاح! سيتم تحديث الصفحة.`, 'success');
            setTimeout(() => window.location.reload(), 1500);

        } catch (e: any) {
            showToast(`فشل التوليد: ${getErrorMessage(e)}`, 'error');
        } finally {
            setIsProcessingData(false);
        }
    };

    const handleExportClients = async () => {
        if (!supabase) return;
        setIsProcessingData(true);
        try {
            const { data: clients, error } = await supabase.from('Clients').select('*').order('name');
            if (error) throw error;

            const exportData = clients.map(c => ({
                'Name': c.name,
                'Phone': c.phone,
                'WhatsApp': c.whatsapp_number,
                'Address': c.address,
                'Gender': c.gender,
                'City': cities.find(city => city.id === c.city_id)?.name || ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Clients");
            XLSX.writeFile(wb, `Clients_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showToast('تم تصدير العملاء بنجاح', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsProcessingData(false);
        }
    };

    const handleExportOrders = async () => {
        if (!supabase) return;
        setIsProcessingData(true);
        try {
            const { data: allOrders, error } = await supabase.from('Orders').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            const { data: allClients } = await supabase.from('Clients').select('id, name, phone');
            
            const exportData = allOrders.map(o => {
                const client = allClients?.find(c => c.id === o.client_id);
                const store = stores.find(s => s.id === o.store_id);
                
                return {
                    'Local ID': o.local_order_id,
                    'Date': o.order_date,
                    'Status': o.status,
                    'Client Name': client?.name || 'Unknown',
                    'Client Phone': client?.phone || '',
                    'Store': store?.name || 'Unknown',
                    'Product Price': o.price,
                    'Currency': o.currency,
                    'Quantity': o.quantity,
                    'Commission': o.commission,
                    'Shipping Cost': o.shipping_cost,
                    'Total Paid': o.amount_paid,
                    'Tracking': o.tracking_number,
                    'Global ID': o.global_order_id,
                    'Notes': o.notes
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Orders");
            XLSX.writeFile(wb, `Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
            showToast('تم تصدير الطلبات بنجاح', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsProcessingData(false);
        }
    };

    const handleImportClients = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !supabase) return;
        setIsProcessingData(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const clientsToInsert = data.map((row: any) => ({
                    name: row['Name'] || row['name'] || row['الاسم'],
                    phone: row['Phone'] || row['phone'] || row['الهاتف'],
                    whatsapp_number: row['WhatsApp'] || row['whatsapp'] || row['واتساب'],
                    address: row['Address'] || row['address'] || row['العنوان'],
                    gender: (row['Gender'] || row['gender'] || 'male').toLowerCase() === 'female' ? 'female' : 'male'
                })).filter((c: any) => c.name && c.phone);

                if (clientsToInsert.length === 0) throw new Error("لا توجد بيانات صالحة");

                const { error } = await supabase.from('Clients').insert(clientsToInsert);
                if (error) throw error;

                showToast(`تم استيراد ${clientsToInsert.length} عميل بنجاح`, 'success');
            } catch (err: any) {
                showToast(getErrorMessage(err), 'error');
            } finally {
                setIsProcessingData(false);
                if (clientsInputRef.current) clientsInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImportOrders = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !supabase) return;
        setIsProcessingData(true);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const { data: dbClients } = await supabase.from('Clients').select('id, name');
                const { data: dbStores } = await supabase.from('Stores').select('id, name');

                const ordersToInsert: any[] = [];
                
                for (const row of (data as any[])) {
                    const clientName = row['Client Name'] || row['client_name'] || row['العميل'];
                    const storeName = row['Store'] || row['store'] || row['المتجر'];
                    
                    let clientId = dbClients?.find(c => c.name === clientName)?.id;
                    let storeId = dbStores?.find(s => s.name === storeName)?.id;

                    if (!clientId || !storeId) continue;

                    ordersToInsert.push({
                        local_order_id: row['Local ID'] || row['local_id'] || `IMP-${Math.floor(Math.random()*10000)}`,
                        client_id: clientId,
                        store_id: storeId,
                        price: row['Product Price'] || row['price'] || 0,
                        quantity: row['Quantity'] || row['quantity'] || 1,
                        commission: row['Commission'] || 0,
                        shipping_cost: row['Shipping Cost'] || 0,
                        amount_paid: row['Total Paid'] || 0,
                        currency: row['Currency'] || 'AED',
                        notes: row['Notes'],
                        order_date: new Date().toISOString()
                    });
                }

                if (ordersToInsert.length === 0) throw new Error("لم يتم العثور على بيانات صالحة أو فشل ربط العملاء/المتاجر");

                const { error } = await supabase.from('Orders').insert(ordersToInsert);
                if (error) throw error;

                showToast(`تم استيراد ${ordersToInsert.length} طلب بنجاح`, 'success');
            } catch (err: any) {
                showToast(getErrorMessage(err), 'error');
            } finally {
                setIsProcessingData(false);
                if (ordersInputRef.current) ordersInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const renderDataManagementTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 mb-4">
                <h4 className="font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                    <Database size={20}/> مركز البيانات
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                    يمكنك هنا تصدير جميع بياناتك كنسخ احتياطية (Excel)، أو استيراد بيانات جديدة. 
                    <br/><b>ملاحظة للاستيراد:</b> يجب أن تتطابق أعمدة ملف Excel مع الصيغة المطلوبة (الاسم، الهاتف للعملاء / واسم العميل، المتجر للطلبات).
                </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 flex justify-between items-center mb-6">
                <div>
                    <h4 className="font-bold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                        <Sparkles size={20}/> بيانات تجريبية (Demo)
                    </h4>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                        اضغط لإنشاء طلبات وعملاء وهميين لتجربة التطبيق (موزعة على جميع الحالات بشكل منظم).
                    </p>
                </div>
                <button 
                    onClick={handleGenerateDemoData} 
                    disabled={isProcessingData}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                    {isProcessingData ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                    توليد بيانات
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border dark:border-gray-700 shadow-sm flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 mb-4">
                        <Users size={32}/>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">بيانات العملاء</h3>
                    <p className="text-xs text-gray-500 mb-6">تصدير قائمة العملاء أو إضافة عملاء جدد</p>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={handleExportClients}
                            disabled={isProcessingData}
                            className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isProcessingData ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
                            تصدير
                        </button>
                        <label className={`flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${isProcessingData ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Upload size={16}/>
                            استيراد
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".xlsx, .xls, .csv" 
                                ref={clientsInputRef}
                                onChange={handleImportClients}
                                disabled={isProcessingData}
                            />
                        </label>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border dark:border-gray-700 shadow-sm flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                        <FileText size={32}/>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">سجل الطلبات</h3>
                    <p className="text-xs text-gray-500 mb-6">تصدير جميع الطلبات أو استيراد أرشيف</p>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={handleExportOrders}
                            disabled={isProcessingData}
                            className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isProcessingData ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
                            تصدير
                        </button>
                        <label className={`flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${isProcessingData ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Upload size={16}/>
                            استيراد
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".xlsx, .xls, .csv" 
                                ref={ordersInputRef}
                                onChange={handleImportOrders}
                                disabled={isProcessingData}
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCompanyTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">شعار الشركة</label>
                    <div className="flex items-center gap-4">
                        <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800 dark:border-gray-600 relative group">
                            {tempCompanyInfo.logo ? (
                                <img src={tempCompanyInfo.logo} className="w-full h-full object-contain" alt="Logo" />
                            ) : (
                                <Building className="text-gray-400" size={32}/>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <span className="text-white text-xs font-bold">تغيير</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="cursor-pointer bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2 text-sm font-bold shadow-md">
                                <Upload size={16}/> رفع شعار (PNG شفاف)
                                <input type="file" className="hidden" accept="image/png, image/webp, image/jpeg" onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                        const base64 = await compressImage(e.target.files[0]);
                                        setTempCompanyInfo({...tempCompanyInfo, logo: base64});
                                    }
                                }} />
                            </label>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">يفضل استخدام صورة بصيغة PNG وخلفية شفافة لنتائج أفضل.</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">اسم الشركة</label>
                        <input type="text" value={tempCompanyInfo.name} onChange={e => setTempCompanyInfo({...tempCompanyInfo, name: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">الهاتف</label>
                        <input type="text" value={tempCompanyInfo.phone} onChange={e => setTempCompanyInfo({...tempCompanyInfo, phone: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">البريد الإلكتروني</label>
                        <input type="email" value={tempCompanyInfo.email} onChange={e => setTempCompanyInfo({...tempCompanyInfo, email: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">الموقع الإلكتروني</label>
                        <input type="text" value={tempCompanyInfo.website || ''} onChange={e => setTempCompanyInfo({...tempCompanyInfo, website: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 placeholder:text-gray-400" placeholder="www.example.com" />
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1">العنوان</label>
                    <input type="text" value={tempCompanyInfo.address} onChange={e => setTempCompanyInfo({...tempCompanyInfo, address: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold mb-1">شروط الفاتورة (تذييل)</label>
                    <textarea rows={3} value={tempCompanyInfo.invoiceTerms || ''} onChange={e => setTempCompanyInfo({...tempCompanyInfo, invoiceTerms: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
            </div>
            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                <button onClick={() => handleGenericSave('CompanyInfo', tempCompanyInfo, setCompanyInfo, false)} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} حفظ التغييرات
                </button>
            </div>
        </div>
    );

    const renderSystemTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl flex justify-between items-center">
                <div>
                    <h4 className="font-bold text-orange-800 dark:text-orange-200 flex items-center gap-2">
                        <Database size={18}/> صيانة البيانات المحلية
                    </h4>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                        استخدم هذا الزر لإصلاح المشاكل ومسح التخزين المحلي. (يتطلب كود المستخدم وعدم وجود طلبات نشطة)
                    </p>
                </div>
                <button 
                    onClick={handleClearCacheClick}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <RefreshCw size={14}/> تنظيف الذاكرة وتحديث
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-bold mb-1">العملة الافتراضية</label>
                    <select value={tempSettings.defaultCurrency} onChange={e => setTempSettings({...tempSettings, defaultCurrency: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                        {currencies.map(c => <option key={c.id} value={c.code}>{c.name} ({c.code})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">نسبة العمولة الافتراضية (%)</label>
                    <input type="number" value={tempSettings.commissionRate} onChange={e => setTempSettings({...tempSettings, commissionRate: Number(e.target.value)})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">بادئة معرف الطلب (مثال: FCD)</label>
                    <input type="text" value={tempSettings.orderIdPrefix} onChange={e => setTempSettings({...tempSettings, orderIdPrefix: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">رابط حاسبة العملاء المختصر</label>
                    <input type="text" value={tempSettings.calculatorShortLink || ''} onChange={e => setTempSettings({...tempSettings, calculatorShortLink: e.target.value})} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="https://..." />
                </div>
                
                <div className="md:col-span-2 p-4 border border-red-200 dark:border-red-800 rounded-xl bg-red-50 dark:bg-red-900/10">
                    <h4 className="font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                        <Lock size={16}/> بيانات الدخول لإعداد قاعدة البيانات (محفوظ محلياً فقط)
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-400 mb-3">
                        هذه البيانات يتم تخزينها في متمتصفحك الحالي فقط لتمكينك من الوصول لإعداد قاعدة البيانات عند انقطاع الاتصال.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-red-800 dark:text-red-300">اسم مستخدم الإعداد (الافتراضي: admin_setup)</label>
                            <input 
                                type="text" 
                                value={localSetupUser} 
                                onChange={e => setLocalSetupUser(e.target.value)} 
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-red-800 dark:text-red-300">كود المستخدم / رمز الوصول</label>
                            <input 
                                type="text" 
                                value={localSetupCode} 
                                onChange={e => setLocalSetupCode(e.target.value)} 
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm font-mono font-bold"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                <h4 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                    <Menu size={18}/> ترتيب القائمة الجانبية (Sidebar)
                </h4>
                <p className="text-xs text-gray-500 mb-4">أعد ترتيب الصفحات لتظهر بالشكل الذي يناسبك في القائمة الجانبية.</p>
                
                <div className="space-y-2">
                    {(tempSettings.viewOrder || AVAILABLE_VIEWS.map(v => v.id)).map((viewId, index) => {
                        const viewLabel = AVAILABLE_VIEWS.find(v => v.id === viewId)?.label || viewId;
                        return (
                            <div key={viewId} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-lg border dark:border-gray-600">
                                <span className="font-bold text-sm px-2">{viewLabel}</span>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => handleMoveView(index, 'up')} 
                                        disabled={index === 0}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                                    >
                                        <ArrowUp size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => handleMoveView(index, 'down')} 
                                        disabled={index === (tempSettings.viewOrder || AVAILABLE_VIEWS).length - 1}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                                    >
                                        <ArrowDown size={16}/>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl">
                <h4 className="font-bold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                    <SmartphoneIcon size={18}/> تخصيص الشريط السفلي (للهاتف)
                </h4>
                <p className="text-xs text-gray-500 mb-3">اختر الصفحات التي تظهر مباشرة في الشريط السفلي. الصفحات غير المختارة ستظهر في قائمة "المزيد".</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {AVAILABLE_VIEWS.map(view => (
                        <label key={view.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-700 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={tempSettings.mobileDockViews?.includes(view.id)} 
                                onChange={() => handleDockViewToggle(view.id)}
                                className="accent-purple-600"
                            />
                            <span className="text-sm font-bold">{view.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                    <Globe size={18}/> إعدادات مناطق الشحن (Zones)
                </h4>
                
                <div className="space-y-2 mb-4">
                    {(tempSettings.shippingZones || []).map((zone, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-sm w-24">{zone.name}</span>
                                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">سريع: {zone.rates.fast}</span>
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">عادي: {zone.rates.normal}</span>
                            </div>
                            <button onClick={() => handleRemoveZone(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    {(tempSettings.shippingZones || []).length === 0 && (
                        <p className="text-xs text-gray-500 text-center py-2">لا توجد مناطق مضافة.</p>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 items-end border-t dark:border-blue-800/50 pt-3">
                    <div className="flex-grow">
                        <label className="block text-[10px] font-bold mb-1">اسم المنطقة (مثل: China)</label>
                        <input type="text" value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600" placeholder="اسم المنطقة"/>
                    </div>
                    <div className="w-24">
                        <label className="block text-[10px] font-bold mb-1">سعر سريع</label>
                        <input type="number" value={newZone.rates?.fast} onChange={e => setNewZone({...newZone, rates: { ...newZone.rates!, fast: Number(e.target.value) }})} className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"/>
                    </div>
                    <div className="w-24">
                        <label className="block text-[10px] font-bold mb-1">سعر عادي</label>
                        <input type="number" value={newZone.rates?.normal} onChange={e => setNewZone({...newZone, rates: { ...newZone.rates!, normal: Number(e.target.value) }})} className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"/>
                    </div>
                    <button onClick={handleAddZone} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 h-[38px] w-[38px] flex items-center justify-center">
                        <Plus size={20}/>
                    </button>
                </div>
            </div>
            
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2"><Smartphone size={18}/> قوالب رسائل واتساب</h4>
                <div className="space-y-3">
                    {['ar', 'en', 'fr'].map(lang => (
                        <div key={lang}>
                            <label className="block text-xs font-bold uppercase mb-1">{lang}</label>
                            <textarea 
                                rows={2} 
                                value={(tempSettings.whatsappTemplates as any)?.[lang] || ''}
                                onChange={e => setTempSettings({
                                    ...tempSettings, 
                                    whatsappTemplates: { ...tempSettings.whatsappTemplates, [lang]: e.target.value }
                                })}
                                className="w-full p-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                <button onClick={() => handleGenericSave('AppSettings', tempSettings, setSettings, false)} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} حفظ الإعدادات
                </button>
            </div>
        </div>
    );

    const renderPaymentMethodsTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">وسائل الدفع والرسوم</h3>
                <button onClick={() => openModal('payment_method')} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors shadow-md">
                    <Plus size={18}/> إضافة وسيلة
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentMethods.map(method => (
                    <div key={method.id} className="relative bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all group overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center overflow-hidden border dark:border-gray-600">
                                    {method.logo ? <img src={method.logo} className="w-full h-full object-contain" alt="logo"/> : <CreditCard className="text-gray-400" size={24}/>}
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-gray-900 dark:text-white">{method.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${method.feeRate > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                                            {method.feeRate > 0 ? `${method.feeRate}% رسوم` : 'بدون رسوم'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openModal('payment_method', method)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                <button onClick={() => confirmDelete(method.id, 'payment_method')} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        {(method.number || method.note) && (
                            <div className="mt-4 pt-3 border-t dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 space-y-1">
                                {method.number && <p className="flex items-center gap-2 font-mono"><Hash size={14}/> {method.number}</p>}
                                {method.note && <p className="flex items-center gap-2 text-xs"><FileText size={14}/> {method.note}</p>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderCurrenciesTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">العملات وأسعار الصرف</h3>
                <button onClick={() => openModal('currency')} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors">
                    <Plus size={18}/> إضافة عملة
                </button>
            </div>
            <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
                <table className="w-full text-right bg-white dark:bg-gray-800">
                    <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-bold text-sm">
                        <tr>
                            <th className="p-4 whitespace-nowrap">اسم العملة</th>
                            <th className="p-4 whitespace-nowrap">الرمز</th>
                            <th className="p-4 whitespace-nowrap">سعر الصرف (مقابل MRU)</th>
                            <th className="p-4 text-center whitespace-nowrap">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {currencies.map(curr => (
                            <tr key={curr.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 font-bold">{curr.name}</td>
                                <td className="p-4 font-mono">{curr.code}</td>
                                <td className="p-4 font-mono text-green-600 font-bold">1 {curr.code} = {curr.rate} MRU</td>
                                <td className="p-4 flex justify-center gap-2">
                                    <button onClick={() => openModal('currency', curr)} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100"><Edit2 size={16}/></button>
                                    <button onClick={() => confirmDelete(curr.id, 'currency')} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderStoresTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">إدارة المتاجر</h3>
                <button onClick={() => openModal('store')} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors">
                    <Plus size={18}/> متجر جديد
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stores.map(store => (
                    <div key={store.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm relative group hover:shadow-lg transition-all">
                        <div className="absolute top-2 left-2 flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm border dark:border-gray-600">
                            <button onClick={() => openModal('store', store)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14}/></button>
                            <button onClick={() => confirmDelete(store.id, 'store')} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                        </div>
                        <div className="flex flex-col items-center text-center gap-3 mt-2">
                            <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden border dark:border-gray-600 shadow-inner shrink-0">
                                {store.logo ? <img src={store.logo} className="w-full h-full object-contain" alt="logo"/> : <ShoppingBag className="text-gray-300" size={32}/>}
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">{store.name}</h4>
                                <p className="text-xs text-gray-500">توصيل: {store.estimatedDeliveryDays} يوم</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderCitiesTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">المدن ومناطق التوصيل</h3>
                <button onClick={() => openModal('city')} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors">
                    <Plus size={18}/> مدينة جديدة
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cities.map(city => (
                    <div key={city.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm flex justify-between items-center group">
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold">{city.name}</h4>
                                {city.isLocal && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-bold">محلي</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">تكلفة التوصيل: <span className="font-bold text-gray-700 dark:text-gray-300">{city.deliveryCost} MRU</span></p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openModal('city', city)} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100"><Edit2 size={16}/></button>
                            <button onClick={() => confirmDelete(city.id, 'city')} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded hover:bg-blue-100"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderShippingCompaniesTab = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">شركات الشحن والخدمات اللوجستية</h3>
                <button onClick={() => openModal('shipping_company')} className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-dark transition-colors">
                    <Plus size={18}/> شركة جديدة
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shippingCompanies.map(company => (
                    <div key={company.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl border dark:border-gray-700 shadow-sm flex flex-col gap-3 group relative hover:shadow-md transition-all">
                        <div className="absolute top-3 left-3 flex gap-2">
                            <button onClick={() => openModal('shipping_company', company)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Edit2 size={16}/></button>
                            <button onClick={() => confirmDelete(company.id, 'shipping_company')} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={16}/></button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                                <Truck className="text-gray-500"/>
                            </div>
                            <div>
                                <h4 className="font-bold text-lg">{company.name}</h4>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Globe size={12}/>
                                    <span>{company.originCountry}</span>
                                    <span className="mx-1">→</span>
                                    <span>{company.destinationCountry}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-1">
                            {(company.rates as any)?.air && (
                                <span className="flex items-center gap-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-2 py-1 rounded font-bold">
                                    <Plane size={12}/> جوي
                                </span>
                            )}
                            {(company.rates as any)?.sea && (
                                <span className="flex items-center gap-1 bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300 text-[10px] px-2 py-1 rounded font-bold">
                                    <Ship size={12}/> بحري
                                </span>
                            )}
                        </div>

                        <div className="mt-2 space-y-1.5 pt-2 border-t dark:border-gray-700/50">
                            <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <MapPin size={14} className="mt-0.5 flex-shrink-0"/>
                                <span className="line-clamp-2">{company.addresses?.origin || 'لا يوجد عنوان محدد'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Phone size={14} className="flex-shrink-0"/>
                                <span dir="ltr">{company.contactMethods?.[0]?.value || '---'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderModalContent = () => {
        if (!modalType || !editingItem) return null;

        const inputClass = "w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all";
        const labelClass = "block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5";
        
        if (modalType === 'payment_method') {
            return (
                <div className="space-y-5">
                    <h3 className="text-xl font-black border-b pb-3 dark:border-gray-700 flex items-center gap-2">
                        <Wallet className="text-primary"/> {editingItem.id ? 'تعديل وسيلة دفع' : 'إضافة وسيلة دفع جديدة'}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>اسم الوسيلة (مثال: بنكيلي, كاش, تحويل)</label>
                            <input type="text" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className={inputClass} placeholder="أدخل الاسم..." />
                        </div>
                        
                        <div>
                            <label className={labelClass}>نسبة الرسوم (%)</label>
                            <div className="relative">
                                <input type="number" value={editingItem.feeRate || ''} onChange={e => setEditingItem({...editingItem, feeRate: parseFloat(e.target.value)})} className={inputClass} placeholder="0" step="0.1"/>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>رقم الحساب / المعرف</label>
                            <input type="text" value={editingItem.number || ''} onChange={e => setEditingItem({...editingItem, number: e.target.value})} className={inputClass} placeholder="رقم الحساب البنكي / الهاتف" />
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClass}>ملاحظات إضافية (تظهر للعميل)</label>
                            <textarea rows={2} value={editingItem.note || ''} onChange={e => setEditingItem({...editingItem, note: e.target.value})} className={inputClass} placeholder="مثال: يرجى إرسال الإشعار بعد التحويل..." />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>الشعار / الأيقونة</label>
                        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50 dark:bg-gray-800 p-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-primary transition-all group">
                            {editingItem.logo ? (
                                <img src={editingItem.logo} className="h-16 w-auto object-contain drop-shadow-md" alt="logo"/>
                            ) : (
                                <div className="p-4 bg-white dark:bg-gray-700 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Upload size={24} className="text-gray-400 group-hover:text-primary"/>
                                </div>
                            )}
                            <span className="text-xs font-bold text-gray-500 group-hover:text-primary">اضغط لرفع صورة شعار</span>
                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                if(e.target.files?.[0]) {
                                    const b64 = await compressImage(e.target.files[0]);
                                    setEditingItem({...editingItem, logo: b64});
                                }
                            }}/>
                        </label>
                    </div>

                    <div className="pt-4 border-t dark:border-gray-700 flex justify-end gap-3">
                        <button onClick={closeModal} className="px-6 py-2.5 rounded-xl text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">إلغاء</button>
                        <button onClick={() => handleGenericSave('PaymentMethods', editingItem, onUpdatePaymentMethods)} className="px-8 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center gap-2">
                            {isSaving ? <Loader2 className="animate-spin"/> : <Save size={20}/>}
                            حفظ الوسيلة
                        </button>
                    </div>
                </div>
            );
        }

        if (modalType === 'currency') {
            return (
                <div className="space-y-5">
                    <h3 className="text-xl font-black border-b pb-3 dark:border-gray-700 flex items-center gap-2">
                        <DollarSign className="text-green-500"/> {editingItem.id ? 'تعديل عملة' : 'إضافة عملة جديدة'}
                    </h3>
                    <div>
                        <label className={labelClass}>اسم العملة</label>
                        <input value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className={inputClass} placeholder="درهم إماراتي" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>الرمز</label>
                            <input value={editingItem.code || ''} onChange={e => setEditingItem({...editingItem, code: e.target.value.toUpperCase()})} className={inputClass} placeholder="AED" />
                        </div>
                        <div>
                            <label className={labelClass}>سعر الصرف (مقابل MRU)</label>
                            <input type="number" value={editingItem.rate || ''} onChange={e => setEditingItem({...editingItem, rate: parseFloat(e.target.value)})} className={inputClass} placeholder="11.5" />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button onClick={closeModal} className="px-6 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100">إلغاء</button>
                        <button onClick={() => handleGenericSave('Currencies', editingItem, setCurrencies)} className="px-8 py-2 rounded-xl bg-primary text-white font-bold">حفظ</button>
                    </div>
                </div>
            );
        }

        if (modalType === 'store') {
            return (
                <div className="space-y-5">
                    <h3 className="text-xl font-black border-b pb-3 dark:border-gray-700 flex items-center gap-2">
                        <ShoppingBag className="text-blue-500"/> {editingItem.id ? 'تعديل متجر' : 'إضافة متجر جديد'}
                    </h3>
                    <div>
                        <label className={labelClass}>اسم المتجر</label>
                        <input value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>الدولة</label>
                        <input value={editingItem.country || ''} onChange={e => setEditingItem({...editingItem, country: e.target.value})} className={inputClass} />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button onClick={closeModal} className="px-6 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100">إلغاء</button>
                        <button onClick={() => handleGenericSave('Stores', editingItem, setStores)} className="px-8 py-2 rounded-xl bg-primary text-white font-bold">حفظ</button>
                    </div>
                </div>
            );
        }

        if (modalType === 'city') {
            return (
                <div className="space-y-5">
                    <h3 className="text-xl font-black border-b pb-3 dark:border-gray-700">المدينة / المنطقة</h3>
                    <div>
                        <label className={labelClass}>الاسم</label>
                        <input value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>تكلفة التوصيل (MRU)</label>
                        <input type="number" value={editingItem.deliveryCost || ''} onChange={e => setEditingItem({...editingItem, deliveryCost: parseFloat(e.target.value)})} className={inputClass} />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editingItem.isLocal || false} onChange={e => setEditingItem({...editingItem, isLocal: e.target.checked})} />
                        <span>محلي (داخل العاصمة)</span>
                    </label>
                    <div className="pt-4 flex justify-end gap-3">
                        <button onClick={closeModal} className="px-6 py-2 rounded-xl bg-gray-200 dark:bg-gray-700">إلغاء</button>
                        <button onClick={() => handleGenericSave('Cities', editingItem, setCities)} className="px-6 py-2 rounded-xl bg-primary text-white">حفظ</button>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
            <PasswordConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {setIsDeleteModalOpen(false); setItemToDelete(null);}}
                onConfirm={handleDeleteExecution}
                title="تأكيد الحذف"
                message="هل أنت متأكد من الحذف؟ هذا الإجراء لا يمكن التراجع عنه."
            />

            <PasswordConfirmationModal
                isOpen={isClearCacheModalOpen}
                onClose={() => setIsClearCacheModalOpen(false)}
                onConfirm={handleExecuteClearCache}
                title="تأكيد صيانة البيانات"
                message="سيؤدي هذا الإجراء إلى حذف البيانات المحلية المؤقتة وإعادة تحميل التطبيق. هل أنت متأكد؟"
                confirmButtonText="تنظيف وتحديث"
                confirmButtonColor="bg-orange-600"
                verificationMode="offline_code"
            />

            <div className="w-full md:w-64 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex-shrink-0 flex flex-col md:h-full">
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="font-black text-lg text-gray-800 dark:text-white flex items-center gap-2">
                        <Settings className="text-primary"/> إعدادات النظام
                    </h2>
                </div>
                <div className="flex-1 overflow-x-auto md:overflow-y-auto custom-scrollbar p-2 flex md:flex-col gap-1">
                    {SETTINGS_NAV.map(item => (
                        <button
                            key={item.id}
                            onClick={() => { playSound('click'); setActiveTab(item.id); }}
                            className={`flex-shrink-0 flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                activeTab === item.id 
                                ? 'bg-primary text-white shadow-md' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={18}/> {item.label}
                            </div>
                            <HelpIcon content={HELP_CONTENT[item.helpKey]} />
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 md:p-6 overflow-y-auto custom-scrollbar relative">
                {activeTab === 'company' && renderCompanyTab()}
                {activeTab === 'system' && renderSystemTab()}
                {activeTab === 'data_management' && renderDataManagementTab()}
                {activeTab === 'payment_methods' && renderPaymentMethodsTab()}
                {activeTab === 'currencies' && renderCurrenciesTab()}
                {activeTab === 'stores' && renderStoresTab()}
                {activeTab === 'cities' && renderCitiesTab()}
                {activeTab === 'shipping' && renderShippingCompaniesTab()}
                {activeTab === 'users' && <UsersPage users={users} setUsers={setUsers} logAction={logAction} globalActivityLog={globalActivityLog} />}
                {activeTab === 'audit' && <AuditLogPage log={globalActivityLog} />}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={closeModal}>
                    <div 
                        className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-6 pb-2 shrink-0">
                            <div className="w-10"></div> {/* Spacer */}
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <X className="text-gray-400 hover:text-gray-600" size={24}/>
                            </button>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-6 pt-0">
                            {renderModalContent()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;

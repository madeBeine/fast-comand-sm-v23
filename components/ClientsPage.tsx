
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import type { Client, Order, City } from '../types';
import { supabase, getErrorMessage } from '../supabaseClient';
import { User, Phone, Search, PlusCircle, Edit, Trash2, X, Save, Eye, MapPin, ShoppingCart, DollarSign, ListOrdered, BarChart3, TrendingUp, Users, BadgePercent, Loader2, ShieldCheck, ChevronDown, MessageCircle, ExternalLink, UserCheck, Trophy, AlertOctagon, Wallet, Download, ArrowDown } from 'lucide-react';
import { STATUS_DETAILS } from '../constants';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { OrderStatus } from '../types';
import * as XLSX from 'xlsx';

interface ClientsPageProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    orders: Order[];
    cities?: City[];
    // Pagination Props
    loadMoreClients: () => void;
    searchClients: (term: string) => void;
    hasMoreClients: boolean;
    isClientsLoading: boolean;
    totalClientsCount: number;
}

const ClientStatCard: React.FC<{ title: string, value: string | number, icon: any, color: string, subValue?: string }> = ({ title, value, icon: Icon, color, subValue }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-all hover:shadow-md h-full">
        <div>
            <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase mb-1">{title}</p>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tight">{value}</h3>
            {subValue && <p className="text-[10px] text-gray-400 mt-1 font-bold">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color} text-white shadow-lg bg-opacity-90`}>
            <Icon size={24} />
        </div>
    </div>
);

const TopClientsWidget: React.FC<{ topClients: { client: Client, total: number, orders: number }[] }> = ({ topClients }) => (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-lg p-4 overflow-hidden relative border border-slate-700">
        <div className="flex items-center gap-2 mb-3 border-b border-slate-700 pb-2">
            <Trophy className="text-yellow-400" size={18}/>
            <h3 className="font-bold text-sm">أفضل 5 عملاء (إنفاقاً)</h3>
        </div>
        <div className="space-y-3">
            {topClients.length > 0 ? topClients.map((item, idx) => (
                <div key={item.client.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full font-bold text-[10px] ${idx === 0 ? 'bg-yellow-400 text-black' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-orange-400 text-black' : 'bg-slate-700 text-gray-300'}`}>
                            {idx + 1}
                        </span>
                        <span className="font-medium truncate max-w-[100px]">{item.client.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400">{item.orders} طلب</span>
                        <span className="font-mono font-bold text-green-400">{item.total.toLocaleString()}</span>
                    </div>
                </div>
            )) : <p className="text-xs text-gray-500 text-center py-4">لا توجد بيانات كافية</p>}
        </div>
    </div>
);

const PasswordModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => Promise<void>;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    const { t } = useLanguage();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await onConfirm(password);
            onClose();
            setPassword('');
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70]" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('password')}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white mb-2"
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg">{t('cancel')}</button>
                        <button type="submit" disabled={!password || loading} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                            {loading ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}
                            {t('confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ClientFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Partial<Client>) => void;
    client: Client | null;
    isSaving: boolean;
    cities?: City[];
}> = ({ isOpen, onClose, onSave, client, isSaving, cities = [] }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState<Partial<Client>>({});
    const [showWhatsappInput, setShowWhatsappInput] = useState(false);

    useEffect(() => {
        const initialData = client || { name: '', phone: '', whatsappNumber: '', address: '', gender: 'male', cityId: '' };
        setFormData(initialData);
        setShowWhatsappInput(!!(client && client.whatsappNumber && client.whatsappNumber !== client.phone));
    }, [client, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (formData.name && formData.phone && formData.gender) {
            onSave(formData);
        } else {
            alert(t('required'));
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const clearWhatsapp = () => {
        setFormData(prev => ({ ...prev, whatsappNumber: '' }));
        setShowWhatsappInput(false);
    }

    const inputClass = "w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{client ? t('edit') : t('addClient')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('clientName')}*</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className={inputClass} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{t('phone')}*</label>
                        <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">المدينة (تحديد تكلفة التوصيل)</label>
                        <select name="cityId" value={formData.cityId || ''} onChange={handleInputChange} className={inputClass}>
                            <option value="">اختر المدينة...</option>
                            {cities.map(city => (
                                <option key={city.id} value={city.id}>{city.name} {city.isLocal ? '' : '(وكالة)'}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('gender')}*</label>
                        <select name="gender" value={formData.gender || 'male'} onChange={handleInputChange} className={inputClass}>
                            <option value="male">{t('male')}</option>
                            <option value="female">{t('female')}</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{t('whatsapp')}</label>
                        {!showWhatsappInput ? (
                            <button onClick={() => setShowWhatsappInput(true)} className="w-full text-sm p-2 border-2 border-dashed rounded border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-secondary transition-colors text-gray-500 hover:text-primary">
                                + إضافة رقم واتساب مختلف
                            </button>
                        ) : (
                             <div className="relative">
                                <input type="tel" name="whatsappNumber" value={formData.whatsappNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="رقم الواتساب المختلف" autoFocus/>
                                <button onClick={clearWhatsapp} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500" title="إلغاء واستخدام رقم الهاتف">
                                    <X size={16}/>
                                </button>
                            </div>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">يُستخدم هذا الرقم لإرسال إشعارات الوصول.</p>
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">{t('address')}</label>
                        <textarea name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} className={inputClass}></textarea>
                    </div>
                </div>
                <div className="p-6 pt-4 flex justify-end flex-shrink-0 border-t dark:border-gray-700">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary dark:hover:bg-secondary-dark disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ClientsPage: React.FC<ClientsPageProps> = ({ 
    clients, setClients, orders, cities = [], 
    loadMoreClients, searchClients, hasMoreClients, isClientsLoading, totalClientsCount 
}) => {
    const { currentUser } = useContext(AuthContext);
    const { t } = useLanguage();
    const { showToast } = useToast();
    
    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    // --- Server-Side Search Handler ---
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            searchClients(val);
        }, 500); 
    };

    // --- Export Functionality ---
    const handleExportClients = () => {
        const exportData = clients.map(c => ({
            'الاسم': c.name,
            'الهاتف': c.phone,
            'الواتساب': c.whatsappNumber || '',
            'العنوان': c.address || '',
            'الجنس': c.gender === 'female' ? 'أنثى' : 'ذكر',
            'المدينة': cities?.find(city => city.id === c.cityId)?.name || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "العملاء");
        XLSX.writeFile(wb, `Clients_List_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('تم تصدير قائمة العملاء', 'success');
    };

    // --- Statistics Calculation ---
    const { stats, topClients } = useMemo(() => {
        let totalDebt = 0;
        let activeClientsSet = new Set<string>();
        const clientSpend: Record<string, { total: number, orders: number }> = {};

        // Calculate debts/stats based on currently loaded orders (approximation)
        // For infinite scale, this should ideally move to server-side aggregation,
        // but for now, we calculate based on fetched orders.
        orders.forEach(o => {
            if(o.status === OrderStatus.CANCELLED || o.status === OrderStatus.NEW) return;
            
            const total = Math.round(Number(o.priceInMRU || 0) + Number(o.commission || 0) + Number(o.shippingCost || 0) + Number(o.localDeliveryCost || 0));
            const paid = Math.round(Number(o.amountPaid || 0));
            const debt = Math.max(0, total - paid);
            
            totalDebt += debt;
            activeClientsSet.add(o.clientId);
            
            if (!clientSpend[o.clientId]) clientSpend[o.clientId] = { total: 0, orders: 0 };
            clientSpend[o.clientId].total += total;
            clientSpend[o.clientId].orders += 1;
        });

        // Top 5 Calculation (Hybrid approach: use local orders to find top spenders)
        const sortedClients = Object.entries(clientSpend)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 5)
            .map(([id, data]) => {
                const c = clients.find(client => client.id === id);
                // If client not in current page list, we skip showing details or show placeholder
                return c ? { client: c, total: data.total, orders: data.orders } : null;
            })
            .filter(Boolean) as { client: Client, total: number, orders: number }[];

        return {
            stats: {
                total: totalClientsCount || clients.length, // Use server total if available
                active: activeClientsSet.size,
                debt: totalDebt
            },
            topClients: sortedClients
        };
    }, [clients, orders, totalClientsCount]);

    // Render list (Search filters are handled server-side now, so we just render `clients`)
    const displayClients = clients;

    const handleSaveClient = async (clientData: Partial<Client>) => {
        if (!supabase) return;
        
        if (clientData.id) {
            if(!currentUser?.permissions.clients.edit) {
                showToast("ليس لديك صلاحية تعديل العملاء", "error");
                return;
            }
        } else {
            if(!currentUser?.permissions.clients.create) {
                showToast("ليس لديك صلاحية إنشاء عملاء", "error");
                return;
            }
        }

        setIsSaving(true);
        try {
            const payload = {
                name: clientData.name,
                phone: clientData.phone,
                whatsapp_number: clientData.whatsappNumber,
                address: clientData.address,
                gender: clientData.gender,
                city_id: clientData.cityId || null
            };

            let res;
            if (clientData.id) {
                res = await (supabase.from('Clients') as any).update(payload).eq('id', clientData.id).select().single();
            } else {
                res = await (supabase.from('Clients') as any).insert(payload).select().single();
            }

            if (res.error) throw res.error;

            const savedClient = {
                ...res.data,
                whatsappNumber: res.data.whatsapp_number,
                cityId: res.data.city_id
            };

            if (clientData.id) {
                setClients(prev => prev.map(c => c.id === savedClient.id ? savedClient : c));
            } else {
                setClients(prev => [savedClient, ...prev]);
            }
            showToast(t('success'), 'success');
            setIsModalOpen(false);
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClient = async (password: string) => {
        if (!supabase || !clientToDelete || !currentUser?.email) return;
        
        if(!currentUser?.permissions.clients.delete) {
            throw new Error("ليس لديك صلاحية حذف العملاء");
        }

        const { error: authError } = await supabase.auth.signInWithPassword({
            email: currentUser.email,
            password
        });

        if (authError) {
            throw new Error(t('error'));
        }

        const { error } = await supabase.from('Clients').delete().eq('id', clientToDelete.id);
        if (error) throw new Error(getErrorMessage(error));

        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        showToast(t('success'), 'success');
        setDeleteModalOpen(false);
        setClientToDelete(null);
    };

    return (
        <div className="space-y-6 pb-20">
            <PasswordModal 
                isOpen={deleteModalOpen} 
                onClose={() => setDeleteModalOpen(false)} 
                onConfirm={handleDeleteClient}
                title={t('confirmDelete')}
                message={t('deleteWarning')}
            />
            
            <ClientFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveClient} 
                client={selectedClient} 
                isSaving={isSaving}
                cities={cities}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">{t('manageClients')}</h2>
                <div className="flex gap-2">
                    <button onClick={handleExportClients} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors">
                        <Download size={20}/> تصدير العملاء
                    </button>
                    {currentUser?.permissions.clients.create && (
                        <button onClick={() => { setSelectedClient(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow hover:bg-primary-dark transition-colors">
                            <PlusCircle size={20}/> {t('addClient')}
                        </button>
                    )}
                </div>
            </div>

            {/* Layout: Stats Left, Top 5 Right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Stats Cards (2/3 width on LG) */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ClientStatCard 
                        title="إجمالي العملاء" 
                        value={stats.total} 
                        icon={Users} 
                        color="bg-blue-600" 
                    />
                    <ClientStatCard 
                        title="عملاء نشطين" 
                        value={stats.active} 
                        icon={UserCheck} 
                        color="bg-green-600" 
                        subValue={`${Math.round((stats.active/Math.max(stats.total,1))*100)}% تفاعل`}
                    />
                    <ClientStatCard 
                        title="إجمالي الديون" 
                        value={stats.debt.toLocaleString()} 
                        icon={AlertOctagon} 
                        color="bg-red-500" 
                        subValue="MRU"
                    />
                </div>
                
                {/* Top Clients (1/3 width on LG) */}
                <div className="lg:col-span-1">
                    <TopClientsWidget topClients={topClients} />
                </div>
            </div>

            <div className="relative">
                <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')} 
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-10 py-2 bg-white dark:bg-slate-700 dark:border-gray-600 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-gray-900 dark:text-white"
                />
                {isClientsLoading ? (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-primary animate-spin" size={18}/>
                ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayClients.map(client => {
                    // Note: Filtering orders client-side is limited to loaded orders. 
                    // For massive scale, client specific order stats should be fetched separately on details view.
                    const clientOrders = orders.filter(o => o.clientId === client.id && o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.NEW);
                    const city = cities.find(c => c.id === client.cityId);
                    
                    const { totalSpend, totalDebt } = clientOrders.reduce((acc, o) => {
                        const amount = Math.round(Number(o.priceInMRU || 0) + Number(o.commission || 0) + Number(o.shippingCost || 0) + Number(o.localDeliveryCost || 0));
                        const paid = Math.round(Number(o.amountPaid || 0));
                        acc.totalSpend += amount;
                        acc.totalDebt += Math.max(0, amount - paid);
                        return acc;
                    }, { totalSpend: 0, totalDebt: 0 });
                    
                    const lastOrder = clientOrders.length > 0 
                        ? new Date(Math.max(...clientOrders.map(o => new Date(o.orderDate).getTime()))).toLocaleDateString('en-GB')
                        : '---';

                    return (
                        <div key={client.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-lg transition-all relative">
                            {/* Status Indicator Bar */}
                            <div className={`h-1.5 w-full ${totalDebt > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md ${client.gender === 'female' ? 'bg-gradient-to-br from-pink-400 to-pink-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                                            {client.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate" title={client.name}>{client.name}</h3>
                                            <p className="text-xs text-gray-500 font-mono">{client.phone}</p>
                                            {city && <p className="text-[10px] text-primary font-medium flex items-center gap-1 mt-1"><MapPin size={10}/> {city.name}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {currentUser?.permissions.clients.edit && (
                                            <button onClick={() => { setSelectedClient(client); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                                                <Edit size={16}/>
                                            </button>
                                        )}
                                        {currentUser?.permissions.clients.delete && (
                                            <button onClick={() => { setClientToDelete(client); setDeleteModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs mb-4">
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 font-bold mb-0.5">آخر طلب</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-300">{lastOrder}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 font-bold mb-0.5">إجمالي الطلبات</span>
                                        <span className="font-mono text-gray-700 dark:text-gray-300">{clientOrders.length}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 font-bold mb-0.5">الإنفاق</span>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{totalSpend.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-gray-400 font-bold mb-0.5">الديون</span>
                                        <span className={`font-mono font-black ${totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalDebt.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <a 
                                        href={`https://wa.me/${client.whatsappNumber || client.phone}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg transition-colors flex items-center justify-center gap-2 font-bold text-xs"
                                    >
                                        <MessageCircle size={16}/> واتساب
                                    </a>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Load More Button */}
            {hasMoreClients && !searchTerm && (
                <div className="flex justify-center mt-8 mb-4">
                    <button 
                        onClick={loadMoreClients} 
                        disabled={isClientsLoading}
                        className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 disabled:opacity-50 font-bold"
                    >
                        {isClientsLoading ? <Loader2 className="animate-spin" size={20}/> : <ArrowDown size={20}/>}
                        {isClientsLoading ? 'جاري التحميل...' : 'تحميل المزيد من العملاء'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ClientsPage;

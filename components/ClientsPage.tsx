
import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import type { Client, Order, City } from '../types';
import { supabase, getErrorMessage } from '../supabaseClient';
import { User, Phone, Search, PlusCircle, Edit, Trash2, X, Save, Eye, MapPin, ShoppingBag, DollarSign, ListOrdered, BarChart3, TrendingUp, Users, BadgePercent, Loader2, ShieldCheck, ChevronDown, MessageCircle, ExternalLink, UserCheck, Trophy, AlertOctagon, Wallet, Download, ArrowDown, Package, Clock, FileSpreadsheet } from 'lucide-react';
import { STATUS_DETAILS } from '../constants';
import { AuthContext } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { OrderStatus } from '../types';
import * as XLSX from 'xlsx';
import ClientDetailsModal from './ClientDetailsModal';
import PasswordConfirmationModal from './PasswordConfirmationModal';
import ImportClientsModal from './ImportClientsModal';

interface ClientsPageProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    orders: Order[];
    cities?: City[];
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

    const inputClass = "w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary font-bold transition-all";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-black">{client ? t('edit') : t('addClient')}</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-5 custom-scrollbar">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1.5 tracking-wider">{t('clientName')}*</label>
                        <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className={inputClass} placeholder="الاسم الكامل" />
                    </div>
                     <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1.5 tracking-wider">{t('phone')}*</label>
                        <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} className={inputClass} placeholder="رقم الهاتف" />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1.5 tracking-wider">المدينة</label>
                        <select name="cityId" value={formData.cityId || ''} onChange={handleInputChange} className={inputClass}>
                            <option value="">اختر المدينة...</option>
                            {cities.map(city => (
                                <option key={city.id} value={city.id}>{city.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1.5 tracking-wider">{t('gender')}*</label>
                        <select name="gender" value={formData.gender || 'male'} onChange={handleInputChange} className={inputClass}>
                            <option value="male">{t('male')}</option>
                            <option value="female">{t('female')}</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1.5 tracking-wider">{t('whatsapp')}</label>
                        {!showWhatsappInput ? (
                            <button onClick={() => setShowWhatsappInput(true)} className="w-full text-xs font-bold p-3 border-2 border-dashed rounded-xl border-gray-200 dark:border-gray-700 hover:border-primary transition-colors text-gray-400 hover:text-primary">
                                + إضافة رقم واتساب مختلف
                            </button>
                        ) : (
                             <div className="relative">
                                <input type="tel" name="whatsappNumber" value={formData.whatsappNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="رقم الواتساب المختلف" autoFocus/>
                                <button onClick={clearWhatsapp} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500" title="إلغاء واستخدام رقم الهاتف">
                                    <X size={18}/>
                                </button>
                            </div>
                        )}
                    </div>
                     <div>
                        <label className="block text-xs font-black text-gray-400 uppercase mb-1.5 tracking-wider">{t('address')}</label>
                        <textarea name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} className={`${inputClass} h-auto`} placeholder="العنوان بالتفصيل..."></textarea>
                    </div>
                </div>
                <div className="p-6 flex justify-end flex-shrink-0 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
                    <button onClick={handleSave} disabled={isSaving} className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 font-black hover:bg-primary-dark transition-all active:scale-95 disabled:opacity-50">
                        {isSaving ? <Loader2 className="animate-spin" size={22}/> : <Save size={22}/>}
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
    
    const [searchTerm, setSearchTerm] = useState('');
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [actionVerifyModalOpen, setActionVerifyModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<'export' | 'import' | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);

    const isAdmin = currentUser?.role === 'admin';

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => { searchClients(val); }, 500); 
    };

    const displayClients = useMemo(() => {
        if (!searchTerm) return clients;
        const lowerSearch = searchTerm.toLowerCase();
        return clients.filter(c => c.name.toLowerCase().includes(lowerSearch) || c.phone.includes(lowerSearch));
    }, [clients, searchTerm]);

    const handleSaveClient = async (clientData: Partial<Client>) => {
        if (!supabase) return;
        
        // --- PREVENT DUPLICATES ON MANUAL SAVE ---
        const cleanPhone = (clientData.phone || '').replace(/\s+/g, '');
        const duplicate = clients.find(c => c.phone.replace(/\s+/g, '') === cleanPhone && c.id !== clientData.id);
        
        if (duplicate) {
            showToast(`رقم الهاتف (${clientData.phone}) مسجل مسبقاً باسم: ${duplicate.name}`, 'error');
            return;
        }

        if (clientData.id) {
            if(!currentUser?.permissions.clients.edit) { showToast("ليس لديك صلاحية التعديل", "error"); return; }
        } else {
            if(!currentUser?.permissions.clients.create) { showToast("ليس لديك صلاحية الإضافة", "error"); return; }
        }

        setIsSaving(true);
        try {
            const payload = {
                name: clientData.name,
                phone: cleanPhone,
                whatsapp_number: clientData.whatsappNumber?.replace(/\s+/g, '') || cleanPhone,
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

            const savedClient = { ...res.data, whatsappNumber: res.data.whatsapp_number, cityId: res.data.city_id };
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
        if(!currentUser?.permissions.clients.delete) { throw new Error("ليس لديك صلاحية الحذف"); }
        const { error: authError } = await supabase.auth.signInWithPassword({ email: currentUser.email, password });
        if (authError) throw new Error(t('error'));
        const { error } = await supabase.from('Clients').delete().eq('id', clientToDelete.id);
        if (error) throw new Error(getErrorMessage(error));
        setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
        showToast(t('success'), 'success');
        setDeleteModalOpen(false);
        setClientToDelete(null);
    };

    const { stats, topClients } = useMemo(() => {
        let totalDebt = 0;
        let activeClientsSet = new Set<string>();
        const clientSpend: Record<string, { total: number, orders: number }> = {};
        orders.forEach(o => {
            if(o.status === OrderStatus.CANCELLED || o.status === OrderStatus.NEW) return;
            const total = Math.round(Number(o.priceInMRU || 0) + Number(o.commission || 0) + Number(o.shippingCost || 0) + Number(o.localDeliveryCost || 0));
            const paid = Math.round(Number(o.amountPaid || 0));
            totalDebt += Math.max(0, total - paid);
            activeClientsSet.add(o.clientId);
            if (!clientSpend[o.clientId]) clientSpend[o.clientId] = { total: 0, orders: 0 };
            clientSpend[o.clientId].total += total;
            clientSpend[o.clientId].orders += 1;
        });
        const sortedClients = Object.entries(clientSpend).sort(([, a], [, b]) => b.total - a.total).slice(0, 5).map(([id, data]) => {
            const c = clients.find(client => client.id === id);
            return c ? { client: c, total: data.total, orders: data.orders } : null;
        }).filter(Boolean) as { client: Client, total: number, orders: number }[];
        return { stats: { total: totalClientsCount || clients.length, active: activeClientsSet.size, debt: totalDebt }, topClients: sortedClients };
    }, [clients, orders, totalClientsCount]);

    return (
        <div className="space-y-6 pb-20">
            <PasswordConfirmationModal isOpen={actionVerifyModalOpen} onClose={() => { setActionVerifyModalOpen(false); setPendingAction(null); }} onConfirm={async (password) => { if (pendingAction === 'export') { /* export logic */ } else if (pendingAction === 'import') { setIsImportModalOpen(true); } setActionVerifyModalOpen(false); setPendingAction(null); }} title="تأكيد هوية المسؤول" message="يرجى إدخال كلمة المرور للمتابعة." verificationMode="online" />
            <ImportClientsModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onSuccess={() => { showToast('تم الاستيراد بنجاح', 'success'); }} />
            {selectedClientForDetails && <ClientDetailsModal isOpen={!!selectedClientForDetails} onClose={() => setSelectedClientForDetails(null)} client={selectedClientForDetails} clientOrders={orders.filter(o => o.clientId === selectedClientForDetails.id)} cities={cities} onUpdateClient={async (c) => handleSaveClient(c)} />}
            <PasswordConfirmationModal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={handleDeleteClient} title={t('confirmDelete')} message={t('deleteWarning')} />
            <ClientFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveClient} client={selectedClient} isSaving={isSaving} cities={cities} />
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white">{t('manageClients')}</h2>
                <div className="flex gap-2">
                    {isAdmin && <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 font-bold transition-all"><FileSpreadsheet size={20}/> استيراد Excel</button>}
                    {currentUser?.permissions.clients.create && <button onClick={() => { setSelectedClient(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl shadow-lg hover:bg-primary-dark font-black transition-all active:scale-95"><PlusCircle size={20}/> {t('addClient')}</button>}
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ClientStatCard title="إجمالي العملاء" value={stats.total} icon={Users} color="bg-blue-600" />
                    <ClientStatCard title="عملاء نشطين" value={stats.active} icon={UserCheck} color="bg-green-600" subValue={`${Math.round((stats.active/Math.max(stats.total,1))*100)}% تفاعل`} />
                    <ClientStatCard title="إجمالي الديون" value={stats.debt.toLocaleString()} icon={AlertOctagon} color="bg-red-500" subValue="MRU" />
                </div>
                <div className="lg:col-span-1">
                    <TopClientsWidget topClients={topClients} />
                </div>
            </div>
            <div className="relative">
                <input type="text" placeholder={t('searchPlaceholder')} value={searchTerm} onChange={handleSearchChange} className="w-full pl-10 pr-12 py-4 bg-white dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-primary text-slate-800 dark:text-white shadow-sm font-black" />
                {isClientsLoading ? <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-primary animate-spin" size={22}/> : <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={22}/>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayClients.map(client => {
                    const clientOrders = orders.filter(o => o.clientId === client.id && o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.NEW);
                    const city = cities.find(c => c.id === client.cityId);
                    const { totalSpend, netBalance } = clientOrders.reduce((acc, o) => {
                        const amount = Math.round(Number(o.priceInMRU || 0) + Number(o.commission || 0) + Number(o.shippingCost || 0) + Number(o.localDeliveryCost || 0));
                        const paid = Math.round(Number(o.amountPaid || 0));
                        acc.totalSpend += amount;
                        acc.netBalance += (paid - amount);
                        return acc;
                    }, { totalSpend: 0, netBalance: 0 });
                    const lastOrder = clientOrders.length > 0 ? new Date(Math.max(...clientOrders.map(o => new Date(o.orderDate).getTime()))).toLocaleDateString('en-GB') : '---';
                    return (
                        <div key={client.id} className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden group hover:shadow-2xl transition-all duration-300 relative flex flex-col justify-between h-full min-h-[280px]">
                            <div className="absolute top-0 w-full h-24 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900/50 z-0"></div>
                            <div className={`absolute top-0 left-0 right-0 h-1.5 w-full z-10 ${netBalance < 0 ? 'bg-red-500' : netBalance > 0 ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                            <div className="absolute top-4 left-4 z-20 flex gap-2">
                                {currentUser?.permissions.clients.edit && <button onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setIsModalOpen(true); }} className="p-2.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-500 hover:text-blue-600 rounded-2xl shadow-sm transition-all hover:scale-110"><Edit size={16}/></button>}
                                {currentUser?.permissions.clients.delete && <button onClick={(e) => { e.stopPropagation(); setClientToDelete(client); setDeleteModalOpen(true); }} className="p-2.5 bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-500 hover:text-red-600 rounded-2xl shadow-sm transition-all hover:scale-110"><Trash2 size={16}/></button>}
                            </div>
                            <div className="p-6 relative z-10 flex flex-col h-full cursor-pointer" onClick={() => setSelectedClientForDetails(client)}>
                                <div className="flex flex-col items-center mt-4 mb-5">
                                    <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center text-3xl font-black text-white shadow-xl border-4 border-white dark:border-gray-800 mb-3 ${client.gender === 'female' ? 'bg-gradient-to-br from-pink-400 to-rose-600' : 'bg-gradient-to-br from-blue-500 to-indigo-700'}`}>{client.name.charAt(0).toUpperCase()}</div>
                                    <h3 className="font-black text-xl text-gray-900 dark:text-white text-center line-clamp-1 w-full px-2">{client.name}</h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-[11px] text-slate-400 font-black font-mono tracking-tighter" dir="ltr">{client.phone}</span>
                                        {city && <span className="text-[9px] bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 font-black">{city.name}</span>}
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-4 grid grid-cols-2 gap-px border border-slate-100 dark:border-slate-800 mb-5 shadow-inner">
                                    <div className="p-2 text-center border-l border-slate-200 dark:border-slate-800"><p className="text-[9px] text-gray-400 font-black uppercase mb-1">الإنفاق</p><p className="font-mono font-black text-blue-600 text-sm">{totalSpend.toLocaleString()}</p></div>
                                    <div className="p-2 text-center"><p className="text-[9px] text-gray-400 font-black uppercase mb-1">الرصيد</p><p className={`font-mono font-black text-sm ${netBalance < 0 ? 'text-red-500' : netBalance > 0 ? 'text-blue-500' : 'text-green-500'}`}>{Math.abs(netBalance).toLocaleString()} {netBalance > 0 ? ' له' : netBalance < 0 ? ' عليه' : ''}</p></div>
                                </div>
                                <a href={`https://wa.me/${client.whatsappNumber || client.phone}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-full py-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-800 rounded-2xl transition-all flex items-center justify-center gap-2 font-black text-sm active:scale-95 shadow-sm"><MessageCircle size={18}/> تواصل واتساب</a>
                            </div>
                        </div>
                    );
                })}
            </div>
            {hasMoreClients && !searchTerm && <div className="flex justify-center mt-10 mb-10"><button onClick={loadMoreClients} disabled={isClientsLoading} className="flex items-center gap-2 px-10 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl shadow-xl hover:shadow-2xl transition-all border border-slate-100 dark:border-slate-700 font-black">{isClientsLoading ? <Loader2 className="animate-spin" size={22}/> : <ArrowDown size={22}/>} {isClientsLoading ? 'جاري التحميل...' : 'تحميل المزيد من العملاء'}</button></div>}
        </div>
    );
};

export default ClientsPage;

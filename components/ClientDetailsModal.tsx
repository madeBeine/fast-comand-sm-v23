
import React, { useState, useMemo, useEffect } from 'react';
import type { Client, Order, City } from '../types';
import { OrderStatus } from '../types';
import { STATUS_DETAILS } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { X, User, Phone, MapPin, MessageCircle, Edit2, Save, Loader2, Package, Truck, CheckCircle2, AlertCircle, TrendingUp, Wallet, Archive, Ban, Clock, GripHorizontal } from 'lucide-react';

interface ClientDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    clientOrders: Order[];
    cities: City[];
    onUpdateClient: (updatedClient: Client) => Promise<void>;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ isOpen, onClose, client, clientOrders, cities, onUpdateClient }) => {
    const { t } = useLanguage();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Client>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && client) {
            setFormData(client);
            setIsEditing(false);
        }
    }, [isOpen, client]);

    const stats = useMemo(() => {
        let revenue = 0;
        let netBalance = 0; // Positive = Surplus, Negative = Debt
        
        // Initialize counts for ALL statuses to 0
        const counts: Record<string, number> = {};
        Object.values(OrderStatus).forEach(s => counts[s] = 0);
        
        let total = 0;

        clientOrders.forEach(o => {
            if (o.status === OrderStatus.CANCELLED && !counts[OrderStatus.CANCELLED]) {
                // Keep cancelled in counts but skip financial summation usually
            }
            
            // Increment status count
            if (counts[o.status] !== undefined) {
                counts[o.status]++;
            }
            
            total++;

            // Financials (Skip Cancelled and New for debt/revenue calc usually, or based on business logic)
            if (o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.NEW) {
                const orderTotal = (Number(o.priceInMRU) || 0) + (Number(o.commission) || 0) + (Number(o.shippingCost) || 0) + (Number(o.localDeliveryCost) || 0);
                const paid = Number(o.amountPaid) || 0;
                revenue += paid; // Income is what they paid
                
                // Net Balance Calculation: Paid - Cost
                // If Paid (100) > Cost (80) = +20 (Surplus)
                // If Paid (50) < Cost (100) = -50 (Debt)
                netBalance += (paid - orderTotal);
            }
        });

        return { revenue, netBalance, counts, total };
    }, [clientOrders]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateClient({ ...client, ...formData } as Client);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const cityName = cities.find(c => c.id === (isEditing ? formData.cityId : client.cityId))?.name || 'غير محدد';

    // Helper for Stat Cards
    const StatBox = ({ label, value, icon: Icon, colorClass, bgClass }: any) => (
        <div className={`p-4 rounded-2xl border ${bgClass} flex flex-col items-center justify-center text-center gap-2`}>
            <div className={`p-2 rounded-full ${colorClass.replace('text-', 'bg-').replace('600', '100')} ${colorClass}`}>
                <Icon size={20} />
            </div>
            <div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">{label}</span>
                <span className={`text-xl font-black font-mono ${colorClass}`}>{value}</span>
            </div>
        </div>
    );

    const BreakdownItem = ({ label, count, color, icon: Icon }: any) => (
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} text-white shadow-sm`}>
                    <Icon size={16}/>
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{label}</span>
            </div>
            <span className="font-mono font-black text-lg text-gray-800 dark:text-white">{count}</span>
        </div>
    );

    // Helper to map status to icon & color style
    const getStatusStyle = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.NEW: return { color: 'bg-blue-500', icon: AlertCircle };
            case OrderStatus.ORDERED: return { color: 'bg-purple-500', icon: Package };
            case OrderStatus.SHIPPED_FROM_STORE: return { color: 'bg-indigo-500', icon: Truck };
            case OrderStatus.ARRIVED_AT_OFFICE: return { color: 'bg-pink-500', icon: MapPin };
            case OrderStatus.STORED: return { color: 'bg-cyan-600', icon: Archive };
            case OrderStatus.COMPLETED: return { color: 'bg-green-600', icon: CheckCircle2 };
            case OrderStatus.CANCELLED: return { color: 'bg-gray-500', icon: Ban };
            default: return { color: 'bg-gray-400', icon: GripHorizontal };
        }
    };

    // Define explicit order for display
    const displayOrder = [
        OrderStatus.NEW, 
        OrderStatus.ORDERED, 
        OrderStatus.SHIPPED_FROM_STORE, 
        OrderStatus.ARRIVED_AT_OFFICE, 
        OrderStatus.STORED, 
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED
    ];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4" onClick={onClose}>
            <div className="bg-gray-50 dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                
                {/* Header Section */}
                <div className="relative bg-white dark:bg-gray-800 p-6 pb-8 border-b dark:border-gray-700">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500"/>
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-4xl font-black text-white shadow-xl mb-4 border-4 border-white dark:border-gray-700">
                            {client.name.charAt(0).toUpperCase()}
                        </div>
                        
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="text-2xl font-black text-center bg-gray-100 dark:bg-gray-700 rounded-lg p-2 border-2 border-primary focus:outline-none mb-1 w-full max-w-xs"
                            />
                        ) : (
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white text-center mb-1">{client.name}</h2>
                        )}
                        
                        {!isEditing && <p className="text-sm text-gray-500 font-mono" dir="ltr">{client.phone}</p>}

                        <button 
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            disabled={isSaving}
                            className={`mt-4 px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${isEditing ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={16}/> : isEditing ? <Save size={16}/> : <Edit2 size={16}/>}
                            {isEditing ? 'حفظ التعديلات' : 'تعديل البيانات'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    
                    {/* Financial Stats Row */}
                    <div className="grid grid-cols-3 gap-3">
                        <StatBox 
                            label="إجمالي الدخل" 
                            value={stats.revenue.toLocaleString()} 
                            icon={TrendingUp} 
                            colorClass="text-green-600" 
                            bgClass="bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900"
                        />
                        <StatBox 
                            label={`صافي الرصيد ${stats.netBalance > 0 ? '(له)' : stats.netBalance < 0 ? '(عليه)' : ''}`}
                            value={Math.abs(stats.netBalance).toLocaleString()} 
                            icon={Wallet} 
                            colorClass={stats.netBalance < 0 ? 'text-red-600' : stats.netBalance > 0 ? 'text-blue-600' : 'text-gray-600'}
                            bgClass={stats.netBalance < 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100' : stats.netBalance > 0 ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100' : 'bg-gray-50 dark:bg-gray-900/10'}
                        />
                        <StatBox 
                            label="عدد الطلبات" 
                            value={stats.total} 
                            icon={Package} 
                            colorClass="text-purple-600" 
                            bgClass="bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900"
                        />
                    </div>

                    {/* Order Status Breakdown */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">حالة الطلبات</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {displayOrder.map(status => {
                                const count = stats.counts[status] || 0;
                                const style = getStatusStyle(status);
                                // Show status if count > 0 OR if it's not cancelled (to keep UI consistent, or hide zeros if preferred)
                                // Showing all except Cancelled if 0 looks cleaner
                                if (count === 0 && status === OrderStatus.CANCELLED) return null;

                                return (
                                    <BreakdownItem 
                                        key={status}
                                        label={t(STATUS_DETAILS[status]?.name as any || status)} 
                                        count={count} 
                                        icon={style.icon} 
                                        color={style.color} 
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Contact Info / Edit Form */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 p-5">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">بيانات التواصل</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Phone */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">رقم الاتصال</label>
                                {isEditing ? (
                                    <input 
                                        type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})}
                                        className="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm font-mono dir-ltr"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white dir-ltr">
                                        <Phone size={16} className="text-primary"/> {client.phone}
                                    </div>
                                )}
                            </div>

                            {/* WhatsApp */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">واتساب</label>
                                {isEditing ? (
                                    <input 
                                        type="text" value={formData.whatsappNumber || ''} onChange={e => setFormData({...formData, whatsappNumber: e.target.value})}
                                        className="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm font-mono dir-ltr"
                                        placeholder="نفس رقم الهاتف"
                                    />
                                ) : (
                                    <a href={`https://wa.me/${client.whatsappNumber || client.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-bold text-green-600 hover:underline dir-ltr">
                                        <MessageCircle size={16}/> {client.whatsappNumber || client.phone}
                                    </a>
                                )}
                            </div>

                            {/* City */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">المدينة</label>
                                {isEditing ? (
                                    <select 
                                        value={formData.cityId || ''} 
                                        onChange={e => setFormData({...formData, cityId: e.target.value})}
                                        className="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm"
                                    >
                                        <option value="">اختر...</option>
                                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                        <MapPin size={16} className="text-primary"/> {cityName}
                                    </div>
                                )}
                            </div>

                            {/* Gender */}
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">الجنس</label>
                                {isEditing ? (
                                    <select 
                                        value={formData.gender || 'male'} 
                                        onChange={e => setFormData({...formData, gender: e.target.value as any})}
                                        className="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm"
                                    >
                                        <option value="male">ذكر</option>
                                        <option value="female">أنثى</option>
                                    </select>
                                ) : (
                                    <div className="flex items-center gap-2 font-bold text-gray-800 dark:text-white">
                                        <User size={16} className="text-primary"/> {client.gender === 'female' ? 'أنثى' : 'ذكر'}
                                    </div>
                                )}
                            </div>

                            {/* Address */}
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-400 block mb-1">العنوان التفصيلي</label>
                                {isEditing ? (
                                    <textarea 
                                        value={formData.address || ''} 
                                        onChange={e => setFormData({...formData, address: e.target.value})}
                                        className="w-full p-2 bg-gray-50 dark:bg-gray-900 border rounded-lg text-sm h-20"
                                    />
                                ) : (
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700">
                                        {client.address || 'لا يوجد عنوان مسجل'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientDetailsModal;

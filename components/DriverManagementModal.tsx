
import React, { useState } from 'react';
import type { Driver } from '../types';
import { supabase, getErrorMessage } from '../supabaseClient';
import { X, Save, Plus, Edit2, Trash2, Loader2, Bike, Truck, Car, Phone, User, FileText, Activity, Calendar } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface DriverManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    drivers: Driver[];
    setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
}

const DriverManagementModal: React.FC<DriverManagementModalProps> = ({ isOpen, onClose, drivers, setDrivers }) => {
    const { showToast } = useToast();
    const [view, setView] = useState<'list' | 'form' | 'stats'>('list');
    const [editingDriver, setEditingDriver] = useState<Partial<Driver>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [driverStats, setDriverStats] = useState<any>(null); // Quick stats for selected driver

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!editingDriver.name || !editingDriver.phone) {
            showToast('الاسم ورقم الهاتف مطلوبان', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: editingDriver.name,
                phone: editingDriver.phone,
                national_id: editingDriver.nationalId,
                vehicle_type: editingDriver.vehicleType,
                vehicle_number: editingDriver.vehicleNumber,
                is_active: editingDriver.isActive ?? true
            };

            let result;
            if (editingDriver.id) {
                // Update
                const { data, error } = await supabase.from('Drivers').update(payload).eq('id', editingDriver.id).select().single();
                if (error) throw error;
                result = data;
                setDrivers(prev => prev.map(d => d.id === result.id ? { ...result, nationalId: result.national_id, vehicleType: result.vehicle_type, vehicleNumber: result.vehicle_number, isActive: result.is_active } : d));
            } else {
                // Insert
                const { data, error } = await supabase.from('Drivers').insert(payload).select().single();
                if (error) throw error;
                result = data;
                setDrivers(prev => [...prev, { ...result, nationalId: result.national_id, vehicleType: result.vehicle_type, vehicleNumber: result.vehicle_number, isActive: result.is_active }]);
            }

            showToast('تم حفظ بيانات السائق بنجاح', 'success');
            setView('list');
            setEditingDriver({});
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا السائق؟')) return;
        try {
            const { error } = await supabase.from('Drivers').delete().eq('id', id);
            if (error) throw error;
            setDrivers(prev => prev.filter(d => d.id !== id));
            showToast('تم الحذف', 'success');
        } catch (e: any) {
            showToast(getErrorMessage(e), 'error');
        }
    };

    const loadStats = async (driver: Driver) => {
        setEditingDriver(driver);
        setView('stats');
        // Mock fetch stats logic or real query
        if (supabase) {
            const { count } = await supabase.from('Orders').select('*', { count: 'exact', head: true }).eq('driver_id', driver.id);
            const { data: lastOrder } = await supabase.from('Orders').select('updated_at').eq('driver_id', driver.id).order('updated_at', { ascending: false }).limit(1).single();
            setDriverStats({
                totalDeliveries: count || 0,
                lastActive: lastOrder?.updated_at ? new Date(lastOrder.updated_at).toLocaleDateString() : 'لا يوجد نشاط'
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[120] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <Bike className="text-primary"/> إدارة عمال التوصيل
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><X size={20}/></button>
                </div>

                <div className="p-6 h-[60vh] overflow-y-auto custom-scrollbar">
                    {view === 'list' ? (
                        <div className="space-y-4">
                            <button 
                                onClick={() => { setEditingDriver({ isActive: true }); setView('form'); }}
                                className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-primary/20"
                            >
                                <Plus size={18}/> إضافة عامل جديد
                            </button>

                            {drivers.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Bike size={48} className="mx-auto mb-2 opacity-20"/>
                                    <p>لا يوجد عمال توصيل مسجلين.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {drivers.map(driver => (
                                        <div key={driver.id} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 flex justify-between items-center group">
                                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => loadStats(driver)}>
                                                <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 shadow-sm">
                                                    {driver.vehicleType === 'Car' ? <Car size={18}/> : driver.vehicleType === 'Truck' ? <Truck size={18}/> : <Bike size={18}/>}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-800 dark:text-white">{driver.name}</h4>
                                                    <p className="text-xs text-gray-500 font-mono">{driver.phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => loadStats(driver)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100" title="إحصائيات"><Activity size={16}/></button>
                                                <button onClick={() => { setEditingDriver(driver); setView('form'); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit2 size={16}/></button>
                                                <button onClick={() => handleDelete(driver.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : view === 'stats' ? (
                        <div className="space-y-6 text-center">
                            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto text-gray-500">
                                <User size={40}/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black">{editingDriver.name}</h2>
                                <p className="text-gray-500 font-mono">{editingDriver.phone}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                    <p className="text-xs font-bold text-blue-600 mb-1">إجمالي التوصيلات</p>
                                    <p className="text-2xl font-black">{driverStats?.totalDeliveries || 0}</p>
                                </div>
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                    <p className="text-xs font-bold text-green-600 mb-1">آخر نشاط</p>
                                    <p className="text-sm font-bold">{driverStats?.lastActive || '-'}</p>
                                </div>
                            </div>
                            
                            <div className="text-left text-xs text-gray-400 space-y-2 border-t dark:border-gray-700 pt-4">
                                <p>رقم الهوية: {editingDriver.nationalId || 'غير مسجل'}</p>
                                <p>المركبة: {editingDriver.vehicleType} - {editingDriver.vehicleNumber || ''}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">اسم العامل *</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input type="text" value={editingDriver.name || ''} onChange={e => setEditingDriver({...editingDriver, name: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold" placeholder="الاسم الكامل"/>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">رقم الهاتف *</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input type="tel" value={editingDriver.phone || ''} onChange={e => setEditingDriver({...editingDriver, phone: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold" placeholder="رقم الهاتف"/>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">رقم الهوية / الرخصة</label>
                                <div className="relative">
                                    <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                    <input type="text" value={editingDriver.nationalId || ''} onChange={e => setEditingDriver({...editingDriver, nationalId: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary" placeholder="رقم وطني"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-500">وسيلة النقل</label>
                                    <select value={editingDriver.vehicleType || 'Bike'} onChange={e => setEditingDriver({...editingDriver, vehicleType: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold">
                                        <option value="Bike">دراجة نارية</option>
                                        <option value="TukTuk">توك توك</option>
                                        <option value="Car">سيارة</option>
                                        <option value="Truck">شاحنة</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-500">رقم اللوحة (اختياري)</label>
                                    <input type="text" value={editingDriver.vehicleNumber || ''} onChange={e => setEditingDriver({...editingDriver, vehicleNumber: e.target.value})} className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-none focus:ring-2 focus:ring-primary" placeholder="1234AA"/>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" checked={editingDriver.isActive ?? true} onChange={e => setEditingDriver({...editingDriver, isActive: e.target.checked})} className="w-5 h-5 rounded text-primary focus:ring-primary"/>
                                <span className="font-bold text-sm">حساب نشط</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
                    {view === 'form' || view === 'stats' ? (
                        <>
                            <button onClick={() => setView('list')} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl font-bold">رجوع</button>
                            {view === 'form' && <button onClick={handleSave} disabled={isSaving} className="flex-[2] py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} حفظ
                            </button>}
                        </>
                    ) : (
                        <button onClick={onClose} className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl font-bold">إغلاق</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DriverManagementModal;

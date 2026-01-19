
import React, { useState, useEffect } from 'react';
import type { User, Permissions, UserRole } from '../types';
import { DEFAULT_EMPLOYEE_PERMISSIONS, DEFAULT_VIEWER_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS } from '../constants';
import { X, Save, Eye, EyeOff, Mail, Lock, Shield, Loader2, AlertTriangle, Upload, User as UserIcon, PieChart, Settings, Truck, Package, Users, Database, ShieldCheck, ScrollText } from 'lucide-react';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User, email?: string, password?: string) => void;
    user: User | null;
    isSaving?: boolean;
}

const getInitialPermissions = (role: string = 'employee'): Permissions => {
    if (role === 'admin') return JSON.parse(JSON.stringify(DEFAULT_ADMIN_PERMISSIONS));
    if (role === 'viewer') return JSON.parse(JSON.stringify(DEFAULT_VIEWER_PERMISSIONS));
    return JSON.parse(JSON.stringify(DEFAULT_EMPLOYEE_PERMISSIONS));
};

const PermissionCheckbox: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; highlight?: boolean }> = ({ label, checked, onChange, highlight }) => (
    <label className={`flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg border transition-all ${checked ? (highlight ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800') : 'bg-gray-50 border-gray-100 dark:bg-gray-800 dark:border-gray-700'}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`form-checkbox h-4 w-4 rounded ${highlight ? 'text-red-600 focus:ring-red-500' : 'text-primary focus:ring-primary-light'}`} />
        <span className={checked ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}>{label}</span>
    </label>
);

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, user, isSaving = false }) => {
    const [formData, setFormData] = useState<Partial<User>>({});
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const isEditing = !!user;

    useEffect(() => {
        if (isOpen) {
            if (user) {
                setFormData({ ...user });
                setAvatarPreview(user.avatar || null);
            } else {
                setFormData({
                    username: '',
                    role: 'employee' as any,
                    permissions: getInitialPermissions('employee'),
                    avatar: undefined
                });
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setAvatarPreview(null);
            }
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                if (!event.target?.result) return reject("فشل في قراءة الملف");
                const originalBase64 = event.target.result as string;
                
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = originalBase64;
                
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300; // صور البروفايل أصغر بكثير
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return resolve(originalBase64);
                    
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    try {
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        resolve(compressedDataUrl.length < 100 ? originalBase64 : compressedDataUrl);
                    } catch (e) {
                        resolve(originalBase64);
                    }
                };
                img.onerror = () => resolve(originalBase64);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await compressImage(e.target.files[0]);
                setAvatarPreview(base64);
                setFormData(prev => ({ ...prev, avatar: base64 }));
            } catch (err) {
                alert("فشل رفع الصورة");
            }
        }
    };

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRole = e.target.value as any;
        setFormData(prev => ({
            ...prev,
            role: newRole,
            permissions: getInitialPermissions(newRole)
        }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePermissionChange = (category: keyof Permissions, permission: string, value: boolean) => {
        setFormData(prev => {
            if (!prev.permissions) return prev;
            const newPermissions = JSON.parse(JSON.stringify(prev.permissions)); 
            
            if (category === 'canAccessSettings' || category === 'canManageUsers' || category === 'canViewAuditLog' || category === 'canViewFinance') {
                (newPermissions as any)[category] = value;
                return { ...prev, permissions: newPermissions };
            }

            const cat = newPermissions[category] as any;
            if (cat && typeof cat === 'object') {
                cat[permission] = value;
            }
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleSave = () => {
        if (isSaving) return;
        if (!formData.username) {
            alert('اسم المستخدم مطلوب.');
            return;
        }
        let cleanEmail = email;
        let cleanPassword = password;
        if (!isEditing) {
            cleanEmail = email.trim();
            cleanPassword = password.trim();
            if (!cleanEmail || !cleanPassword) {
                alert('البريد الإلكتروني وكلمة المرور مطلوبان لإنشاء حساب.');
                return;
            }
            if (cleanPassword.length < 6) {
                alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
                return;
            }
            if (cleanPassword !== confirmPassword) {
                alert('كلمتا المرور غير متطابقتين.');
                return;
            }
        } else {
            if (password && password !== confirmPassword) {
                alert('كلمتا المرور غير متطابقتين.');
                return;
            }
        }
        onSave(formData as User, cleanEmail, cleanPassword);
    };

    const renderPermissionSet = (category: 'orders' | 'shipments' | 'clients' | 'storage', title: string, icon: React.ReactNode) => {
        const permissions = formData.permissions?.[category];
        if (!permissions) return null;
        const allChecked = Object.values(permissions).every(Boolean);
        const handleToggleAll = (checked: boolean) => {
             setFormData(prev => {
                if (!prev.permissions) return prev;
                const newPermissions = { ...prev.permissions! };
                const newCat = { ...newPermissions[category] };
                Object.keys(newCat).forEach(key => (newCat as any)[key] = checked);
                newPermissions[category] = newCat as any;
                return { ...prev, permissions: newPermissions };
            });
        }
        return (
            <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl border dark:border-gray-700">
                <h5 className="font-bold mb-3 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    {icon} {title}
                    <button onClick={() => handleToggleAll(!allChecked)} className="text-xs text-primary mr-auto hover:underline">
                        {allChecked ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                </h5>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    <PermissionCheckbox label="عرض" checked={permissions.view} onChange={(v) => handlePermissionChange(category, 'view', v)} />
                    <PermissionCheckbox label="إنشاء" checked={permissions.create} onChange={(v) => handlePermissionChange(category, 'create', v)} />
                    <PermissionCheckbox label="تعديل" checked={permissions.edit} onChange={(v) => handlePermissionChange(category, 'edit', v)} />
                    <PermissionCheckbox label="حذف" checked={permissions.delete} onChange={(v) => handlePermissionChange(category, 'delete', v)} highlight={true} />
                    {'changeStatus' in permissions && (
                        <PermissionCheckbox label="تغيير الحالة" checked={permissions.changeStatus} onChange={(v) => handlePermissionChange(category, 'changeStatus', v)} />
                    )}
                     {'revertStatus' in permissions && (
                        <PermissionCheckbox label="تراجع حالة" checked={permissions.revertStatus} onChange={(v) => handlePermissionChange(category, 'revertStatus', v)} highlight={true} />
                    )}
                </div>
            </div>
        )
    };

    const inputClass = "w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold">{isEditing ? `تعديل المستخدم: ${user.username}` : 'إضافة مستخدم جديد'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0 flex flex-col items-center">
                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-md flex items-center justify-center relative group">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon size={48} className="text-gray-400" />
                                )}
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                    <Upload size={24} className="text-white" />
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                </label>
                            </div>
                            <span className="text-xs text-gray-500 mt-2">اضغط لتغيير الصورة</span>
                        </div>
                        <div className="flex-grow space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">اسم المستخدم (للعرض)*</label>
                                    <input type="text" name="username" value={formData.username || ''} onChange={handleInputChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">الدور الوظيفي*</label>
                                    <select name="role" value={formData.role} onChange={handleRoleChange} className={inputClass}>
                                        <option value="employee">موظف (صلاحيات مخصصة)</option>
                                        <option value="viewer">مشاهد (للقراءة فقط)</option>
                                        <option value="admin">مدير النظام (صلاحيات كاملة)</option>
                                    </select>
                                </div>
                            </div>
                            {!isEditing && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800 space-y-3">
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                                        <Shield size={18}/> بيانات الدخول
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Mail size={14}/> البريد الإلكتروني*</label>
                                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="user@company.com" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Lock size={14}/> كلمة المرور*</label>
                                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="******" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 flex items-center gap-1"><Lock size={14}/> تأكيد كلمة المرور*</label>
                                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`${inputClass} ${confirmPassword && password !== confirmPassword ? 'border-red-500' : ''}`} placeholder="******" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {formData.role === 'admin' ? (
                        <div className="p-10 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed dark:border-gray-700">
                            <ShieldCheck size={48} className="mx-auto text-purple-500 mb-2"/>
                            <h4 className="text-lg font-bold text-gray-800 dark:text-white">صلاحيات المدير الكاملة</h4>
                            <p className="text-gray-500">يمتلك المدير حق الوصول لجميع خصائص النظام تلقائياً.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <hr className="flex-grow border-gray-200 dark:border-gray-700"/>
                                <span className="text-sm font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">تخصيص الصلاحيات</span>
                                <hr className="flex-grow border-gray-200 dark:border-gray-700"/>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3">1. الإدارة والمالية</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <PermissionCheckbox label="الوصول للتقارير المالية" checked={formData.permissions?.canViewFinance ?? false} onChange={(v) => handlePermissionChange('canViewFinance', '', v)} highlight={true}/>
                                    <PermissionCheckbox label="عرض سجل النظام" checked={formData.permissions?.canViewAuditLog ?? false} onChange={(v) => handlePermissionChange('canViewAuditLog', '', v)} />
                                    <PermissionCheckbox label="إدارة المستخدمين" checked={formData.permissions?.canManageUsers ?? false} onChange={(v) => handlePermissionChange('canManageUsers', '', v)} highlight={true}/>
                                    <PermissionCheckbox label="الدخول لصفحة الإعدادات" checked={formData.permissions?.canAccessSettings ?? false} onChange={(v) => handlePermissionChange('canAccessSettings', '', v)} />
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3">2. العمليات التشغيلية</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {renderPermissionSet('orders', 'الطلبات', <Package size={18} className="text-blue-500"/>)}
                                    {renderPermissionSet('shipments', 'الشحنات', <Truck size={18} className="text-orange-500"/>)}
                                    {renderPermissionSet('clients', 'العملاء', <Users size={18} className="text-purple-500"/>)}
                                    {renderPermissionSet('storage', 'المخزن', <Database size={18} className="text-cyan-500"/>)}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3">3. العمليات المالية</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl border dark:border-gray-700">
                                        <h5 className="font-bold mb-3 flex items-center gap-2">
                                            <PieChart size={18} className="text-green-500"/> السحب والتسليم
                                        </h5>
                                        <div className="flex gap-4">
                                            <PermissionCheckbox label="عرض الصفحة" checked={formData.permissions?.delivery.view ?? false} onChange={(v) => handlePermissionChange('delivery', 'view', v)} />
                                            <PermissionCheckbox label="معالجة وتسليم" checked={formData.permissions?.delivery.process ?? false} onChange={(v) => handlePermissionChange('delivery', 'process', v)} highlight={true} />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl border dark:border-gray-700">
                                        <h5 className="font-bold mb-3 flex items-center gap-2">
                                            <ScrollText size={18} className="text-indigo-500"/> الفوترة
                                        </h5>
                                        <div className="flex gap-4">
                                            <PermissionCheckbox label="عرض الصفحة" checked={formData.permissions?.billing.view ?? false} onChange={(v) => handlePermissionChange('billing', 'view', v)} />
                                            <PermissionCheckbox label="طباعة فواتير" checked={formData.permissions?.billing.print ?? false} onChange={(v) => handlePermissionChange('billing', 'print', v)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {formData.permissions?.canAccessSettings && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                        <Settings size={18} /> 4. تفاصيل الإعدادات
                                    </h4>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border dark:border-gray-700 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                        <PermissionCheckbox label="تعديل الشركة" checked={formData.permissions?.settings.canEditCompany ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditCompany', v)} />
                                        <PermissionCheckbox label="تعديل النظام" checked={formData.permissions?.settings.canEditSystem ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditSystem', v)} highlight={true}/>
                                        <PermissionCheckbox label="تعديل المتاجر" checked={formData.permissions?.settings.canEditStores ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditStores', v)} />
                                        <PermissionCheckbox label="تعديل الشحن" checked={formData.permissions?.settings.canEditShipping ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditShipping', v)} />
                                        <PermissionCheckbox label="تعديل العملات" checked={formData.permissions?.settings.canEditCurrencies ?? false} onChange={(v) => handlePermissionChange('settings', 'canEditCurrencies', v)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-6 pt-0 flex justify-end flex-shrink-0">
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-8 py-3 bg-primary dark:bg-secondary text-white rounded-xl shadow-lg hover:bg-primary-dark dark:hover:bg-secondary-dark disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-bold text-lg">
                        {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20} />} {isSaving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserFormModal;

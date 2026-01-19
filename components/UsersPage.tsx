
import React, { useState, useContext, useMemo } from 'react';
import type { User, GlobalActivityLog } from '../types';
import { supabase, getErrorMessage } from '../supabaseClient';
import { PlusCircle, Search, Trash2, User as UserIcon, ShieldCheck, ScrollText, X, Mail, AlertTriangle, Key, Loader2, Database, Copy, Check, Info, UserPlus, Filter, Calendar, Zap } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import UserFormModal from './UserFormModal';
import { useToast } from '../contexts/ToastContext';
import DatabaseSetupModal from './DatabaseSetupModal';
import HelpIcon from './HelpIcon';
import { HELP_CONTENT } from '../utils/helpContent';

// --- PasswordModal ---
const PasswordModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => Promise<void>;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
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
            setError(err.message || 'كلمة المرور غير صحيحة');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70]" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle size={20} /> {title}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور للتأكيد"
                        className="w-full p-2 border rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border-gray-300 dark:border-gray-600 mb-2 focus:ring-2 focus:ring-red-500 outline-none"
                        autoFocus
                    />
                    {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg">إلغاء</button>
                        <button type="submit" disabled={!password || loading} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold shadow-md">
                            {loading ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                            حذف نهائي
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- UserHistoryModal ---
const UserHistoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    logs: GlobalActivityLog[];
    username: string;
}> = ({ isOpen, onClose, logs, username }) => {
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterAction, setFilterAction] = useState('');

    if (!isOpen) return null;

    const uniqueActions = [...new Set(logs.map(log => log.action))];

    const filteredLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp).setHours(0,0,0,0);
        const startDate = filterDateStart ? new Date(filterDateStart).setHours(0,0,0,0) : null;
        const endDate = filterDateEnd ? new Date(filterDateEnd).setHours(0,0,0,0) : null;

        const dateMatch = (!startDate || logDate >= startDate) && (!endDate || logDate <= endDate);
        const actionMatch = !filterAction || log.action === filterAction;

        return dateMatch && actionMatch;
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-2"><ScrollText /> سجل نشاط: {username}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mx-6 mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-md px-2 py-1">
                        <Calendar size={14} className="text-gray-500"/>
                        <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0" placeholder="من"/>
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-md px-2 py-1">
                        <Calendar size={14} className="text-gray-500"/>
                        <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0" placeholder="إلى"/>
                    </div>
                    <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border dark:border-gray-600 rounded-md px-2 py-1">
                        <Filter size={14} className="text-gray-500"/>
                        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0 w-32">
                            <option value="">كل العمليات</option>
                            {uniqueActions.map(action => <option key={action} value={action}>{action}</option>)}
                        </select>
                    </div>
                    {(filterDateStart || filterDateEnd || filterAction) && (
                        <button onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterAction(''); }} className="text-xs text-red-500 hover:underline">مسح التصفية</button>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto px-6 custom-scrollbar">
                    {filteredLogs.length > 0 ? (
                         <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0 shadow-sm">
                                <tr>
                                    <th className="px-4 py-2 text-right">التاريخ</th>
                                    <th className="px-4 py-2 text-right">الإجراء</th>
                                    <th className="px-4 py-2 text-right">التفاصيل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                        <td className="px-4 py-2 whitespace-nowrap text-right" dir="ltr">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-primary">{log.action}</td>
                                        <td className="px-4 py-2 text-right">{log.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    ) : (
                        <p className="text-center text-gray-500 py-8">لا يوجد سجل نشاط مطابق.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SecurityModal ---
const SecurityModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    targetUser: User | null;
    currentUser: User | null;
    onShowDbAlert: () => void;
}> = ({ isOpen, onClose, targetUser, currentUser, onShowDbAlert }) => {
    const { showToast } = useToast();
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [activationLoading, setActivationLoading] = useState(false);

    if (!isOpen || !targetUser) return null;

    const isSelf = currentUser?.id === targetUser.id;

    // --- 1. Password Reset ---
    const handleAdminDirectUpdate = async () => {
        if (!newPassword || newPassword.length < 6) {
            showToast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", 'warning');
            return;
        }
        
        setLoading(true);
        try {
            const { error } = await (supabase! as any).rpc('admin_reset_password', { 
                target_user_id: targetUser.id, 
                new_password: newPassword 
            });
            
            if (error) throw error;
            
            showToast(`تم تغيير كلمة مرور المستخدم ${targetUser.username} بنجاح`, 'success');
            setNewPassword('');
            onClose();
        } catch (e: any) {
             console.error(e);
             if (e.message?.includes('function not found') || e.code === '42883' || e.code === 'PGRST202') {
                 onShowDbAlert();
             } else {
                 showToast("فشل تغيير كلمة المرور: " + getErrorMessage(e), 'error');
             }
        } finally {
            setLoading(false);
        }
    };

    const handleSelfUpdate = async () => {
        setLoading(true);
        try {
            const { error } = await supabase!.auth.updateUser({ password: newPassword });
            if (error) throw error;
            showToast('تم تحديث كلمة المرور بنجاح.', 'success');
            onClose();
        } catch (e: any) {
             showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // --- 2. Manual Activation (Fix for "Email not confirmed") ---
    const handleActivateAccount = async () => {
        setActivationLoading(true);
        try {
            const { error } = await supabase!.rpc('admin_confirm_user_email', { target_user_id: targetUser.id });
            
            if (error) throw error;
            
            showToast(`تم تفعيل حساب ${targetUser.username} بنجاح! يمكنه تسجيل الدخول الآن.`, 'success');
        } catch (e: any) {
             console.error(e);
             if (e.message?.includes('function not found') || e.code === '42883' || e.code === 'PGRST202') {
                 onShowDbAlert();
             } else {
                 showToast("فشل التفعيل: " + getErrorMessage(e), 'error');
             }
        } finally {
            setActivationLoading(false);
        }
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-2 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                        <Key className="text-primary" /> إدارة الأمان والحساب
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <div className="mb-4 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">المستخدم المستهدف:</p>
                    <p className="text-lg font-bold text-primary dark:text-primary-dark">{targetUser.username}</p>
                </div>

                <div className="space-y-6 flex-grow overflow-y-auto px-1">
                    {/* Activation Section (Only for Admins viewing other users) */}
                    {!isSelf && (
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                            <h4 className="font-bold text-sm text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                                <Zap size={16}/> حالة الحساب
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                                إذا كان المستخدم يواجه مشكلة "البريد غير مفعل" عند الدخول، اضغط هنا لتفعيله فوراً.
                            </p>
                            <button 
                                onClick={handleActivateAccount} 
                                disabled={activationLoading}
                                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {activationLoading ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>}
                                تفعيل الحساب يدوياً
                            </button>
                        </div>
                    )}

                    {/* Password Section */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                        <h4 className="font-bold text-sm mb-3">تغيير كلمة المرور</h4>
                        <input 
                            type="text" 
                            placeholder="أدخل كلمة المرور الجديدة" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none text-sm font-mono mb-3"
                        />
                        <button 
                            onClick={isSelf ? handleSelfUpdate : handleAdminDirectUpdate} 
                            disabled={!newPassword || loading}
                            className="w-full py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:bg-gray-400 font-bold shadow-md flex justify-center items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18}/>}
                            حفظ كلمة المرور
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const UserCard: React.FC<{ 
    user: User;
    onEdit: (user: User) => void;
    onDelete: (userId: string) => void;
    onViewLogs: (user: User) => void;
    onSecurity: (user: User) => void;
}> = ({ user, onEdit, onDelete, onViewLogs, onSecurity }) => {
    const { currentUser } = useContext(AuthContext);

    const roleColor = {
        admin: 'bg-gradient-to-br from-purple-500 to-indigo-600',
        employee: 'bg-gradient-to-br from-blue-400 to-blue-600',
        viewer: 'bg-gradient-to-br from-gray-400 to-gray-600',
    }[user.role] || 'bg-gray-400';

    const roleLabel = {
        admin: { label: 'مدير النظام', class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
        employee: { label: 'موظف', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
        viewer: { label: 'مشاهد', class: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' }
    }[user.role] || { label: 'غير معروف', class: 'bg-gray-100' };

    return (
        <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-lg p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-gray-100 dark:border-gray-800 relative group">
            <div className="absolute top-3 right-3 z-10">
                <HelpIcon content={HELP_CONTENT.user_roles} />
            </div>

            <div>
                <div className="flex items-center gap-4 mb-4">
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md overflow-hidden ${!user.avatar ? roleColor : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon size={32} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-text-light dark:text-text-dark truncate" title={user.username}>{user.username}</h3>
                        {user.email && <p className="text-xs text-gray-500 truncate mb-1" title={user.email}>{user.email}</p>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${roleLabel.class}`}>
                            {roleLabel.label}
                        </span>
                    </div>
                </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end items-center border-t border-gray-200 dark:border-gray-700 pt-3 gap-2">
                <button onClick={() => onSecurity(user)} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/40 transition-colors relative" title="إدارة الأمان والتفعيل">
                    <Key size={18} />
                    <HelpIcon content={HELP_CONTENT.user_security} className="absolute -top-1 -right-1" />
                </button>
                <button onClick={() => onViewLogs(user)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors" title="سجل النشاط">
                    <ScrollText size={18} />
                </button>
                <button onClick={() => onEdit(user)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors" title="تعديل المستخدم">
                     <ShieldCheck size={18} />
                </button>
                {currentUser?.id !== user.id && (
                    <button onClick={() => onDelete(user.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors" title="حذف المستخدم">
                        <Trash2 size={18}/>
                    </button>
                )}
            </div>
        </div>
    );
};

// --- UsersPageProps interface definition ---
interface UsersPageProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    logAction: (action: string, entityType: GlobalActivityLog['entityType'], entityId: string, details: string) => void;
    globalActivityLog: GlobalActivityLog[];
}

const UsersPage: React.FC<UsersPageProps> = ({ users, setUsers, logAction, globalActivityLog }) => {
    const { currentUser } = useContext(AuthContext);
    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [viewingLogsUser, setViewingLogsUser] = useState<User | null>(null);
    const [securityUser, setSecurityUser] = useState<User | null>(null);

    // Deletion State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    // DB Setup Modal
    const [isDbSetupOpen, setIsDbSetupOpen] = useState(false);

    const handleOpenModal = (user: User | null) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setEditingUser(null);
        setIsModalOpen(false);
    };

    const handleSaveUser = async (userData: User, email?: string, password?: string) => {
        if (!supabase) return;
        setIsSaving(true);

        try {
            const permissions = typeof userData.permissions === 'string' 
                ? JSON.parse(userData.permissions) 
                : userData.permissions;

            if (userData.id) {
                // UPDATE Existing User
                const { id, role, username, avatar } = userData;
                
                try {
                    await supabase.rpc('admin_confirm_user_email', { target_user_id: id });
                } catch (ignore) {}

                const { data, error } = await (supabase
                    .from('Users') as any)
                    .update({ permissions, role, username, avatar })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;

                setUsers(prev => prev.map(u => (u.id === id ? data : u)));
                logAction('Update User', 'User', id, `Updated user: ${username}`);
                showToast('تم تحديث بيانات المستخدم بنجاح', 'success');
                handleCloseModal();
                
            } else {
                // CREATE New User
                const cleanEmail = email?.trim();
                const cleanPassword = password?.trim();

                if (!cleanEmail || !cleanPassword) throw new Error("البيانات ناقصة.");

                const { data: exists, error: rpcError } = await supabase.rpc('admin_check_user_exists', { email_check: cleanEmail });
                
                if (rpcError) {
                    if (rpcError.code === '42883' || rpcError.code === 'PGRST202' || rpcError.message?.includes('function not found')) {
                         setIsDbSetupOpen(true);
                         throw new Error("يجب تحديث قاعدة البيانات أولاً. راجع نافذة إعداد قاعدة البيانات.");
                    }
                    throw new Error(`خطأ في التحقق من البريد: ${rpcError.message}`);
                }

                if (exists) {
                    throw new Error(`البريد الإلكتروني "${cleanEmail}" مسجل مسبقاً.`);
                }

                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: cleanEmail,
                    password: cleanPassword,
                    options: { data: { username: userData.username } }
                });

                if (authError) throw new Error(`فشل إنشاء حساب الدخول: ${authError.message}`);
                
                if (authData.user) {
                    const newUserId = authData.user.id;

                    const { error: confirmError } = await supabase.rpc('admin_confirm_user_email', { target_user_id: newUserId });
                    
                    if (confirmError) {
                        if (confirmError.code === '42883' || confirmError.code === 'PGRST202' || confirmError.message?.includes('function not found')) {
                             setIsDbSetupOpen(true);
                             throw new Error("تم إنشاء الحساب ولكن فشل تفعيله تلقائياً. يرجى تحديث قاعدة البيانات.");
                        }
                        console.warn("Auto-confirm warning:", confirmError);
                    }

                    const newProfile = { 
                        id: newUserId,
                        username: userData.username,
                        email: cleanEmail, 
                        role: userData.role,
                        permissions: permissions,
                        avatar: userData.avatar
                    };
                    
                    const { data, error } = await (supabase
                        .from('Users') as any)
                        .upsert(newProfile, { onConflict: 'id' })
                        .select()
                        .single();

                    if (error) throw error;

                    if (data) {
                        setUsers(prev => [...prev, data]);
                        logAction('Create User', 'User', newUserId, `Created new user: ${userData.username}`);
                        showToast("تم إنشاء الحساب وتفعيله بنجاح!", 'success');
                        handleCloseModal();
                    }
                } else {
                     throw new Error("حدث خطأ غير متوقع أثناء إنشاء المستخدم.");
                }
            }
        } catch (error: any) {
            console.error("Error saving user:", error);
            showToast("خطأ: " + getErrorMessage(error), 'error');
        } finally {
            setIsSaving(false);
        }
    };


    const handleDeleteUser = (userId: string) => {
        setUserToDelete(userId);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async (password: string) => {
        if (!userToDelete) return;

        let adminEmail = currentUser?.email;
        if (!adminEmail && supabase) {
            const { data } = await supabase.auth.getUser();
            adminEmail = data.user?.email;
        }

        if (!adminEmail) {
            throw new Error("تعذر العثور على بريد المدير الحالي لإعادة المصادقة.");
        }
        
        const { error: authError } = await supabase!.auth.signInWithPassword({
            email: adminEmail,
            password: password
        });

        if (authError) {
            throw new Error("كلمة المرور غير صحيحة.");
        }

        try {
            const { error } = await supabase!.rpc('admin_delete_user', { target_user_id: userToDelete });

            if (error) {
                if (error.code === '42883' || error.code === 'PGRST202' || error.message.includes('function not found')) {
                    setIsDbSetupOpen(true);
                    throw new Error("يجب تحديث قاعدة البيانات أولاً.");
                }
                throw error;
            }

            setUsers(prev => prev.filter(u => u.id !== userToDelete));
            logAction('Delete User', 'User', userToDelete, `Deleted user`);
            showToast('تم حذف المستخدم نهائياً بنجاح', 'success');
            
        } catch (error: any) {
            console.error("Delete error:", error);
            throw new Error('فشل حذف المستخدم: ' + getErrorMessage(error));
        }
    };

    const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));

    const userLogs = useMemo(() => {
        if (!viewingLogsUser) return [];
        return globalActivityLog.filter(log => log.user === viewingLogsUser.username);
    }, [viewingLogsUser, globalActivityLog]);

    const userToDeleteObj = users.find(u => u.id === userToDelete);

    return (
        <>
            <DatabaseSetupModal 
                isOpen={isDbSetupOpen} 
                onClose={() => setIsDbSetupOpen(false)} 
            />

            <PasswordModal
                isOpen={isDeleteModalOpen}
                onClose={() => { setIsDeleteModalOpen(false); setUserToDelete(null); }}
                onConfirm={handleConfirmDelete}
                title="تأكيد حذف المستخدم"
                message={`هل أنت متأكد من رغبتك في حذف المستخدم "${userToDeleteObj?.username}"؟ سيؤدي هذا الإجراء إلى حذف الحساب نهائياً.`}
            />

            <UserFormModal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal}
                onSave={handleSaveUser}
                user={editingUser}
                isSaving={isSaving}
            />
            
            <UserHistoryModal 
                isOpen={!!viewingLogsUser}
                onClose={() => setViewingLogsUser(null)}
                logs={userLogs}
                username={viewingLogsUser?.username || ''}
            />

            <SecurityModal
                isOpen={!!securityUser}
                onClose={() => setSecurityUser(null)}
                targetUser={securityUser}
                currentUser={currentUser}
                onShowDbAlert={() => setIsDbSetupOpen(true)}
            />

            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-3xl font-bold text-text-light dark:text-text-dark">إدارة المستخدمين والصلاحيات</h2>
                    
                    <div className="flex gap-2">
                        {currentUser?.role === 'admin' && (
                            <button onClick={() => setIsDbSetupOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" title="إصلاح مشاكل قاعدة البيانات">
                                <Database size={18} /> <span className="hidden md:inline">إعداد قاعدة البيانات</span>
                            </button>
                        )}
                        <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-secondary text-white rounded-lg shadow-md hover:bg-primary-dark dark:hover:bg-secondary-dark transition-colors transform hover:scale-105">
                            <PlusCircle size={20} />
                            <span>مستخدم جديد</span>
                        </button>
                    </div>
                </div>
                 <div className="p-3 bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 rounded-r-lg text-blue-800 dark:text-blue-200 text-sm flex items-center gap-2">
                    <Mail size={18} className="flex-shrink-0" />
                    <span><strong>معلومة:</strong> لإنشاء حساب مباشر، قم بإدخال البريد الإلكتروني وكلمة المرور وتزويدهما للموظف.</span>
                </div>

                <div className="relative flex-grow w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="ابحث عن مستخدم..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-80 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-content-light dark:bg-content-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-light"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredUsers.map(user => (
                        <UserCard 
                            key={user.id}
                            user={user}
                            onEdit={handleOpenModal}
                            onDelete={handleDeleteUser}
                            onViewLogs={setViewingLogsUser}
                            onSecurity={setSecurityUser}
                        />
                    ))}
                </div>
            </div>
        </>
    )
}

export default UsersPage;

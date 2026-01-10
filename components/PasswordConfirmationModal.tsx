
import React, { useState } from 'react';
import { X, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

interface PasswordConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string, reason?: string) => Promise<void>;
    title: string;
    message: string;
    requireReason?: boolean;
    confirmButtonText?: string;
    confirmButtonColor?: string;
    verificationMode?: 'online' | 'offline_code'; // New prop
}

const PasswordConfirmationModal: React.FC<PasswordConfirmationModalProps> = ({ 
    isOpen, onClose, onConfirm, title, message, requireReason = false, 
    confirmButtonText = 'تأكيد', confirmButtonColor = 'bg-red-600',
    verificationMode = 'online'
}) => {
    const { currentUser } = useContext(AuthContext);
    const [password, setPassword] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (requireReason && !reason.trim()) {
            setError('يرجى ذكر السبب للمتابعة.');
            return;
        }

        setLoading(true);
        
        try {
            // Verify Password based on mode
            if (verificationMode === 'online') {
                const { error: authError } = await supabase.auth.signInWithPassword({
                    email: currentUser?.email || '',
                    password: password
                });

                if (authError) {
                    throw new Error('كلمة المرور غير صحيحة.');
                }
            }
            // If offline_code, validation happens inside onConfirm via the parent

            await onConfirm(password, reason);
            onClose();
            setPassword('');
            setReason('');
        } catch (err: any) {
            setError(err.message || 'حدث خطأ ما.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[80]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                        <AlertTriangle size={20} className="text-orange-500"/> {title}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{message}</p>
                
                <form onSubmit={handleSubmit} className="space-y-3">
                    {requireReason && (
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">السبب*</label>
                            <textarea 
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none text-sm"
                                rows={2}
                                placeholder="اكتب سبب الإلغاء..."
                            ></textarea>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                            {verificationMode === 'offline_code' ? 'كود المستخدم (رمز الوصول)*' : 'كلمة المرور*'}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={verificationMode === 'offline_code' ? 'أدخل كود المستخدم' : 'أدخل كلمة المرور للتأكيد'}
                            className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none"
                            autoFocus
                        />
                    </div>

                    {error && <p className="text-red-500 text-xs font-bold">{error}</p>}

                    <div className="flex justify-end gap-2 mt-4 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg font-medium">إلغاء</button>
                        <button type="submit" disabled={!password || loading} className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-bold shadow-md ${confirmButtonColor}`}>
                            {loading ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}
                            {confirmButtonText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordConfirmationModal;

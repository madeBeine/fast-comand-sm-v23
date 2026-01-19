
import React from 'react';
import { X, MessageCircle, Globe, Send } from 'lucide-react';

export type NotificationLanguage = 'ar' | 'en' | 'fr';

interface NotificationLanguageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (lang: NotificationLanguage) => void;
}

const NotificationLanguageModal: React.FC<NotificationLanguageModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    const languages: { code: NotificationLanguage; name: string; native: string; flag: string }[] = [
        { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇦🇪' },
        { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
        { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[110]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                        <MessageCircle size={20} className="text-green-500"/> إرسال إشعار جاهزية
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400"/>
                    </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">اختر لغة الرسالة:</p>

                <div className="space-y-3">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => onConfirm(lang.code)}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-200 dark:hover:border-green-800 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{lang.flag}</span>
                                <div className="text-right">
                                    <p className="font-bold text-gray-800 dark:text-white text-sm group-hover:text-green-700 dark:group-hover:text-green-400">{lang.native}</p>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{lang.name}</p>
                                </div>
                            </div>
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg text-gray-400 group-hover:text-green-500 shadow-sm">
                                <Send size={18} />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NotificationLanguageModal;

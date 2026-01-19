
import React from 'react';
import { X, Printer, Globe, MessageCircle } from 'lucide-react';

export type PrintLanguage = 'ar' | 'en' | 'fr';

interface PrintLanguageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (lang: PrintLanguage) => void;
    onShare?: (lang: PrintLanguage) => void;
}

const PrintLanguageModal: React.FC<PrintLanguageModalProps> = ({ isOpen, onClose, onConfirm, onShare }) => {
    if (!isOpen) return null;

    const languages: { code: PrintLanguage; name: string; native: string; flag: string }[] = [
        { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇦🇪' },
        { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
        { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[110]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                        <Globe size={20} className="text-primary"/> خيارات الفاتورة
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400"/>
                    </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">اختر اللغة للإجراء المطلوب:</p>

                <div className="space-y-3">
                    {languages.map((lang) => (
                        <div key={lang.code} className="flex gap-2">
                            {/* Main Button (Language Display) */}
                            <div className="flex-grow flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{lang.flag}</span>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-white text-sm">{lang.native}</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{lang.name}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Print Action */}
                            <button
                                onClick={() => onConfirm(lang.code)}
                                className="p-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors"
                                title="طباعة"
                            >
                                <Printer size={20} />
                            </button>

                            {/* Share Action */}
                            {onShare && (
                                <button
                                    onClick={() => onShare(lang.code)}
                                    className="p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/40 transition-colors"
                                    title="مشاركة واتساب"
                                >
                                    <MessageCircle size={20} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PrintLanguageModal;

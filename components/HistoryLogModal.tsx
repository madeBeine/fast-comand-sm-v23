
import React from 'react';
import type { ActivityLog } from '../types';
import { X, Clock, User, ArrowLeftCircle } from 'lucide-react';

interface HistoryLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: ActivityLog[] | undefined; 
    title: string;
}

const HistoryLogModal: React.FC<HistoryLogModalProps> = ({ isOpen, onClose, history, title }) => {
    if (!isOpen) return null;

    const safeHistory = Array.isArray(history) ? history : [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl p-6 w-full max-w-lg animate-in zoom-in-95 duration-200 border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-gray-800">
                    <h3 className="text-xl font-black flex items-center gap-2">
                        <Clock className="text-primary"/> {title}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X size={20} /></button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {safeHistory.length > 0 ? (
                        <div className="space-y-6 relative before:absolute before:right-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-gray-800">
                            {safeHistory.slice().reverse().map((log, index) => (
                                <div key={index} className="relative pr-8 animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                                    <div className="absolute right-0 top-1.5 w-4 h-4 rounded-full bg-white dark:bg-gray-900 border-4 border-primary z-10"></div>
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <p className="font-bold text-gray-800 dark:text-white leading-tight mb-2">{log.activity}</p>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400">
                                            <span className="flex items-center gap-1"><Clock size={12}/> {new Date(log.timestamp).toLocaleString('ar-EG')}</span>
                                            <span className="flex items-center gap-1"><User size={12}/> {log.user}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            <Clock size={48} className="mx-auto mb-3 opacity-10"/>
                            <p className="font-bold">لا يوجد سجل نشاط متاح لهذا الطلب</p>
                        </div>
                    )}
                </div>
                
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 transition-colors">إغلاق</button>
                </div>
            </div>
        </div>
    );
};

export default HistoryLogModal;

import React from 'react';
import type { ActivityLog } from '../types';
import { X } from 'lucide-react';

interface HistoryLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: ActivityLog[] | undefined; 
    title: string;
}

const HistoryLogModal: React.FC<HistoryLogModalProps> = ({ isOpen, onClose, history, title }) => {
    if (!isOpen) return null;

    const safeHistory = history || [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>
                <div className="max-h-96 overflow-y-auto pr-2">
                    {safeHistory.length > 0 ? (
                        <ul className="space-y-4 border-r-2 border-gray-200 dark:border-gray-700">
                            {safeHistory.slice().reverse().map((log, index) => (
                                <li key={index} className="flex items-start gap-4 mr-[-10px]">
                                    <div className="w-5 h-5 rounded-full bg-primary dark:bg-secondary ring-4 ring-content-light dark:ring-content-dark flex-shrink-0"></div>
                                    <div className="pb-4">
                                        <p className="font-semibold text-text-light dark:text-text-dark">{log.activity}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(log.timestamp).toLocaleString('en-US')} بواسطة {log.user}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-8">لا يوجد سجل لهذا العنصر.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryLogModal;
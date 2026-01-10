
import React, { useState } from 'react';
import type { GlobalActivityLog } from '../types';
import { ScrollText, X, Calendar, Filter } from 'lucide-react';

const UserHistoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    logs: GlobalActivityLog[];
    username: string;
}> = ({ isOpen, onClose, logs, username }) => {
    // Default to today's date
    const todayStr = new Date().toISOString().split('T')[0];
    const [filterDateStart, setFilterDateStart] = useState(todayStr);
    const [filterDateEnd, setFilterDateEnd] = useState(todayStr);
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

    const handleClearFilters = () => {
        // Resetting to empty to show full history
        setFilterDateStart(''); 
        setFilterDateEnd('');   
        setFilterAction('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-2xl p-6 w-full max-w-3xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-2"><ScrollText /> سجل نشاط: {username}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
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
                    <button onClick={handleClearFilters} className="text-xs text-red-500 hover:underline px-2">عرض الكل</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
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
                        <p className="text-center text-gray-500 py-8">لا يوجد سجل نشاط في التاريخ المحدد.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserHistoryModal;


import React, { useState, useMemo } from 'react';
import type { GlobalActivityLog } from '../types';
import { Search, Calendar, User, ListFilter, AlertCircle, ShieldCheck } from 'lucide-react';

interface AuditLogPageProps {
    log: GlobalActivityLog[];
}

const AuditLogPage: React.FC<AuditLogPageProps> = ({ log }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [dateFilter, setDateFilter] = useState(''); // Default to empty string to show all history
    const [actionFilter, setActionFilter] = useState('');

    const safeLog = useMemo(() => Array.isArray(log) ? log : [], [log]);

    const filteredLog = useMemo(() => {
        return safeLog.filter(entry => {
            if (!entry) return false;
            
            const lowerSearchTerm = searchTerm.toLowerCase();
            const matchesSearch = (entry.details || '').toLowerCase().includes(lowerSearchTerm) ||
                                  (entry.action || '').toLowerCase().includes(lowerSearchTerm) ||
                                  (entry.entityId || '').toLowerCase().includes(lowerSearchTerm) ||
                                  (entry.entityType || '').toLowerCase().includes(lowerSearchTerm);

            const matchesUser = userFilter ? entry.user === userFilter : true;
            const matchesAction = actionFilter ? entry.action === actionFilter : true;
            
            const matchesDate = dateFilter && entry.timestamp ? entry.timestamp.startsWith(dateFilter) : true;
            
            return matchesSearch && matchesUser && matchesDate && matchesAction;
        });
    }, [safeLog, searchTerm, userFilter, dateFilter, actionFilter]);

    const uniqueUsers = useMemo(() => {
        return [...new Set(safeLog.map(entry => entry.user).filter(user => typeof user === 'string' && user.trim() !== ''))];
    }, [safeLog]);

    const uniqueActions = useMemo(() => {
        return [...new Set(safeLog.map(entry => entry.action))].sort();
    }, [safeLog]);

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                <ShieldCheck className="text-primary"/> سجل تدقيق النظام
            </h2>
            <div className="bg-content-light dark:bg-content-dark p-4 rounded-xl shadow-lg border dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="بحث شامل (تفاصيل، معرف، نوع...)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </div>
                    <div className="relative">
                        <select
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                             className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark text-sm"
                        >
                            <option value="">كل المستخدمين</option>
                            {uniqueUsers.map(user => <option key={user} value={user}>{user}</option>)}
                        </select>
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </div>
                    <div className="relative">
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                             className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark text-sm"
                        >
                            <option value="">كل العمليات</option>
                            {uniqueActions.map(act => <option key={act} value={act}>{act}</option>)}
                        </select>
                        <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    </div>
                     <div className="relative flex items-center gap-2">
                        <div className="relative w-full">
                            <input 
                                type="date" 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary-light text-text-light dark:text-text-dark text-sm"
                            />
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        </div>
                        {dateFilter && (
                            <button 
                                onClick={() => setDateFilter('')}
                                className="text-xs text-red-500 whitespace-nowrap hover:underline font-bold"
                            >
                                عرض الكل
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-content-light dark:bg-content-dark rounded-xl shadow-lg overflow-hidden border dark:border-gray-700">
                <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-right w-32">التوقيت</th>
                                <th scope="col" className="px-6 py-3 text-right w-32">المستخدم</th>
                                <th scope="col" className="px-6 py-3 text-right w-24">العملية</th>
                                <th scope="col" className="px-6 py-3 text-right w-24">الكيان</th>
                                <th scope="col" className="px-6 py-3 text-right w-32">المعرف (ID)</th>
                                <th scope="col" className="px-6 py-3 text-right">تفاصيل العملية</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-600">
                            {filteredLog.map(entry => (
                                <tr key={entry.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-xs" dir="ltr">
                                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-GB') : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-300 text-right">{entry.user || 'System'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            entry.action.toLowerCase().includes('delete') ? 'bg-red-100 text-red-600' :
                                            entry.action.toLowerCase().includes('create') ? 'bg-green-100 text-green-600' :
                                            entry.action.toLowerCase().includes('update') ? 'bg-blue-100 text-blue-600' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-xs">{entry.entityType || '-'}</td>
                                    <td className="px-6 py-4 text-right font-mono text-[10px] text-gray-400 truncate max-w-[100px]" title={entry.entityId}>
                                        {(entry.entityId || '').substring(0, 8)}...
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-800 dark:text-gray-200 text-xs leading-relaxed">{entry.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredLog.length === 0 && (
                     <div className="text-center py-10 text-gray-500 bg-gray-50 dark:bg-gray-800/50">
                        <AlertCircle size={48} className="mx-auto mb-2 opacity-20"/>
                        <p className="font-bold">لا توجد سجلات تطابق معايير البحث.</p>
                        {dateFilter && <p className="text-xs mt-1">يتم عرض سجلات يوم {dateFilter} فقط.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogPage;

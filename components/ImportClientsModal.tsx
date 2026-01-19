
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface ImportClientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ImportClientsModal: React.FC<ImportClientsModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successCount, setSuccessCount] = useState(0);
    const [skippedCount, setSkippedCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                setPreviewData(data);
                setError(null);
                setSuccessCount(0);
                setSkippedCount(0);
            } catch (err) {
                setError('فشل في قراءة الملف. تأكد من أنه ملف Excel صالح.');
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
    };

    const processImport = async () => {
        if (previewData.length === 0) return;
        setIsUploading(true);
        setError(null);
        
        try {
            if (!supabase) throw new Error("Database client not found");

            // 1. Get all existing phone numbers for cross-reference
            const { data: existingClients } = await supabase.from('Clients').select('phone');
            const existingPhones = new Set((existingClients || []).map(c => c.phone.replace(/\s+/g, '')));

            // 2. Map and unique filter incoming data
            const incomingMap = new Map();
            
            previewData.forEach((row: any) => {
                const name = row['Name'] || row['name'] || row['الاسم'] || row['اسم العميل'] || row['Client Name'];
                const phoneRaw = row['Phone'] || row['phone'] || row['الهاتف'] || row['رقم الهاتف'] || row['Mobile'];
                
                if (!name || !phoneRaw) return;

                const phone = phoneRaw.toString().replace(/\s+/g, '').trim();
                const whatsapp = (row['WhatsApp'] || row['whatsapp'] || row['واتساب'] || row['رقم الواتساب'] || phone).toString().replace(/\s+/g, '').trim();
                const address = (row['Address'] || row['address'] || row['العنوان'] || row['السكن'])?.toString().trim();
                const genderRaw = row['Gender'] || row['gender'] || row['الجنس'];
                
                let gender = 'male';
                if (genderRaw) {
                    const g = genderRaw.toString().toLowerCase().trim();
                    if (g === 'female' || g === 'f' || g === 'أنثى' || g === 'انثى' || g === 'مؤنث') gender = 'female';
                }

                // Internal de-duplication: last one wins
                incomingMap.set(phone, {
                    name: name.toString().trim(),
                    phone,
                    whatsapp_number: whatsapp,
                    address,
                    gender
                });
            });

            // 3. Filter out those that already exist in DB
            const clientsToInsert: any[] = [];
            let skipped = 0;

            incomingMap.forEach((client, phone) => {
                if (existingPhones.has(phone)) {
                    skipped++;
                } else {
                    clientsToInsert.push(client);
                }
            });

            if (clientsToInsert.length === 0) {
                if (skipped > 0) {
                    throw new Error(`كافة العملاء في الملف (${skipped}) مسجلون مسبقاً في النظام. لم يتم استيراد أي جديد.`);
                }
                throw new Error("لم يتم العثور على بيانات صالحة.");
            }

            const { error: insertError } = await (supabase.from('Clients') as any).insert(clientsToInsert);
            if (insertError) throw insertError;

            setSuccessCount(clientsToInsert.length);
            setSkippedCount(skipped);
            
            setTimeout(() => {
                onSuccess();
                onClose();
                setPreviewData([]);
            }, 3000);

        } catch (err: any) {
            setError(err.message || "حدث خطأ أثناء الاستيراد.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[130] p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-gray-700">
                    <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800 dark:text-white">
                        <FileSpreadsheet className="text-green-500" size={28}/> استيراد ذكي للعملاء
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={24} /></button>
                </div>

                <div className="space-y-6 flex-grow overflow-y-auto custom-scrollbar">
                    {successCount > 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={48}/>
                            </div>
                            <h4 className="text-2xl font-black text-slate-800 dark:text-white mb-2">تم الاستيراد بنجاح!</h4>
                            <p className="text-slate-500 font-bold">تمت إضافة {successCount} عميل جديد.</p>
                            {skippedCount > 0 && <p className="text-amber-600 text-sm mt-2 font-bold">ملاحظة: تم تجاهل {skippedCount} عميل لأنهم مسجلون مسبقاً.</p>}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                    <h5 className="font-black text-blue-800 dark:text-blue-300 text-sm mb-2 flex items-center gap-2"><CheckCircle size={16}/> شروط البيانات:</h5>
                                    <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-2 font-bold">
                                        <li>• عمود "الاسم" أو "Name" إلزامي.</li>
                                        <li>• عمود "الهاتف" أو "Phone" إلزامي وفريد.</li>
                                        <li>• سيقوم النظام بمنع تكرار أي رقم مسجل مسبقاً.</li>
                                    </ul>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 text-center flex flex-col items-center justify-center">
                                    <Users className="text-indigo-600 mb-2" size={32}/>
                                    <p className="text-xs font-black text-indigo-800 dark:text-indigo-300 uppercase">دقة البيانات</p>
                                    <p className="text-[10px] text-indigo-500 mt-1">يتم تنظيف أرقام الهواتف من المسافات تلقائياً لضمان عدم التكرار.</p>
                                </div>
                            </div>

                            {!previewData.length ? (
                                <div 
                                    className="border-4 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] p-12 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all rounded-full flex items-center justify-center mb-4 shadow-inner">
                                        <Upload size={40} />
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 font-black text-lg">اختر ملف Excel أو CSV</p>
                                    <p className="text-slate-400 text-sm mt-1">اضغط هنا لرفع الملف وبدء المعالجة</p>
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                                </div>
                            ) : (
                                <div className="animate-in slide-in-from-bottom-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-slate-800 dark:text-white">معاينة البيانات ({previewData.length} صف)</h4>
                                        <button onClick={() => { setPreviewData([]); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">إلغاء واختيار ملف آخر</button>
                                    </div>
                                    <div className="border dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-right">
                                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-black uppercase">
                                                    <tr>
                                                        {Object.keys(previewData[0] || {}).slice(0, 5).map(key => (
                                                            <th key={key} className="p-3 border-b dark:border-gray-700 whitespace-nowrap">{key}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-gray-700">
                                                    {previewData.slice(0, 5).map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                            {Object.values(row).slice(0, 5).map((val: any, i) => (
                                                                <td key={i} className="p-3 font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{val}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {previewData.length > 5 && (
                                            <div className="p-3 text-center text-slate-400 text-[10px] font-bold bg-slate-50/50 dark:bg-slate-900/30 uppercase tracking-widest">
                                                ... ويوجد {previewData.length - 5} صفوف إضافية سيتم معالجتها
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-start gap-3 border border-red-100 dark:border-red-900 animate-in shake duration-500">
                                    <AlertCircle className="flex-shrink-0 mt-0.5" size={20} /> 
                                    <div>
                                        <p className="font-black text-sm">خطأ في الاستيراد:</p>
                                        <p className="text-xs mt-1 font-bold leading-relaxed">{error}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {!successCount && (
                    <div className="mt-8 pt-6 border-t dark:border-gray-700 flex gap-3">
                        <button onClick={onClose} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors">إغلاق</button>
                        {previewData.length > 0 && (
                            <button 
                                onClick={processImport} 
                                disabled={isUploading}
                                className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isUploading ? <Loader2 className="animate-spin" size={22}/> : <Upload size={22}/>}
                                بدء المعالجة والاستيراد
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportClientsModal;

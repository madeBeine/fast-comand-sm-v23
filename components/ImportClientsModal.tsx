import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
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
        setSuccessCount(0);

        try {
            if (!supabase) throw new Error("Database client not found");

            const clientsToInsert = previewData.map((row: any) => {
                const name = row['Name'] || row['name'] || row['الاسم'] || row['اسم العميل'] || row['Client Name'];
                const phone = row['Phone'] || row['phone'] || row['الهاتف'] || row['رقم الهاتف'] || row['Mobile'];
                const whatsapp = row['WhatsApp'] || row['whatsapp'] || row['واتساب'] || row['رقم الواتساب'] || phone; 
                const address = row['Address'] || row['address'] || row['العنوان'] || row['السكن'];
                const genderRaw = row['Gender'] || row['gender'] || row['الجنس'];
                
                let gender = 'male';
                if (genderRaw) {
                    const g = genderRaw.toString().toLowerCase().trim();
                    if (g === 'female' || g === 'f' || g === 'أنثى' || g === 'انثى' || g === 'مؤنث') {
                        gender = 'female';
                    }
                }

                if (!name || !phone) return null; 

                return {
                    name: name.toString().trim(),
                    phone: phone.toString().replace(/\s/g, '').trim(), 
                    whatsapp_number: whatsapp?.toString().replace(/\s/g, '').trim(),
                    address: address?.toString().trim(),
                    gender: gender
                };
            }).filter(item => item !== null);

            if (clientsToInsert.length === 0) {
                throw new Error("لم يتم العثور على بيانات صالحة. تأكد من وجود أعمدة 'الاسم' و 'الهاتف'.");
            }

            const { error: insertError } = await (supabase.from('Clients') as any).insert(clientsToInsert);

            if (insertError) throw insertError;

            setSuccessCount(clientsToInsert.length);
            setTimeout(() => {
                onSuccess();
                onClose();
                setPreviewData([]);
                setSuccessCount(0);
            }, 1500);

        } catch (err: any) {
            setError(err.message || "حدث خطأ أثناء الاستيراد.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[80]" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-green-600 dark:text-green-400">
                        <FileSpreadsheet /> استيراد عملاء من Excel
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                </div>

                <div className="space-y-4 flex-grow overflow-y-auto">
                    {successCount > 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-green-600">
                            <CheckCircle size={48} className="mb-2"/>
                            <p className="text-lg font-bold">تم استيراد {successCount} عميل بنجاح!</p>
                        </div>
                    ) : (
                        <>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                                <p className="font-bold mb-1">تعليمات الملف:</p>
                                <p>يجب أن يحتوي ملف Excel على الأعمدة التالية (بالعربية أو الإنجليزية):</p>
                                <ul className="list-disc list-inside mt-1 font-mono text-xs">
                                    <li>الاسم (Name) *مطلوب</li>
                                    <li>الهاتف (Phone) *مطلوب</li>
                                    <li>العنوان (Address)</li>
                                    <li>الجنس (Gender)</li>
                                </ul>
                            </div>

                            {!previewData.length && (
                                <div 
                                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={40} className="text-gray-400 mb-2" />
                                    <p className="text-gray-500 font-medium">اضغط لاختيار ملف (.xlsx, .csv)</p>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept=".xlsx, .xls, .csv" 
                                        onChange={handleFileChange}
                                    />
                                </div>
                            )}

                            {previewData.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-sm">معاينة البيانات ({previewData.length} صف)</h4>
                                        <button onClick={() => { setPreviewData([]); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-red-500 hover:underline">إلغاء واختيار ملف آخر</button>
                                    </div>
                                    <div className="border dark:border-gray-700 rounded-lg overflow-x-auto">
                                        <table className="w-full text-xs text-right">
                                            <thead className="bg-gray-100 dark:bg-gray-700 font-bold">
                                                <tr>
                                                    {Object.keys(previewData[0] || {}).slice(0, 5).map(key => (
                                                        <th key={key} className="p-2 border-b dark:border-gray-600">{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.slice(0, 5).map((row, idx) => (
                                                    <tr key={idx} className="border-b dark:border-gray-700">
                                                        {Object.values(row).slice(0, 5).map((val: any, i) => (
                                                            <td key={i} className="p-2 truncate max-w-[150px]">{val}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {previewData.length > 5 && (
                                            <div className="p-2 text-center text-gray-500 text-xs bg-gray-50 dark:bg-gray-800">
                                                ... والمزيد ({previewData.length - 5} صفوف)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg flex items-center gap-2 text-sm">
                                    <AlertCircle size={18} /> {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg">إلغاء</button>
                    {previewData.length > 0 && !successCount && (
                        <button 
                            onClick={processImport} 
                            disabled={isUploading}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50"
                        >
                            {isUploading ? <Loader2 className="animate-spin" size={18}/> : <Upload size={18}/>}
                            بدء الاستيراد
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportClientsModal;
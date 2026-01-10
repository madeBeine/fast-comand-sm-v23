
import React, { useRef, useState, useEffect, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { X, Share2, Printer, Loader2, Download, Truck, Save, ArrowRight, CheckCircle2, ChevronLeft, MapPin, Phone, DollarSign, User, AlertCircle } from 'lucide-react';
import type { Order, Client, Driver, CompanyInfo } from '../types';

interface DeliveryManifestModalProps {
    isOpen: boolean;
    onClose: () => void;
    driver: Driver;
    orders: Order[];
    clients: Client[];
    companyInfo: CompanyInfo;
    onConfirmDispatch: (prepaidClientIds: Set<string>, feeOverrides: Record<string, number>) => void; 
}

const DeliveryManifestModal: React.FC<DeliveryManifestModalProps> = ({ isOpen, onClose, driver, orders = [], clients, companyInfo, onConfirmDispatch }) => {
    const manifestRef = useRef<HTMLDivElement>(null);
    const [step, setStep] = useState<1 | 2>(1); // 1: Verify, 2: Preview
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Track which clients have "Delivery Fee Prepaid/Approved for Driver"
    const [prepaidClients, setPrepaidClients] = useState<Set<string>>(new Set());
    
    // Track Delivery Fee Overrides: Record<OrderId, NewFee>
    const [feeOverrides, setFeeOverrides] = useState<Record<string, number>>({});

    // Automatically check prepaid clients based on the incoming orders state
    useEffect(() => {
        if (isOpen) {
            setStep(1); // Reset to step 1
            const initialPrepaid = new Set<string>();
            const initialFees: Record<string, number> = {};
            
            orders.forEach(o => {
                if (o.isDeliveryFeePrepaid && o.clientId) {
                    initialPrepaid.add(o.clientId);
                }
                initialFees[o.id] = o.localDeliveryCost || 0;
            });
            setPrepaidClients(initialPrepaid);
            setFeeOverrides(initialFees);
        }
    }, [isOpen, orders]);

    const handleAction = async (action: 'share' | 'print' | 'download') => {
        if (!manifestRef.current) return;
        setIsGenerating(true);
        
        try {
            // Wait for layout stability
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(manifestRef.current, {
                scale: 2, // Good Quality
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: 1200, 
                allowTaint: true
            });
            
            const imageBase64 = canvas.toDataURL('image/png');

            if (action === 'print') {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(`
                        <html>
                            <head><title>Manifest - ${driver.name}</title></head>
                            <body style="margin:0; display:flex; justify-content:center; background:#eee;">
                                <img src="${imageBase64}" style="width:100%; max-width:210mm; background:white;" onload="window.print();"/>
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                }
            } else if (action === 'download') {
                const link = document.createElement('a');
                link.href = imageBase64;
                link.download = `Manifest-${driver.name}.png`;
                link.click();
            } else if (action === 'share') {
                const blob = await (await fetch(imageBase64)).blob();
                const file = new File([blob], `Manifest-${driver.name}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Delivery Manifest',
                        text: `Delivery Manifest for ${driver.name}`
                    });
                } else {
                    const link = document.createElement('a');
                    link.href = imageBase64;
                    link.download = `Manifest-${driver.name}.png`;
                    link.click();
                }
            }

        } catch (e) {
            console.error("Manifest generation failed", e);
            alert("حدث خطأ أثناء إنشاء المانيفست.");
        } finally {
            setIsGenerating(false);
        }
    };

    const togglePrepaid = (clientId: string) => {
        const newSet = new Set(prepaidClients);
        if (newSet.has(clientId)) newSet.delete(clientId);
        else newSet.add(clientId);
        setPrepaidClients(newSet);
    };

    const handleFeeChange = (orderId: string, newFee: number) => {
        setFeeOverrides(prev => ({ ...prev, [orderId]: newFee }));
    };

    const clientGroups = useMemo(() => {
        const groups: Record<string, { client: Client | undefined, orders: Order[], totalDue: number, deliveryFees: number }> = {};
        
        orders.forEach(order => {
            const clientId = order.clientId || 'unknown';
            if (!groups[clientId]) {
                groups[clientId] = { 
                    client: clients.find(c => c.id === clientId),
                    orders: [],
                    totalDue: 0,
                    deliveryFees: 0
                };
            }
            
            // Calculate Base Debt (Product + Commission + Shipping - Paid)
            const prod = (Number(order.priceInMRU) || 0) + (Number(order.commission) || 0);
            const ship = (Number(order.shippingCost) || 0);
            const paid = (Number(order.amountPaid) || 0);
            
            // Current override fee
            const currentDeliveryFee = feeOverrides[order.id] !== undefined ? feeOverrides[order.id] : (Number(order.localDeliveryCost) || 0);

            // Base debt
            const baseDebt = Math.max(0, prod + ship - paid);
            
            // Determine what the driver collects
            let driverCollects = baseDebt;

            // If NOT prepaid, the driver must ALSO collect the delivery fee from the client
            if (!prepaidClients.has(clientId)) {
                driverCollects += currentDeliveryFee;
            }

            groups[clientId].orders.push(order);
            groups[clientId].totalDue += driverCollects;
            groups[clientId].deliveryFees += currentDeliveryFee;
        });

        return Object.values(groups);
    }, [orders, clients, prepaidClients, feeOverrides]);

    const totalManifestValue = clientGroups.reduce((sum, g) => sum + g.totalDue, 0);

    if (!isOpen) return null;

    // Explicit Styles for HTML2Canvas
    const containerStyle: React.CSSProperties = {
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '40px',
        width: '800px', // Fixed width for A4-like ratio
        minHeight: '1000px',
        fontFamily: 'Cairo, sans-serif',
        direction: 'rtl',
        position: 'relative'
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: '3px solid #000',
        paddingBottom: '20px',
        marginBottom: '20px',
        color: '#000'
    };

    const tableHeaderStyle: React.CSSProperties = {
        backgroundColor: '#f0f0f0',
        borderBottom: '2px solid #000',
        color: '#000',
        fontWeight: 'bold',
        padding: '8px',
        textAlign: 'right',
        fontSize: '14px'
    };

    const cellStyle: React.CSSProperties = {
        borderBottom: '1px solid #ddd',
        padding: '12px 8px',
        color: '#000',
        fontSize: '14px',
        verticalAlign: 'top'
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[130] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" style={{ maxHeight: '90dvh' }} onClick={e => e.stopPropagation()}>
                
                {/* Header UI (App) */}
                <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-black/20 flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <Truck className="text-primary"/> 
                            {step === 1 ? '1. مراجعة بيانات التسليم' : '2. معاينة المانيفست'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"><X size={24}/></button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-white dark:bg-gray-900">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-sm">
                                <p className="font-bold text-blue-800 dark:text-blue-200 mb-1 flex items-center gap-2"><AlertCircle size={16}/> تعليمات المراجعة:</p>
                                <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-1">
                                    <li>قم بتعديل "سعر التوصيل" لكل طلب إذا لزم الأمر (السعر الافتراضي للسائق).</li>
                                    <li>إذا كان العميل قد دفع التوصيل مسبقاً، قم بتفعيل خيار "التوصيل مدفوع".</li>
                                    <li>المبلغ "المطلوب تحصيله" سيتم تحديثه تلقائياً بناءً على خياراتك.</li>
                                </ul>
                            </div>

                            <div className="space-y-4">
                                {clientGroups.map((group, idx) => {
                                    if (!group.client) return null;
                                    const isPrepaid = prepaidClients.has(group.client.id);
                                    
                                    return (
                                        <div key={group.client.id} className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
                                            {/* Client Header */}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center font-bold">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 dark:text-white">{group.client.name}</h4>
                                                        <p className="text-xs text-gray-500">{group.client.phone}</p>
                                                    </div>
                                                </div>
                                                
                                                <div 
                                                    className={`cursor-pointer px-4 py-2 rounded-xl border-2 transition-all flex items-center gap-2 select-none ${isPrepaid ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-500'}`}
                                                    onClick={() => togglePrepaid(group.client!.id)}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isPrepaid ? 'border-green-500 bg-green-500 text-white' : 'border-gray-400'}`}>
                                                        {isPrepaid && <CheckCircle2 size={14} strokeWidth={3}/>}
                                                    </div>
                                                    <span className="font-bold text-sm">التوصيل مدفوع (خالص)</span>
                                                </div>
                                            </div>

                                            {/* Orders List */}
                                            <div className="divide-y dark:divide-gray-700">
                                                {group.orders.map(order => {
                                                    const fee = feeOverrides[order.id] !== undefined ? feeOverrides[order.id] : (order.localDeliveryCost || 0);
                                                    return (
                                                        <div key={order.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                                            <div className="flex items-center gap-3 w-full md:w-auto">
                                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded text-sm font-mono font-bold">#{order.localOrderId}</span>
                                                                <span className="text-xs text-gray-500">وزن: {order.weight}kg</span>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                                                <div className="flex items-center gap-2">
                                                                    <label className="text-xs font-bold text-gray-500">سعر التوصيل:</label>
                                                                    <input 
                                                                        type="number" 
                                                                        className="w-20 p-2 text-center border rounded-lg dark:bg-gray-900 dark:border-gray-600 font-bold"
                                                                        value={fee}
                                                                        onChange={(e) => handleFeeChange(order.id, parseFloat(e.target.value) || 0)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Summary Footer */}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t dark:border-gray-700 flex justify-end">
                                                <div className="text-left">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">المطلوب تحصيله من هذا العميل</p>
                                                    <p className="text-xl font-black text-green-600 dark:text-green-400 font-mono">
                                                        {group.totalDue.toLocaleString()} <span className="text-sm text-gray-400">MRU</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center bg-gray-100 dark:bg-black/50 p-4 rounded-xl overflow-auto">
                            {/* Hidden Manifest for Generation */}
                            <div ref={manifestRef} style={containerStyle}>
                                <div style={headerStyle}>
                                    <div style={{ textAlign: 'right' }}>
                                        <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0 }}>{companyInfo.name}</h1>
                                        <p style={{ margin: '5px 0 0', fontSize: '14px' }}>مانيفست تسليم / Delivery Manifest</p>
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{driver.name}</h2>
                                        <p style={{ margin: '5px 0 0', fontSize: '14px', fontFamily: 'monospace' }}>{new Date().toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...tableHeaderStyle, width: '5%' }}>#</th>
                                            <th style={{ ...tableHeaderStyle, width: '20%' }}>العميل / Client</th>
                                            <th style={{ ...tableHeaderStyle, width: '15%' }}>الهاتف / Phone</th>
                                            <th style={{ ...tableHeaderStyle, width: '25%' }}>العنوان / Address</th>
                                            <th style={{ ...tableHeaderStyle, width: '15%' }}>الطلبات / Orders</th>
                                            <th style={{ ...tableHeaderStyle, width: '20%' }}>التحصيل / Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientGroups.map((group, idx) => (
                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                                <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                                                <td style={cellStyle}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{group.client?.name}</div>
                                                </td>
                                                <td style={cellStyle}>
                                                    <div style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{group.client?.phone}</div>
                                                </td>
                                                <td style={cellStyle}>
                                                    <div style={{ fontSize: '12px' }}>{group.client?.address || '---'}</div>
                                                </td>
                                                <td style={cellStyle}>
                                                    <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                                                        {group.orders.map(o => (
                                                            <div key={o.id}>
                                                                <strong>#{o.localOrderId}</strong> ({o.weight}kg)
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={cellStyle}>
                                                    <div style={{ fontWeight: '900', fontSize: '16px', textAlign: 'left' }}>
                                                        {group.totalDue.toLocaleString()}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #000' }}>
                                    <div style={{ textAlign: 'center', minWidth: '200px' }}>
                                        <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Total To Collect</p>
                                        <p style={{ fontSize: '32px', fontWeight: '900', margin: '5px 0' }}>{totalManifestValue.toLocaleString()} <span style={{ fontSize: '14px' }}>MRU</span></p>
                                    </div>
                                </div>

                                <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '10px', textAlign: 'center' }}>
                                        توقيع المستلم (المسؤول)
                                    </div>
                                    <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '10px', textAlign: 'center' }}>
                                        توقيع السائق ({driver.name})
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-800 bg-gray-50 dark:bg-black/20 flex justify-between gap-3 flex-shrink-0">
                    {step === 1 ? (
                        <>
                            <div className="flex-grow">
                                <p className="text-xs font-bold text-gray-500 uppercase">الإجمالي المتوقع تحصيله</p>
                                <p className="text-2xl font-black text-primary font-mono">{totalManifestValue.toLocaleString()} <span className="text-sm">MRU</span></p>
                            </div>
                            <button onClick={() => setStep(2)} className="px-8 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark flex items-center gap-2 transition-all">
                                التالي: معاينة المانيفست <ArrowRight size={18}/>
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setStep(1)} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center gap-2">
                                <ChevronLeft size={18}/> رجوع للتعديل
                            </button>
                            
                            <div className="flex gap-2">
                                <button onClick={() => handleAction('print')} disabled={isGenerating} className="p-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors" title="طباعة">
                                    {isGenerating ? <Loader2 className="animate-spin"/> : <Printer size={20}/>}
                                </button>
                                <button onClick={() => handleAction('share')} disabled={isGenerating} className="p-3 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors" title="مشاركة">
                                    {isGenerating ? <Loader2 className="animate-spin"/> : <Share2 size={20}/>}
                                </button>
                                <button onClick={() => onConfirmDispatch(prepaidClients, feeOverrides)} className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700 flex items-center gap-2 transition-all">
                                    <Save size={18}/> اعتماد وانطلاق
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeliveryManifestModal;

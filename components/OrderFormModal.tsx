
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Order, Client, Store, Currency, AppSettings, PaymentMethod, ShippingCompany } from '../types';
import { ShippingType, OrderStatus, TransportMode } from '../types';
import { Save, X, Plus, Trash2, UploadCloud, Loader2, Link, Ship, Plane, Truck, DollarSign, Image as ImageIcon, User, ShoppingBag, CheckCircle2, Calculator, Receipt, ChevronDown, Upload, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabaseClient';
import { useNetwork } from '../contexts/NetworkContext';

export interface OrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (order: Order) => Promise<void>;
    order: Order | null;
    clients: Client[];
    stores: Store[];
    currencies: Currency[];
    commissionRate: number;
    isSaving?: boolean;
    orders?: Order[];
    settings?: AppSettings;
    shippingCompanies?: ShippingCompany[];
    paymentMethods?: PaymentMethod[];
    onClientSearch?: (term: string) => void;
}

// --- Helper Functions ---
const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[^\w\s\u0600-\u06FF]/g, '') // Keep alphanumeric and Arabic
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizePhone = (text: string): string => text.replace(/[^0-9]/g, '');

// --- Helper Component: Searchable Select ---
interface SearchableSelectProps<T> {
    options: T[];
    value: string;
    placeholder: string;
    onChange: (value: string, item?: T) => void; // Updated to pass item
    getDisplayValue: (value: string) => string;
    renderOption: (option: T) => React.ReactNode;
    filterFunction: (option: T, searchTerm: string) => boolean;
    valueField: keyof T;
    error?: string;
    icon?: React.ReactNode;
    onSearch?: (term: string) => void;
}

function SearchableSelect<T extends { id: string }>({ options, value, placeholder, onChange, getDisplayValue, renderOption, filterFunction, valueField, error, icon, onSearch }: SearchableSelectProps<T>) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        if (!isOpen) setIsOpen(true);

        if (onSearch) {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(() => {
                onSearch(val);
            }, 300); // Reduced delay for snappier feel
        }
    };

    // PERFORMANCE OPTIMIZATION: Limit results to 50 items to prevent UI lag with large lists
    const filteredOptions = useMemo(() => {
        const limit = 50;
        
        // If no search term, return top 20 immediately
        if (!searchTerm) {
            return options.slice(0, 20);
        }

        const results: T[] = [];
        // Use a loop to break early once limit is reached (faster than .filter on large arrays)
        for (const option of options) {
            if (filterFunction(option, searchTerm)) {
                results.push(option);
                if (results.length >= limit) break;
            }
        }
        return results;
    }, [options, searchTerm, filterFunction]);

    const selectOption = (option: T) => {
        onChange(option[valueField] as string, option);
        setIsOpen(false);
        setSearchTerm('');
        // We do NOT immediately reset the search here to prevent the list from refreshing 
        // and removing the selected item before the parent can cache it.
        // The parent or the next focus event will handle resets if needed.
    };
    
    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-colors group-focus-within:text-primary">
                    {icon || <Search size={16} />}
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? searchTerm : (value ? getDisplayValue(value) : '')}
                    onChange={handleSearchChange}
                    onFocus={() => { 
                        setIsOpen(true); 
                        // Clear search term on focus to allow typing fresh, but keep display logic if blurred
                        setSearchTerm(''); 
                    }}
                    placeholder={placeholder}
                    className={`w-full h-[46px] pl-10 pr-4 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm font-medium transition-all ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                    autoComplete="off"
                />
                {/* Clear button if open and has search text */}
                {isOpen && searchTerm && (
                    <button 
                        onClick={(e) => { e.preventDefault(); setSearchTerm(''); inputRef.current?.focus(); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            {isOpen && (
                <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto text-gray-900 dark:text-white animate-in fade-in zoom-in-95 duration-100 custom-scrollbar">
                    {filteredOptions.length > 0 ? (
                        <>
                            {filteredOptions.map(option => (
                                <li key={option.id} onClick={() => selectOption(option)} className="px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700/80 transition-colors border-b dark:border-gray-700 last:border-0 first:rounded-t-xl last:rounded-b-xl">
                                    {renderOption(option)}
                                </li>
                            ))}
                            {/* Visual indicator if results are truncated */}
                            {options.length > filteredOptions.length && searchTerm && (
                                <li className="px-4 py-2 text-xs text-center text-gray-400 bg-gray-50 dark:bg-gray-900/50 italic">
                                    استمر في الكتابة لتخصيص النتائج...
                                </li>
                            )}
                        </>
                    ) : (
                        <li className="px-4 py-6 text-gray-500 text-sm text-center flex flex-col items-center gap-2">
                            <span className="opacity-50 text-xl">🔍</span>
                            <span>{t('noOrdersFound')}</span>
                        </li>
                    )}
                </ul>
            )}
            {error && <p className="text-red-500 text-[10px] mt-1 font-bold">{error}</p>}
        </div>
    );
}

const OrderFormModal: React.FC<OrderFormModalProps> = ({ isOpen, onClose, onSave, order, clients, stores, currencies, commissionRate, isSaving = false, orders = [], settings, shippingCompanies = [], paymentMethods = [], onClientSearch }) => {
    const { t } = useLanguage();
    const { isOnline, queueOfflineAction } = useNetwork();
    const availableZones = useMemo(() => settings?.shippingZones?.map(z => z.name) || [], [settings]);
    
    // Initial State
    const getInitialFormData = (): Partial<Order> => {
        if (order) {
            return {
                ...order,
                productLinks: order.productLinks && order.productLinks.length > 0 ? order.productLinks : [''],
                productImages: order.productImages || [],
                receiptImages: order.receiptImages || (order.receiptImage ? [order.receiptImage] : []),
                paymentMethod: order.paymentMethod || (paymentMethods?.[0]?.name || ''),
            };
        }
        
        return {
            status: OrderStatus.NEW,
            localOrderId: '',
            shippingType: settings?.defaultShippingType || ShippingType.NORMAL,
            transportMode: TransportMode.AIR,
            currency: settings?.defaultCurrency || (currencies?.[0]?.code || 'AED'),
            quantity: 1,
            price: undefined,
            commission: undefined,
            commissionType: 'percentage',
            commissionRate: commissionRate,
            amountPaid: undefined,
            paymentMethod: paymentMethods?.[0]?.name || '',
            productLinks: [''],
            productImages: [],
            receiptImages: [],
            originCenter: settings?.defaultOriginCenter || '',
            receivingCompanyId: '',
            clientId: '',
            storeId: '',
            orderDate: new Date().toISOString().split('T')[0],
        };
    };

    const [formData, setFormData] = useState<Partial<Order>>({});
    const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);
    const [receiptImagePreviews, setReceiptImagePreviews] = useState<string[]>([]);
    // Specific state for the single order image used in NEW status (Global ID Image)
    const [files, setFiles] = useState<{ orderImages?: string }>({}); 
    
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [localIsSaving, setLocalIsSaving] = useState(false);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // --- FIX: Cache Selected Client ---
    // When searching, the 'clients' prop updates. If the selected client isn't in the new list (or default list),
    // the name disappears. We store the selected object locally to prevent this.
    const [cachedSelectedClient, setCachedSelectedClient] = useState<Client | null>(null);

    // Sync cached client when editing existing order
    useEffect(() => {
        if (isOpen && order && order.clientId) {
            // Try to find in current list, or maybe we need to fetch it (if not in list)
            // For now, assume it might be in the list passed from parent
            const c = clients.find(c => c.id === order.clientId);
            if (c) setCachedSelectedClient(c);
        }
    }, [isOpen, order, clients]);

    const sortedStores = useMemo(() => {
        const storeCounts: Record<string, number> = {};
        orders?.forEach(o => { if (o.storeId) storeCounts[o.storeId] = (storeCounts[o.storeId] || 0) + 1; });
        return [...stores].sort((a, b) => (storeCounts[b.id] || 0) - (storeCounts[a.id] || 0));
    }, [stores, orders]);

    // Financial Calculation Logic
    const financials = useMemo(() => {
        const price = formData.price || 0;
        // const qty = formData.quantity || 1; // DECOUPLED: Quantity does not affect price
        const currCode = formData.currency || 'AED';
        
        // 1. Convert to MRU
        const selectedCurrency = currencies.find(c => c.code === currCode);
        const rate = selectedCurrency ? selectedCurrency.rate : 1;
        
        // Total product value in Foreign Currency (Input IS the total)
        const totalForeign = price; 
        
        // Total product value in MRU
        const totalMRU = Math.round(totalForeign * rate);

        // 2. Calculate Commission
        let calculatedCommission = 0;
        const minCommission = settings?.minCommissionValue || 100;

        if (formData.commissionType === 'percentage') {
            const rawCommission = totalMRU * ((formData.commissionRate || 0) / 100);
            // Apply Minimum Commission Rule
            calculatedCommission = Math.max(rawCommission, minCommission);
        } else {
            calculatedCommission = formData.commission || 0;
        }
        calculatedCommission = Math.round(calculatedCommission);

        // 3. Total Due (Product + Commission)
        const totalDue = totalMRU + calculatedCommission;

        return {
            rate,
            totalForeign,
            totalMRU,
            calculatedCommission,
            totalDue,
            isMinApplied: formData.commissionType === 'percentage' && calculatedCommission === minCommission && (totalMRU * ((formData.commissionRate || 0) / 100)) < minCommission
        };
    }, [formData.price, formData.currency, formData.commissionType, formData.commissionRate, formData.commission, currencies, settings]);

    // On Open: Fetch full details if editing, or set defaults
    useEffect(() => { 
        if(isOpen) { 
            let initial = getInitialFormData();
            
            // Generate Prefix ID for new orders
            if(!order && !initial.localOrderId && settings?.orderIdPrefix) {
                // Simple logic to generate ID (can be improved)
                const lastId = orders.length > 0 ? parseInt(orders[0].localOrderId.replace(/\D/g, '')) || 1000 : 1000;
                initial.localOrderId = `${settings.orderIdPrefix}${lastId + 1}`;
            }

            setFormData(initial); 
            setProductImagePreviews(initial.productImages || []); 
            setReceiptImagePreviews(initial.receiptImages || []);
            setFiles({}); // Reset temp files
            setErrors({}); 

            // If editing, fetch heavy data (images) from DB because list view is lightweight
            // ONLY IF ONLINE
            if (order && supabase && isOnline) {
                const fetchFullDetails = async () => {
                    setIsLoadingDetails(true);
                    try {
                        const { data } = await supabase
                            .from('Orders')
                            .select('product_images, receipt_images, order_images')
                            .eq('id', order.id)
                            .single();
                        
                        if (data) {
                            const prodImgs = data.product_images || [];
                            const receiptImgs = data.receipt_images || [];
                            const orderImgs = data.order_images || [];
                            setFormData(prev => ({ ...prev, productImages: prodImgs, receiptImages: receiptImgs, orderImages: orderImgs }));
                            setProductImagePreviews(prodImgs);
                            setReceiptImagePreviews(receiptImgs);
                            // Set file state for display if it exists in DB (simulate for preview)
                            if (orderImgs.length > 0) setFiles({ orderImages: orderImgs[0] });
                        }
                    } catch (e) {
                        console.error("Error fetching order details", e);
                    } finally {
                        setIsLoadingDetails(false);
                    }
                };
                fetchFullDetails();
            }
        } 
    }, [isOpen, order, isOnline]);

    const handleInputChange = (e: React.ChangeEvent<any>) => { const {name,value,type} = e.target; setFormData(p => ({...p, [name]: type==='number'?parseFloat(value):value})); };
    
    const handleProductLinkChange = (idx: number, val: string) => { const l = [...(formData.productLinks||[])]; l[idx]=val; setFormData(p=>({...p, productLinks:l})); };
    
    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                if (!event.target?.result) return reject("Failed to read file");
                const img = new Image();
                img.src = event.target.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1000;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject("Canvas error");
                    
                    // FIX: Fill white background to prevent black transparent areas on Mobile/Android
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); // Quality 0.7
                };
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'productImages' | 'receiptImages' | 'orderImages') => {
        if (e.target.files && e.target.files.length > 0) {
            setIsProcessingImages(true);
            try {
                const filesList = Array.from(e.target.files) as File[];
                const compressedImages = await Promise.all(filesList.map(f => compressImage(f)));
                
                if (field === 'productImages') {
                    const newImages = [...productImagePreviews, ...compressedImages].slice(0, 5);
                    setProductImagePreviews(newImages);
                    setFormData(p => ({ ...p, productImages: newImages }));
                } else if (field === 'receiptImages') {
                    const newImages = [...receiptImagePreviews, ...compressedImages].slice(0, 3);
                    setReceiptImagePreviews(newImages);
                    setFormData(p => ({ ...p, receiptImages: newImages }));
                } else if (field === 'orderImages') {
                    // Single image for Global ID section usually
                    const singleImage = compressedImages[0];
                    setFiles({ orderImages: singleImage });
                    setFormData(p => ({ ...p, orderImages: [singleImage] }));
                }
            } catch (err) {
                console.error("Image upload failed", err);
                alert("فشل رفع الصورة. يرجى المحاولة مرة أخرى.");
            } finally {
                setIsProcessingImages(false);
            }
        }
    };

    const handlePayFull = () => { 
        setFormData(p => ({...p, amountPaid: financials.totalDue}));
    };

    const handleSubmit = async () => {
        const newErrors: Record<string, string> = {};
        
        // Strict Validation Rules (New Order or Editing)
        if (!formData.clientId) newErrors.clientId = t('required');
        if (!formData.storeId) newErrors.storeId = t('required');
        if (!formData.localOrderId) newErrors.localOrderId = t('required');
        if (!formData.price) newErrors.price = t('required');
        
        // Mandatory fields as requested
        if (!formData.productLinks?.[0] || formData.productLinks[0].trim() === '') newErrors.productLinks = t('required');
        if ((!formData.productImages || formData.productImages.length === 0) && productImagePreviews.length === 0) newErrors.productImages = t('required');
        if (!formData.quantity || formData.quantity <= 0) newErrors.quantity = t('required');
        if (formData.amountPaid === undefined || formData.amountPaid === null) newErrors.amountPaid = t('required');
        if ((!formData.receiptImages || formData.receiptImages.length === 0) && receiptImagePreviews.length === 0) newErrors.receiptImages = t('required');
        if (!formData.paymentMethod) newErrors.paymentMethod = t('required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setLocalIsSaving(true);
        try {
            // Check for duplicate Local Order ID via Supabase (if online)
            if (supabase && isOnline && formData.localOrderId) {
                const { data: existing } = await supabase
                    .from('Orders')
                    .select('id')
                    .eq('local_order_id', formData.localOrderId)
                    .maybeSingle();
                
                if (existing && existing.id !== order?.id) {
                    setErrors(prev => ({...prev, localOrderId: 'رقم الطلب المحلي مستخدم بالفعل! يجب أن يكون فريداً.'}));
                    setLocalIsSaving(false);
                    return;
                }
            }

            // Include Calculated Values
            const finalData = {
                ...formData,
                commission: financials.calculatedCommission,
                priceInMRU: financials.totalMRU,
                // Ensure array fields are set from previews if formData wasn't updated yet
                productImages: productImagePreviews,
                receiptImages: receiptImagePreviews,
                orderImages: files.orderImages ? [files.orderImages] : formData.orderImages,
                // If receipt images exist, set the first one as receiptImage for backward compatibility
                receiptImage: receiptImagePreviews?.[0] || null,
            };

            // OFFLINE SUPPORT
            if (!isOnline) {
                // If offline, create DB payload and queue it
                const dbPayload = {
                    id: order?.id || `temp-${Date.now()}`, // Temporary ID
                    local_order_id: finalData.localOrderId,
                    global_order_id: finalData.globalOrderId,
                    client_id: finalData.clientId,
                    store_id: finalData.storeId,
                    price: finalData.price,
                    currency: finalData.currency,
                    price_in_mru: finalData.priceInMRU,
                    commission: finalData.commission,
                    quantity: finalData.quantity,
                    amount_paid: finalData.amountPaid,
                    payment_method: finalData.paymentMethod,
                    shipping_type: finalData.shippingType,
                    order_date: finalData.orderDate,
                    commission_type: finalData.commissionType,
                    commission_rate: finalData.commissionRate,
                    product_links: finalData.productLinks,
                    product_images: finalData.productImages,
                    receipt_images: finalData.receiptImages,
                    origin_center: finalData.originCenter,
                    notes: finalData.notes,
                    status: finalData.status || OrderStatus.NEW
                };
                
                // Call parent's onSave but since onSave usually does the Supabase call, 
                // we should probably hijack it here or make onSave handle the queue.
                // The cleaner way given the existing architecture is to call queueOfflineAction directly
                queueOfflineAction('Orders', order ? 'UPDATE' : 'INSERT', dbPayload);
                
                // Optimistic UI Update (Pass to parent to update local state immediately)
                // We need to map DB payload back to app model
                // But simplified: onSave expects an Order object.
                await onSave({ ...finalData, id: dbPayload.id } as Order);
                onClose();
            } else {
                await onSave(finalData as Order);
                onClose();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLocalIsSaving(false);
        }
    };

    // Calculate remaining immediately (Allow negative values for surplus)
    const remainingAfterPaid = financials.totalDue - (formData.amountPaid || 0);

    // FIX: Input Class for Light/Dark Mode Contrast - PURE WHITE background in light mode
    const inputClass = "w-full h-[46px] px-4 border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm border-gray-300 dark:border-gray-600 font-medium placeholder-gray-400";
    const labelClass = "block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider";
    const fileInputLabelClass = "cursor-pointer mt-1 flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-400 rounded-lg hover:border-primary dark:hover:border-secondary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative overflow-hidden";

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-0 md:p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full h-full md:h-[95vh] md:max-w-5xl md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-gray-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="px-6 py-4 md:px-8 md:py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 flex-shrink-0">
                    <div>
                        <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            {order ? <Edit2Icon className="text-primary"/> : <PlusIcon className="text-primary"/>}
                            {order ? t('editOrder') : t('addOrder')}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500 font-bold uppercase">ID:</span>
                            <p className="text-base md:text-lg font-mono font-black text-primary">{formData.localOrderId}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-all cursor-pointer"><X size={22} /></button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gray-50/50 dark:bg-black/20">
                    {isLoadingDetails ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="animate-spin text-primary mb-2" size={32}/>
                            <p className="text-gray-500">جاري تحميل التفاصيل...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            {/* LEFT COLUMN: Core Info & Product */}
                            <div className="space-y-6">
                                {/* 1. Client & Store */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>{t('client')}*</label>
                                        <SearchableSelect<Client>
                                            options={clients} 
                                            value={formData.clientId || ''} 
                                            onChange={(val, item) => {
                                                setFormData(p => ({...p, clientId: val}));
                                                // CACHE THE CLIENT SO IT DOESN'T DISAPPEAR ON SEARCH RESET
                                                if (item) setCachedSelectedClient(item);
                                            }} 
                                            placeholder="بحث عن عميل..." 
                                            getDisplayValue={(val) => {
                                                // Look in current list OR cached list
                                                const c = clients.find(c => c.id === val) || (cachedSelectedClient?.id === val ? cachedSelectedClient : null);
                                                return c?.name || '';
                                            }} 
                                            renderOption={(c) => <div><p className="font-bold text-sm">{c.name}</p><p className="text-xs text-gray-500">{c.phone}</p></div>} 
                                            filterFunction={(c, term) => {
                                                const normTerm = normalizeText(term);
                                                const normName = normalizeText(c.name);
                                                const normPhone = normalizePhone(c.phone);
                                                const cleanTermPhone = normalizePhone(term);
                                                
                                                return normName.includes(normTerm) || (cleanTermPhone.length > 3 && normPhone.includes(cleanTermPhone));
                                            }}
                                            valueField="id" 
                                            error={errors.clientId}
                                            icon={<User size={16}/>}
                                            onSearch={onClientSearch}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('store')}*</label>
                                        <SearchableSelect<Store>
                                            options={sortedStores} 
                                            value={formData.storeId || ''} 
                                            onChange={(val) => {
                                                // AUTO-FILL LOGIC: Update fields based on selected store
                                                const selectedStore = stores.find(s => s.id === val);
                                                setFormData(p => ({
                                                    ...p, 
                                                    storeId: val,
                                                    originCenter: selectedStore?.defaultOrigin || p.originCenter,
                                                    receivingCompanyId: selectedStore?.defaultShippingCompanyId || p.receivingCompanyId,
                                                    transportMode: selectedStore?.defaultTransportMode || p.transportMode,
                                                    shippingType: selectedStore?.defaultShippingType || p.shippingType,
                                                }));
                                            }} 
                                            placeholder="اختر المتجر..." 
                                            getDisplayValue={(val) => stores.find(s => s.id === val)?.name || ''} 
                                            renderOption={(s) => <span className="text-sm font-medium">{s.name}</span>} 
                                            filterFunction={(s, term) => s.name.toLowerCase().includes(term.toLowerCase())} 
                                            valueField="id" 
                                            error={errors.storeId}
                                            icon={<ShoppingBag size={16}/>}
                                        />
                                    </div>
                                </div>

                                {/* 2. Product Details */}
                                <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Link size={18} className="text-blue-500"/> تفاصيل المنتج
                                    </h4>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClass}>{t('productLinks')}*</label>
                                            {formData.productLinks?.map((link, idx) => (
                                                <div key={idx} className="flex gap-2 items-center mb-2">
                                                    <div className="flex-grow">
                                                        <input type="text" value={link} onChange={e => handleProductLinkChange(idx, e.target.value)} className={`${inputClass} ${errors.productLinks ? 'border-red-500' : ''}`} placeholder="رابط المنتج..." />
                                                    </div>
                                                    {formData.productLinks!.length > 1 && (
                                                        <button onClick={() => { const n = [...formData.productLinks!]; n.splice(idx,1); setFormData(p=>({...p, productLinks:n})); }} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                                                    )}
                                                </div>
                                            ))}
                                            <button onClick={() => setFormData(p => ({...p, productLinks: [...(p.productLinks||[]), '']}))} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mb-2">
                                                <Plus size={14}/> رابط إضافي
                                            </button>
                                            {errors.productLinks && <p className="text-red-500 text-xs">{errors.productLinks}</p>}
                                        </div>

                                        <div>
                                            <label className={labelClass}>{t('productImages')}*</label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                                <label className={`h-20 w-20 flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-dashed ${errors.productImages ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} cursor-pointer hover:border-blue-500 transition-colors`}>
                                                    {isProcessingImages ? <Loader2 className="animate-spin text-primary"/> : <ImageIcon size={20} className="text-gray-400 mb-1"/>}
                                                    <span className="text-[9px] text-gray-500 font-bold">إضافة</span>
                                                    <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'productImages')} disabled={isProcessingImages}/>
                                                </label>
                                                {productImagePreviews.map((src, i) => (
                                                    <div key={i} className="relative h-20 w-20 flex-shrink-0 group/img">
                                                        <img src={src} className="w-full h-full object-cover rounded-xl border dark:border-gray-600"/>
                                                        <button onClick={() => setProductImagePreviews(p => p.filter((_, x) => x !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 scale-75 transition-all"><X size={12}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                            {errors.productImages && <p className="text-red-500 text-xs">{errors.productImages}</p>}
                                        </div>

                                        <div>
                                            <label className={labelClass}>ملاحظات إضافية</label>
                                            <textarea name="notes" value={formData.notes || ''} onChange={handleInputChange} rows={2} className={`${inputClass} h-auto py-2`} placeholder="المقاس، اللون، تفاصيل خاصة..."></textarea>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Local ID & Order Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>{t('localOrderId')}*</label>
                                        <input type="text" name="localOrderId" value={formData.localOrderId || ''} onChange={handleInputChange} className={`${inputClass} ${errors.localOrderId ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`} placeholder="FCD..." />
                                        {errors.localOrderId && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.localOrderId}</p>}
                                    </div>
                                    <div>
                                        <label className={labelClass}>{t('orderDate')}</label>
                                        <input type="date" name="orderDate" value={formData.orderDate || ''} onChange={handleInputChange} className={inputClass} />
                                    </div>
                                </div>

                                {/* Global Order ID and Image - ONLY IF EDITING AND STATUS IS NEW */}
                                {(order && order.status === OrderStatus.NEW) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>{t('globalOrderId')}</label>
                                            <input type="text" name="globalOrderId" value={formData.globalOrderId || ''} onChange={handleInputChange} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>صورة الطلب العالمي ({t('optional')})</label>
                                            <label htmlFor="file-order" className={`${fileInputLabelClass} ${files.orderImages ? 'p-0 h-40 overflow-hidden' : ''}`}>
                                                {isProcessingImages ? (
                                                    <div className="flex flex-col items-center">
                                                        <Loader2 size={24} className="animate-spin text-primary"/>
                                                        <span className="text-xs mt-1">جاري المعالجة...</span>
                                                    </div>
                                                ) : files.orderImages ? (
                                                    <div className="relative w-full h-full group">
                                                        <img src={files.orderImages} alt="Order Preview" className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800 rounded-lg"/>
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-white text-xs font-bold">تغيير الصورة</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload size={24} className="text-gray-400"/>
                                                        <span className="text-xs text-gray-500">رفع صورة</span>
                                                    </>
                                                )}
                                            </label>
                                            <input id="file-order" type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'orderImages')} accept="image/*" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT COLUMN: Financials & Logistics */}
                            <div className="space-y-6">
                                
                                {/* Financial Group */}
                                <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-green-500"></div>
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <DollarSign size={18} className="text-green-500"/> البيانات المالية
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <div className="col-span-1 sm:col-span-2">
                                            <label className={labelClass}>{t('quantity')} (العدد الكلي للمنتجات)*</label>
                                            <input 
                                                type="number" 
                                                name="quantity" 
                                                value={formData.quantity || ''} 
                                                onChange={handleInputChange} 
                                                onFocus={(e) => e.target.select()} 
                                                className={`${inputClass} text-center font-bold text-lg ${errors.quantity ? 'border-red-500' : ''}`} 
                                                min="1" 
                                                placeholder="1" 
                                            />
                                            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
                                        </div>

                                        <div className="col-span-1 sm:col-span-2">
                                            <label className={labelClass}>{t('totalPrice')} (السعر الكلي للمنتجات)*</label>
                                            <div className="flex relative">
                                                <input 
                                                    type="number" 
                                                    name="price" 
                                                    value={formData.price ?? ''} 
                                                    onChange={handleInputChange} 
                                                    className={`w-full h-[46px] pl-4 pr-24 border rounded-xl bg-white dark:bg-gray-800 text-lg font-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 ${errors.price ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} 
                                                    placeholder="0.00" 
                                                />
                                                <div className="absolute inset-y-0 right-0 flex items-center">
                                                    <select 
                                                        name="currency" 
                                                        value={formData.currency} 
                                                        onChange={handleInputChange} 
                                                        className="h-full bg-gray-100 dark:bg-gray-700 border-l border-gray-300 dark:border-gray-600 rounded-r-xl px-3 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-0 cursor-pointer"
                                                    >
                                                        {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                                        </div>

                                        {/* Commission Section (Moved UP) */}
                                        <div className="col-span-1 sm:col-span-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-gray-500">حساب العمولة</span>
                                                <div className="flex bg-white dark:bg-gray-800 rounded-lg p-0.5 border dark:border-gray-600 shadow-sm">
                                                    <button type="button" onClick={() => setFormData(p => ({...p, commissionType: 'percentage'}))} className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all ${formData.commissionType === 'percentage' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>%</button>
                                                    <button type="button" onClick={() => setFormData(p => ({...p, commissionType: 'fixed'}))} className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all ${formData.commissionType === 'fixed' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>ثابت</button>
                                                </div>
                                            </div>
                                            {formData.commissionType === 'percentage' ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" name="commissionRate" value={formData.commissionRate ?? ''} onChange={handleInputChange} className="w-20 p-2 text-center border rounded-lg font-bold text-sm bg-white dark:bg-gray-800 dark:border-gray-600" />
                                                        <span className="font-bold text-gray-400">%</span>
                                                        <span className="text-gray-400 text-xs"> = </span>
                                                        <span className="font-bold text-green-600">{financials.calculatedCommission.toLocaleString()} MRU</span>
                                                    </div>
                                                    {financials.isMinApplied && (
                                                        <p className="text-[10px] text-orange-500 font-bold flex items-center gap-1">
                                                            <Calculator size={10}/> تم تطبيق الحد الأدنى للعمولة ({settings?.minCommissionValue || 100})
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <input type="number" name="commission" value={formData.commission ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded-lg font-bold text-sm bg-white dark:bg-gray-800 dark:border-gray-600" placeholder="القيمة" />
                                            )}
                                        </div>

                                        {/* Auto-Calculated Details Box (Moved DOWN) */}
                                        <div className="col-span-1 sm:col-span-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30 text-sm">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-gray-500">سعر الصرف:</span>
                                                <span className="font-mono font-bold text-gray-800 dark:text-gray-200">1 {formData.currency} = {financials.rate} MRU</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-gray-500">قيمة المنتجات (MRU):</span>
                                                <span className="font-mono font-bold text-blue-600">{financials.totalMRU.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-blue-100 dark:border-blue-800/50 pt-1 mt-1">
                                                <span className="font-bold text-gray-700 dark:text-white">المجموع الكلي المطلوب:</span>
                                                <span className="font-black text-lg text-primary">{financials.totalDue.toLocaleString()} MRU</span>
                                            </div>
                                        </div>

                                        <div className="col-span-1 sm:col-span-2">
                                            <label className={labelClass}>{t('amountPaid')}*</label>
                                            <div className="flex gap-2 mb-2 items-center">
                                                <div className="relative flex-grow">
                                                    <input type="number" name="amountPaid" value={formData.amountPaid ?? ''} onChange={handleInputChange} className={`${inputClass} font-black text-green-600 ${errors.amountPaid ? 'border-red-500' : ''}`} placeholder="0.00" />
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">MRU</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={handlePayFull}
                                                    className="px-3 py-3 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"
                                                    title="سداد كامل المبلغ (اختصار)"
                                                >
                                                    <CheckCircle2 size={20}/>
                                                </button>
                                            </div>
                                            {errors.amountPaid && <p className="text-red-500 text-xs mt-1">{errors.amountPaid}</p>}
                                            {/* Remaining Amount Indicator - Updated Logic for Surplus */}
                                            <div className="flex justify-end mt-1 px-1">
                                                {remainingAfterPaid > 0 ? (
                                                    <span className="text-xs font-bold text-red-500">
                                                        المتبقي: {remainingAfterPaid.toLocaleString()} MRU
                                                    </span>
                                                ) : remainingAfterPaid < 0 ? (
                                                    <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                                                        <span className="bg-blue-100 px-1 rounded">فائض</span> {Math.abs(remainingAfterPaid).toLocaleString()} MRU
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold text-green-600">
                                                        خالص (0 MRU)
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Payment Receipt Upload */}
                                            <div className="mb-4 mt-2">
                                                <label className={labelClass}>إيصال الدفع*</label>
                                                <div className="flex items-center gap-2">
                                                    <label className={`cursor-pointer h-[46px] w-[46px] flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-xl border border-dashed ${errors.receiptImages ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} hover:border-primary transition-colors`}>
                                                        {isProcessingImages ? <Loader2 className="animate-spin text-primary" size={20}/> : <Receipt size={20} className="text-gray-500"/>}
                                                        <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleImageUpload(e, 'receiptImages')} disabled={isProcessingImages}/>
                                                    </label>
                                                    {receiptImagePreviews.length > 0 ? (
                                                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                                            {receiptImagePreviews.map((src, i) => (
                                                                <div key={i} className="relative h-[46px] w-[46px] flex-shrink-0 group/img">
                                                                    <img src={src} className="w-full h-full object-cover rounded-xl border dark:border-gray-600"/>
                                                                    <button onClick={() => setReceiptImagePreviews(p => p.filter((_, x) => x !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/img:opacity-100 scale-75 transition-all"><X size={10}/></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">لا يوجد إيصال مرفق</span>
                                                    )}
                                                </div>
                                                {errors.receiptImages && <p className="text-red-500 text-xs mt-1">{errors.receiptImages}</p>}
                                            </div>

                                            {/* UPDATED: Payment Method as Dropdown */}
                                            <div>
                                                <label className={labelClass}>{t('paymentMethod')}*</label>
                                                <div className="relative">
                                                    <select
                                                        name="paymentMethod"
                                                        value={formData.paymentMethod || ''}
                                                        onChange={handleInputChange}
                                                        className={`${inputClass} ${errors.paymentMethod ? 'border-red-500' : ''}`}
                                                    >
                                                        <option value="">اختر وسيلة الدفع...</option>
                                                        {paymentMethods?.concat([{ id: 'cash', name: 'Cash', feeRate: 0 } as any]).map(m => (
                                                            <option key={m.id || m.name} value={m.name}>
                                                                {m.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <ChevronDown size={16} className="text-gray-400"/>
                                                    </div>
                                                </div>
                                                {errors.paymentMethod && <p className="text-red-500 text-xs mt-1">{errors.paymentMethod}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Logistics Group */}
                                <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-1 h-full bg-orange-500"></div>
                                    <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Truck size={18} className="text-orange-500"/> الشحن واللوجستيات
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="col-span-1 sm:col-span-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl flex gap-1">
                                            {[TransportMode.AIR, TransportMode.SEA, TransportMode.LAND].map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setFormData(p => ({...p, transportMode: mode}))}
                                                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${formData.transportMode === mode ? 'bg-white dark:bg-gray-600 text-orange-600 shadow-sm' : 'text-gray-500'}`}
                                                >
                                                    {mode === 'air' ? <Plane size={14}/> : mode === 'sea' ? <Ship size={14}/> : <Truck size={14}/>}
                                                    {mode === 'air' ? 'جوي' : mode === 'sea' ? 'بحري' : 'بري'}
                                                </button>
                                            ))}
                                        </div>

                                        <div>
                                            <label className={labelClass}>{t('origin')}*</label>
                                            <select name="originCenter" value={formData.originCenter || ''} onChange={handleInputChange} className={inputClass}>
                                                {availableZones.length > 0 ? availableZones.map(z => <option key={z} value={z}>{z}</option>) : <option value="" disabled>لا يوجد</option>}
                                            </select>
                                        </div>

                                        <div>
                                            <label className={labelClass}>{t('company')}*</label>
                                            <select name="receivingCompanyId" value={formData.receivingCompanyId || ''} onChange={handleInputChange} className={inputClass}>
                                                <option value="">اختر...</option>
                                                {shippingCompanies
                                                    .filter(c => (c.originCountry || '').toLowerCase() === (formData.originCenter || '').toLowerCase() && (c.rates as any)?.[formData.transportMode || 'air'])
                                                    .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                                }
                                            </select>
                                        </div>

                                        <div className="col-span-1 sm:col-span-2">
                                            <label className={labelClass}>{t('shippingType')}</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setFormData(p => ({...p, shippingType: ShippingType.NORMAL}))} className={`flex-1 h-[40px] rounded-xl border-2 text-xs font-bold transition-all ${formData.shippingType === ShippingType.NORMAL ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>عادي</button>
                                                <button onClick={() => setFormData(p => ({...p, shippingType: ShippingType.FAST}))} className={`flex-1 h-[40px] rounded-xl border-2 text-xs font-bold transition-all ${formData.shippingType === ShippingType.FAST ? 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>سريع</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold transition-colors cursor-pointer">إلغاء</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={localIsSaving || isSaving || isProcessingImages || isLoadingDetails}
                        className="px-10 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-black shadow-xl shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none transition-all transform active:scale-95 cursor-pointer"
                    >
                        {localIsSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        {order ? t('save') : t('addOrder')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple icon helpers
const Edit2Icon = ({className}:{className?:string}) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>;
const PlusIcon = ({className}:{className?:string}) => <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

export default OrderFormModal;

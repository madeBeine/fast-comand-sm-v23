
import React, { useState } from 'react';
import { Database, X, Copy, Check, ShieldCheck, UserPlus, Loader2, AlertCircle, Key, Mail, Zap } from 'lucide-react';
import { supabase, getErrorMessage } from '../supabaseClient';

const MASTER_SQL_SCRIPT = `
/* 
=============================================================================
   FAST COMAND SM - COMPLETE DATABASE SCHEMA & UPDATE SCRIPT
   هذا السكربت يقوم بإنشاء الجداول الجديدة أو تحديث الجداول الموجودة
=============================================================================
*/

-- 0. Enable Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Tables Creation (Using IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS public."Users" (
    id uuid NOT NULL PRIMARY KEY,
    username text NOT NULL,
    role text DEFAULT 'employee'::text,
    permissions jsonb DEFAULT '{}'::jsonb,
    avatar text,
    email text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Clients" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text NOT NULL,
    whatsapp_number text,
    address text,
    gender text DEFAULT 'male'::text,
    city_id uuid,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Stores" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    country text,
    website text,
    logo text,
    estimated_delivery_days numeric DEFAULT 14,
    default_origin text,
    default_shipping_company_id uuid,
    default_transport_mode text,
    default_shipping_type text,
    delivery_days_fast numeric,
    delivery_days_normal numeric,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ShippingCompanies" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    origin_country text,
    destination_country text,
    rates jsonb,
    addresses jsonb,
    contact_methods jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."StorageDrawers" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    capacity numeric DEFAULT 0,
    rows numeric DEFAULT 1,
    columns numeric DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Currencies" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    rate numeric DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."PaymentMethods" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    number text,
    logo text,
    note text,
    fee_rate numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Cities" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    delivery_cost numeric DEFAULT 0,
    is_local boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Drivers" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text,
    national_id text,
    vehicle_type text,
    vehicle_number text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."CompanyInfo" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    logo text,
    email text,
    phone text,
    address text,
    website text,
    invoice_terms text,
    invoice_signature text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."AppSettings" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    commission_rate numeric DEFAULT 10,
    min_commission_threshold numeric,
    min_commission_value numeric,
    shipping_rates jsonb,
    delivery_days jsonb,
    default_shipping_type text,
    default_origin_center text,
    order_id_prefix text,
    default_currency text,
    view_order text[],
    whatsapp_templates jsonb,
    calculator_short_link text,
    shipping_zones jsonb,
    notification_reminder_enabled boolean DEFAULT true,
    notification_reminder_interval numeric DEFAULT 60,
    mobile_dock_views text[],
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."GlobalActivityLog" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz DEFAULT now(),
    "user" text,
    action text,
    entity_type text,
    entity_id text,
    details text
);

CREATE TABLE IF NOT EXISTS public."Shipments" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_number text NOT NULL,
    shipping_type text,
    transport_mode text,
    shipping_company_id uuid REFERENCES public."ShippingCompanies"(id) ON DELETE SET NULL,
    departure_date date,
    expected_arrival_date date,
    status text DEFAULT 'new'::text,
    number_of_boxes numeric DEFAULT 0,
    boxes jsonb DEFAULT '[]'::jsonb,
    container_number text,
    receipt_image text,
    total_weight numeric,
    history jsonb DEFAULT '[]'::jsonb,
    rates_snapshot jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Orders" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    local_order_id text NOT NULL,
    global_order_id text,
    client_id uuid REFERENCES public."Clients"(id) ON DELETE SET NULL,
    store_id uuid REFERENCES public."Stores"(id) ON DELETE SET NULL,
    price numeric DEFAULT 0,
    currency text,
    price_in_mru numeric DEFAULT 0,
    commission numeric DEFAULT 0,
    quantity numeric DEFAULT 1,
    amount_paid numeric DEFAULT 0,
    payment_method text,
    transaction_fee numeric DEFAULT 0,
    shipping_type text,
    transport_mode text,
    order_date date,
    expected_arrival_date date,
    arrival_date_at_office date,
    commission_type text,
    commission_rate numeric,
    product_links text[],
    product_images text[],
    order_images text[],
    tracking_images text[],
    hub_arrival_images text[],
    weighing_images text[],
    receipt_images text[],
    receipt_image text,
    notes text,
    status text DEFAULT 'new'::text,
    tracking_number text,
    weight numeric,
    shipping_cost numeric DEFAULT 0,
    storage_location text,
    storage_date timestamptz,
    withdrawal_date timestamptz,
    whatsapp_notification_sent boolean DEFAULT false,
    shipment_id uuid REFERENCES public."Shipments"(id) ON DELETE SET NULL,
    box_id text,
    origin_center text,
    receiving_company_id uuid,
    history jsonb DEFAULT '[]'::jsonb,
    is_invoice_printed boolean DEFAULT false,
    local_delivery_cost numeric DEFAULT 0,
    driver_id uuid REFERENCES public."Drivers"(id) ON DELETE SET NULL,
    driver_name text,
    delivery_run_id text,
    is_delivery_fee_prepaid boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 2. ENSURE ALL COLUMNS EXIST (Updating existing structure)
DO $$ 
BEGIN 
    -- Orders Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Orders' AND column_name='is_invoice_printed') THEN
        ALTER TABLE public."Orders" ADD COLUMN is_invoice_printed boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Orders' AND column_name='whatsapp_notification_sent') THEN
        ALTER TABLE public."Orders" ADD COLUMN whatsapp_notification_sent boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Orders' AND column_name='local_delivery_cost') THEN
        ALTER TABLE public."Orders" ADD COLUMN local_delivery_cost numeric DEFAULT 0;
    END IF;
END $$;

-- 3. Security & Realtime (Optional - depending on your requirements)
ALTER TABLE public."Orders" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Clients" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Shipments" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Drivers" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Stores" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."AppSettings" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."CompanyInfo" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentMethods" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Cities" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."GlobalActivityLog" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Currencies" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."StorageDrawers" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."Orders" REPLICA IDENTITY FULL;
ALTER TABLE public."Clients" REPLICA IDENTITY FULL;
ALTER TABLE public."Shipments" REPLICA IDENTITY FULL;
ALTER TABLE public."Drivers" REPLICA IDENTITY FULL;
ALTER TABLE public."Stores" REPLICA IDENTITY FULL;
ALTER TABLE public."AppSettings" REPLICA IDENTITY FULL;
ALTER TABLE public."CompanyInfo" REPLICA IDENTITY FULL;
ALTER TABLE public."PaymentMethods" REPLICA IDENTITY FULL;
ALTER TABLE public."Cities" REPLICA IDENTITY FULL;
ALTER TABLE public."GlobalActivityLog" REPLICA IDENTITY FULL;
ALTER TABLE public."Currencies" REPLICA IDENTITY FULL;
ALTER TABLE public."Users" REPLICA IDENTITY FULL;
ALTER TABLE public."StorageDrawers" REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
`;

const DatabaseSetupModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'sql' | 'admin'>('sql');
    const [copied, setCopied] = useState(false);
    
    // Admin Creation State
    const [adminEmail, setAdminEmail] = useState('medcheikh7.c@gmail.com');
    const [adminPassword, setAdminPassword] = useState('27562254');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(MASTER_SQL_SCRIPT);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsLoading(true);

        if (!supabase) {
            setMessage({ text: 'خطأ: التطبيق غير متصل بـ Supabase. يرجى التأكد من ملف .env', type: 'error' });
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email: adminEmail,
                password: adminPassword,
                options: { data: { username: 'Admin' } }
            });

            if (error) throw error;

            if (data.user) {
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email: adminEmail,
                    password: adminPassword
                });

                if (loginError) {
                    if (loginError.message.includes("Email not confirmed")) {
                        setMessage({ text: 'تم إنشاء الحساب، ولكن لم يتم تفعيله تلقائياً. هل قمت بتشغيل كود SQL؟', type: 'error' });
                    } else {
                        setMessage({ text: `تم إنشاء الحساب ولكن فشل الدخول: ${loginError.message}`, type: 'error' });
                    }
                } else {
                    setMessage({ text: 'تم إنشاء الحساب وتفعيله بنجاح!', type: 'success' });
                }
            }
        } catch (err: any) {
            console.error("Signup error:", err);
            setMessage({ text: err.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-800 bg-gray-50 dark:bg-black/20">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <Database className="text-primary"/> إعداد وتحديث النظام
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">تحديث وإنشاء قاعدة البيانات (شامل + معالجة الأعمدة الناقصة)</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><X size={24}/></button>
                </div>

                <div className="flex border-b dark:border-gray-800 bg-white dark:bg-gray-900">
                    <button onClick={() => setActiveTab('sql')} className={`flex-1 py-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'sql' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>1. كود SQL (التحديث والتزامن)</button>
                    <button onClick={() => setActiveTab('admin')} className={`flex-1 py-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'admin' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}>2. المدير</button>
                </div>

                <div className="flex-grow overflow-hidden relative group bg-[#1e1e1e] flex flex-col">
                    {activeTab === 'sql' && (
                        <>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm flex items-start gap-3 border-b dark:border-gray-800">
                                <ShieldCheck size={20} className="flex-shrink-0 mt-0.5"/>
                                <div>
                                    <p className="font-bold mb-1">تعليمات هامة للتحديث:</p>
                                    <p className="mb-0 text-xs opacity-90">إذا كنت تواجه خطأ عند إضافة طلب أو تحديث حالة، فهذا يعني أن جدولك قديم. انسخ الكود بالكامل وشغله في SQL Editor بـ Supabase ليقوم بإضافة الأعمدة الناقصة تلقائياً.</p>
                                </div>
                            </div>
                            <div className="flex-grow overflow-hidden relative">
                                <div className="absolute top-4 right-4 z-10">
                                    <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg transition-all font-bold text-sm">
                                        {copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'تم النسخ!' : 'نسخ الكود'}
                                    </button>
                                </div>
                                <pre className="h-full overflow-auto p-6 text-sm font-mono text-gray-300 custom-scrollbar" dir="ltr">{MASTER_SQL_SCRIPT}</pre>
                            </div>
                        </>
                    )}
                    {activeTab === 'admin' && (
                         <div className="flex-grow overflow-y-auto custom-scrollbar p-8 bg-white dark:bg-gray-900">
                            <div className="min-h-full flex flex-col items-center justify-center">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600"><UserPlus size={32} /></div>
                                    <h3 className="text-xl font-bold">إنشاء حساب المدير</h3>
                                </div>
                                <form onSubmit={handleCreateAdmin} className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col gap-4 text-center w-full max-w-sm">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-center gap-1"><Mail size={12}/> البريد الإلكتروني</span>
                                        <code className="block bg-white dark:bg-black px-4 py-2 rounded-lg border dark:border-gray-700 text-sm font-mono font-bold">{adminEmail}</code>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-center gap-1"><Key size={12}/> كلمة المرور</span>
                                        <code className="block bg-white dark:bg-black px-4 py-2 rounded-lg border dark:border-gray-700 text-sm font-mono font-bold">{adminPassword}</code>
                                    </div>
                                    <button type="submit" disabled={isLoading} className="mt-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : <UserPlus size={20}/>} إنشاء الحساب
                                    </button>
                                </form>
                                {message && <div className={`mt-4 p-3 rounded-xl text-sm font-bold w-full max-w-sm text-center ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DatabaseSetupModal;

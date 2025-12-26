
import React, { useState } from 'react';
import { Database, X, Copy, Check, ShieldCheck, UserPlus, Loader2, AlertCircle, Key, Mail, Zap } from 'lucide-react';
import { supabase, getErrorMessage } from '../supabaseClient';

const MASTER_SQL_SCRIPT = `
/* 
=============================================================================
   FAST COMAND SM - ULTIMATE DATABASE BOOTSTRAP
   
   1. Creates Tables & RLS.
   2. Creates Auto-Admin Trigger (Creates profile AND Auto-Confirms Email).
   3. Seeds Default Data.
   4. Enables Realtime Replication safely.
=============================================================================
*/

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABLES
CREATE TABLE IF NOT EXISTS public."CompanyInfo" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text DEFAULT 'Fast Comand SM',
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
    min_commission_threshold numeric DEFAULT 1000,
    min_commission_value numeric DEFAULT 100,
    shipping_rates jsonb DEFAULT '{"fast": 450, "normal": 280}',
    shipping_zones jsonb DEFAULT '[]',
    delivery_days jsonb DEFAULT '{"fast": {"min": 3, "max": 5}, "normal": {"min": 9, "max": 12}}',
    default_shipping_type text DEFAULT 'normal',
    default_origin_center text DEFAULT 'Dubai',
    order_id_prefix text DEFAULT 'FCD',
    default_currency text DEFAULT 'AED',
    payment_methods jsonb DEFAULT '[]',
    view_order text[] DEFAULT ARRAY['dashboard', 'orders', 'shipments', 'clients', 'storage', 'delivery', 'billing', 'settings'],
    whatsapp_templates jsonb DEFAULT '{"ar": "", "en": "", "fr": ""}',
    calculator_short_link text,
    notification_reminder_enabled boolean DEFAULT true,
    notification_reminder_interval int DEFAULT 60,
    mobile_dock_views text[] DEFAULT ARRAY['dashboard', 'orders', 'delivery', 'clients'],
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
    is_local boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Clients" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text,
    whatsapp_number text,
    address text,
    gender text DEFAULT 'male',
    city_id uuid REFERENCES public."Cities"(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Stores" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    country text,
    website text,
    logo text,
    color text DEFAULT '#4F46E5',
    estimated_delivery_days int DEFAULT 14,
    default_origin text,
    default_shipping_company_id uuid,
    default_transport_mode text,
    default_shipping_type text,
    delivery_days_fast int,
    delivery_days_normal int,
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

CREATE TABLE IF NOT EXISTS public."Shipments" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shipment_number text NOT NULL,
    shipping_type text DEFAULT 'normal',
    transport_mode text DEFAULT 'air',
    shipping_company_id uuid REFERENCES public."ShippingCompanies"(id) ON DELETE SET NULL,
    departure_date date,
    expected_arrival_date date,
    status text DEFAULT 'new',
    country text,
    total_weight numeric DEFAULT 0,
    total_shipping_cost numeric DEFAULT 0,
    receipt_image text,
    tracking_number text,
    container_number text,
    history jsonb DEFAULT '[]',
    number_of_boxes int DEFAULT 1,
    boxes jsonb DEFAULT '[]',
    rates_snapshot jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."StorageDrawers" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    capacity int DEFAULT 0,
    rows int DEFAULT 1,
    columns int DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Currencies" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    rate numeric NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."Orders" (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    local_order_id text NOT NULL,
    global_order_id text,
    client_id uuid REFERENCES public."Clients"(id) ON DELETE SET NULL,
    store_id uuid REFERENCES public."Stores"(id) ON DELETE SET NULL,
    price numeric DEFAULT 0,
    currency text DEFAULT 'AED',
    price_in_mru numeric DEFAULT 0,
    commission numeric DEFAULT 0,
    quantity int DEFAULT 1,
    amount_paid numeric DEFAULT 0,
    payment_method text,
    transaction_fee numeric DEFAULT 0,
    shipping_type text DEFAULT 'normal',
    transport_mode text DEFAULT 'air',
    order_date date DEFAULT CURRENT_DATE,
    arrival_date_at_office date,
    expected_arrival_date date,
    expected_hub_arrival_start_date date,
    expected_hub_arrival_end_date date,
    commission_type text DEFAULT 'percentage',
    commission_rate numeric DEFAULT 10,
    product_links text[],
    product_images text[],
    order_images text[],
    tracking_images text[],
    hub_arrival_images text[],
    weighing_images text[],
    notes text,
    status text DEFAULT 'new',
    tracking_number text,
    weight numeric DEFAULT 0,
    shipping_cost numeric DEFAULT 0,
    storage_location text,
    storage_date timestamptz,
    withdrawal_date timestamptz,
    receipt_image text,
    receipt_images text[],
    whatsapp_notification_sent boolean DEFAULT false,
    shipment_id uuid REFERENCES public."Shipments"(id) ON DELETE SET NULL,
    box_id text,
    origin_center text,
    receiving_company_id uuid,
    history jsonb DEFAULT '[]',
    is_invoice_printed boolean DEFAULT false,
    local_delivery_cost numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT orders_local_order_id_unique UNIQUE (local_order_id)
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

CREATE TABLE IF NOT EXISTS public."Users" (
    id uuid PRIMARY KEY,
    username text,
    role text DEFAULT 'employee',
    permissions jsonb,
    avatar text,
    email text,
    created_at timestamptz DEFAULT now()
);

-- 3. ENABLE RLS
DO $$ BEGIN
    ALTER TABLE public."CompanyInfo" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."AppSettings" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."PaymentMethods" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Cities" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Clients" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Stores" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."ShippingCompanies" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Shipments" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."StorageDrawers" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Currencies" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Orders" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."GlobalActivityLog" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public."Users" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. POLICIES
DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['CompanyInfo', 'AppSettings', 'PaymentMethods', 'Cities', 'Clients', 'Stores', 'ShippingCompanies', 'Shipments', 'StorageDrawers', 'Currencies', 'Orders', 'GlobalActivityLog', 'Users'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable write access for authenticated users" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable all access for authenticated users" ON public.%I FOR ALL USING (auth.role() = ''authenticated'')', t);
    END LOOP;
    
    DROP POLICY IF EXISTS "Public read currencies" ON public."Currencies";
    CREATE POLICY "Public read currencies" ON public."Currencies" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public read app settings" ON public."AppSettings";
    CREATE POLICY "Public read app settings" ON public."AppSettings" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public read company info" ON public."CompanyInfo";
    CREATE POLICY "Public read company info" ON public."CompanyInfo" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public read cities" ON public."Cities";
    CREATE POLICY "Public read cities" ON public."Cities" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public read stores" ON public."Stores";
    CREATE POLICY "Public read stores" ON public."Stores" FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Public read payment methods" ON public."PaymentMethods";
    CREATE POLICY "Public read payment methods" ON public."PaymentMethods" FOR SELECT USING (true);
END $$;

-- 5. TRIGGER: HANDLE NEW USER & AUTO-CONFIRM
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Create Public User Profile
  INSERT INTO public."Users" (id, username, email, role, permissions)
  VALUES (
    new.id,
    split_part(new.email, '@', 1),
    new.email,
    -- Make 'medcheikh7.c@gmail.com' ADMIN automatically
    CASE 
        WHEN (SELECT count(*) FROM public."Users") = 0 OR new.email = 'medcheikh7.c@gmail.com' THEN 'admin' 
        ELSE 'employee' 
    END,
    CASE 
        WHEN (SELECT count(*) FROM public."Users") = 0 OR new.email = 'medcheikh7.c@gmail.com' THEN 
            '{"canAccessSettings":true,"canManageUsers":true,"canViewAuditLog":true,"canViewFinance":true,"orders":{"view":true,"create":true,"edit":true,"delete":true,"changeStatus":true,"revertStatus":true},"shipments":{"view":true,"create":true,"edit":true,"delete":true,"changeStatus":true,"revertStatus":true},"clients":{"view":true,"create":true,"edit":true,"delete":true},"storage":{"view":true,"create":true,"edit":true,"delete":true},"delivery":{"view":true,"process":true},"billing":{"view":true,"print":true},"settings":{"canEditCompany":true,"canEditSystem":true,"canEditStores":true,"canEditShipping":true,"canEditCurrencies":true}}'::jsonb
    ELSE 
        '{"canAccessSettings":false,"canManageUsers":false,"canViewAuditLog":false,"canViewFinance":false,"orders":{"view":true,"create":true,"edit":true,"delete":false,"changeStatus":true,"revertStatus":false},"shipments":{"view":true,"create":true,"edit":true,"delete":false,"changeStatus":true,"revertStatus":false},"clients":{"view":true,"create":true,"edit":true,"delete":false},"storage":{"view":true,"create":false,"edit":false,"delete":false},"delivery":{"view":true,"process":true},"billing":{"view":true,"print":true},"settings":{"canEditCompany":false,"canEditSystem":false,"canEditStores":false,"canEditShipping":false,"canEditCurrencies":false}}'::jsonb
    END
  );

  -- 2. AUTO-CONFIRM EMAIL (CRITICAL FOR ADMIN)
  -- This bypasses the email verification step.
  IF new.email = 'medcheikh7.c@gmail.com' THEN
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. ADMIN FUNCTIONS 
DROP FUNCTION IF EXISTS public.admin_check_user_exists;
CREATE OR REPLACE FUNCTION public.admin_check_user_exists(email_check text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = email_check);
END;
$$;

DROP FUNCTION IF EXISTS public.admin_delete_user;
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public."Users" WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_confirm_user_email;
CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = target_user_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_reset_password;
CREATE OR REPLACE FUNCTION public.admin_reset_password(target_user_id uuid, new_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users SET encrypted_password = crypt(new_password, gen_salt('bf')) WHERE id = target_user_id;
END;
$$;

-- 7. DATA SEEDING
INSERT INTO public."AppSettings" (commission_rate, default_currency, shipping_zones, whatsapp_templates)
SELECT 10, 'AED',
'[{"name": "China", "rates": {"fast": 450, "normal": 280}}, {"name": "Dubai", "rates": {"fast": 400, "normal": 250}}, {"name": "USA", "rates": {"fast": 550, "normal": 350}}]',
'{"ar": "مرحباً {clientName} 👋\\n\\nطلبك *#{orderId}* وصل! 🎉\\nالوزن: {weight} كغ\\nالمجموع: {totalDue} MRU", "en": "Hello {clientName}, Order #{orderId} arrived! Total: {totalDue} MRU", "fr": "Bonjour {clientName}, Commande #{orderId} arrivée! Total: {totalDue} MRU"}'
WHERE NOT EXISTS (SELECT 1 FROM public."AppSettings");

INSERT INTO public."CompanyInfo" (name, email, phone, address, invoice_terms) 
SELECT 'Fast Comand SM', 'contact@fastcomand.com', '+222 40000000', 'Nouakchott, Mauritania', 'شكراً لثقتكم بنا. البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام.' 
WHERE NOT EXISTS (SELECT 1 FROM public."CompanyInfo");

INSERT INTO public."Currencies" (name, code, rate) VALUES 
('Dirham', 'AED', 11.5), ('Dollar', 'USD', 40.0), ('Euro', 'EUR', 43.0), ('Riyal', 'SAR', 10.6), ('Lira', 'TRY', 1.2)
ON CONFLICT DO NOTHING;

INSERT INTO public."PaymentMethods" (name, note, fee_rate) VALUES
('Cash', 'الدفع نقداً عند الاستلام', 0), ('Bankily', 'تحويل بنكيلي', 0), ('Masrvi', 'تطبيق مصرفي', 0), ('Sedad', 'سداد', 0)
ON CONFLICT DO NOTHING;

INSERT INTO public."Cities" (name, delivery_cost, is_local) VALUES
('Nouakchott', 100, true), ('Nouadhibou', 200, false), ('Rosso', 200, false), ('Kiffa', 300, false)
ON CONFLICT DO NOTHING;

INSERT INTO public."Stores" (name, country, estimated_delivery_days, default_origin, default_transport_mode) VALUES
('Shein', 'China', 14, 'China', 'air'), ('Amazon', 'USA', 20, 'USA', 'air'), ('Alibaba', 'China', 30, 'China', 'sea'), ('Noon', 'UAE', 10, 'Dubai', 'air')
ON CONFLICT DO NOTHING;

INSERT INTO public."ShippingCompanies" (name, origin_country, destination_country, rates) VALUES
('Cargo Air Express', 'Global', 'Mauritania', '{"air": {"pricingUnit": "KG"}}'), ('Ocean Freight Line', 'China', 'Mauritania', '{"sea": {"pricingUnit": "CBM"}}')
ON CONFLICT DO NOTHING;

-- 8. ENABLE REALTIME SAFELY
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'Orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Orders";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'Clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Clients";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'Shipments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Shipments";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'GlobalActivityLog') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "GlobalActivityLog";
  END IF;
END $$;
`;

const DatabaseSetupModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'sql' | 'admin'>('sql');
    const [copied, setCopied] = useState(false);
    
    // Admin Creation State - Pre-filled as requested
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
            // 1. Attempt to Sign Up
            // Note: If the SQL script was run, the TRIGGER will auto-confirm this specific email.
            const { data, error } = await supabase.auth.signUp({
                email: adminEmail,
                password: adminPassword,
                options: {
                    data: { username: 'Admin' }
                }
            });

            if (error) throw error;

            if (data.user) {
                // 2. Immediately try to Sign In to verify auto-confirmation worked
                const { error: loginError } = await supabase.auth.signInWithPassword({
                    email: adminEmail,
                    password: adminPassword
                });

                if (loginError) {
                    if (loginError.message.includes("Email not confirmed")) {
                        setMessage({ text: 'تم إنشاء الحساب، ولكن لم يتم تفعيله تلقائياً. هل قمت بتشغيل كود SQL في الخطوة 1؟ الكود يحتوي على Trigger للتفعيل التلقائي.', type: 'error' });
                    } else {
                        setMessage({ text: `تم إنشاء الحساب ولكن فشل الدخول: ${loginError.message}`, type: 'error' });
                    }
                } else {
                    setMessage({ text: 'تم إنشاء الحساب وتفعيله وتسجيل الدخول بنجاح! يمكنك إغلاق هذه النافذة.', type: 'success' });
                    // Optional: Close modal after delay
                    // setTimeout(onClose, 2000);
                }
            }
        } catch (err: any) {
            console.error("Signup error:", err);
            let msg = err.message;
            if (msg.includes('Database error saving new user')) {
                msg = 'خطأ في قاعدة البيانات: يرجى التأكد من تشغيل كود SQL في التبويب الأول.';
            } else if (msg.includes('User already registered')) {
                msg = 'هذا المستخدم مسجل بالفعل. حاول تسجيل الدخول بدلاً من ذلك.';
            }
            setMessage({ text: msg, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b dark:border-gray-800 bg-gray-50 dark:bg-black/20">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <Database className="text-primary"/> إعداد النظام
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">تهيئة قاعدة البيانات وإنشاء المدير الأول</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-gray-800 bg-white dark:bg-gray-900">
                    <button 
                        onClick={() => setActiveTab('sql')}
                        className={`flex-1 py-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'sql' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}
                    >
                        1. كود قاعدة البيانات (SQL)
                    </button>
                    <button 
                        onClick={() => setActiveTab('admin')}
                        className={`flex-1 py-4 text-sm font-bold border-b-4 transition-colors ${activeTab === 'admin' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}
                    >
                        2. إنشاء حساب المدير
                    </button>
                </div>

                <div className="flex-grow overflow-hidden relative group bg-[#1e1e1e] flex flex-col">
                    
                    {activeTab === 'sql' && (
                        <>
                            {/* Instructions */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-sm flex items-start gap-3 border-b dark:border-gray-800">
                                <ShieldCheck size={20} className="flex-shrink-0 mt-0.5"/>
                                <div>
                                    <p className="font-bold mb-1">الخطوة الأولى: تهيئة القاعدة</p>
                                    <p className="mb-2 text-xs opacity-80">
                                        يجب عليك وضع مفاتيح الربط (URL & KEY) في ملف <code>.env</code> حتى يتمكن التطبيق من الاتصال. هذا الكود ينشئ الجداول والصلاحيات فقط.
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 opacity-90 font-mono text-xs">
                                        <li>انسخ الكود أدناه.</li>
                                        <li>اذهب إلى مشروع Supabase &rarr; SQL Editor.</li>
                                        <li>الصق الكود واضغط Run.</li>
                                        <li>بعد النجاح، انتقل للتبويب الثاني لإنشاء حساب المدير.</li>
                                    </ol>
                                </div>
                            </div>

                            {/* Code Block */}
                            <div className="flex-grow overflow-hidden relative">
                                <div className="absolute top-4 right-4 z-10">
                                    <button 
                                        onClick={handleCopy} 
                                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg transition-all font-bold text-sm"
                                    >
                                        {copied ? <Check size={16}/> : <Copy size={16}/>}
                                        {copied ? 'تم النسخ!' : 'نسخ الكود'}
                                    </button>
                                </div>
                                <pre className="h-full overflow-auto p-6 text-sm font-mono text-gray-300 custom-scrollbar" dir="ltr">
                                    {MASTER_SQL_SCRIPT}
                                </pre>
                            </div>
                        </>
                    )}

                    {activeTab === 'admin' && (
                        <div className="flex-grow overflow-y-auto custom-scrollbar p-8 bg-white dark:bg-gray-900">
                            <div className="min-h-full flex flex-col items-center justify-center">
                                <div className="w-full max-w-md space-y-6">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                                            <UserPlus size={40} />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">إنشاء أول مدير للنظام</h3>
                                        <p className="text-gray-500 mt-2 text-sm">
                                            بفضل كود SQL، سيتم تفعيل هذا الحساب تلقائياً دون الحاجة لتأكيد البريد الإلكتروني.
                                        </p>
                                    </div>

                                    {/* CREDENTIALS CARD DISPLAY - NEW */}
                                    <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col gap-4 text-center">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                            <Key size={14}/> بيانات الدخول
                                        </h4>
                                        
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-center gap-1">
                                                <Mail size={12}/> البريد الإلكتروني
                                            </span>
                                            <code className="block bg-white dark:bg-black px-4 py-2 rounded-lg border dark:border-gray-700 text-lg font-mono font-bold text-gray-800 dark:text-white select-all">
                                                {adminEmail}
                                            </code>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-center gap-1">
                                                <Key size={12}/> كلمة المرور
                                            </span>
                                            <code className="block bg-white dark:bg-black px-4 py-2 rounded-lg border dark:border-gray-700 text-xl font-mono font-black text-primary select-all tracking-wider">
                                                {adminPassword}
                                            </code>
                                        </div>
                                    </div>

                                    <form onSubmit={handleCreateAdmin} className="space-y-4">
                                        {/* Inputs are kept in state but hidden or readonly if needed, here simply re-using state */}
                                        <input type="hidden" value={adminEmail} />
                                        <input type="hidden" value={adminPassword} />

                                        {message && (
                                            <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                {message.type === 'success' ? <Check size={20}/> : <AlertCircle size={20}/>}
                                                {message.text}
                                            </div>
                                        )}

                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                                            <Zap size={16} className="flex-shrink-0 mt-0.5"/>
                                            <p>تأكد من تشغيل كود SQL أولاً لتفعيل خاصية "التأكيد التلقائي"، وإلا سيطلب النظام تأكيد البريد.</p>
                                        </div>

                                        <button 
                                            type="submit" 
                                            disabled={isLoading}
                                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                                        >
                                            {isLoading ? <Loader2 className="animate-spin" size={20}/> : <UserPlus size={20}/>}
                                            تأكيد وإنشاء الحساب
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabaseSetupModal;

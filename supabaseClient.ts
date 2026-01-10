

// ... existing imports
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration: Use Environment Variables for Security
// Cloudflare/Production: Add these to Environment Variables in dashboard

// Safely access env to avoid "Cannot read properties of undefined"
const env = (import.meta as any).env || {};

// Credentials
const supabaseUrl = env.VITE_SUPABASE_URL || "https://wdyzfzrhreoxqylmtnfd.supabase.co";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkeXpmenJocmVveHF5bG10bmZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwODc0MDksImV4cCI6MjA4MTY2MzQwOX0.jOGn9P46XBMo__9YQODUXLzQoYqqw-piGvRTr3hjKGo";

// ... existing interfaces (DBOrder, DBClient, etc) - Keep them as is

export interface DBOrder {
  id: string;
  local_order_id: string;
  global_order_id?: string;
  client_id: string;
  store_id: string;
  price: number;
  currency: string;
  price_in_mru?: number;
  commission?: number;
  quantity: number;
  amount_paid: number;
  payment_method?: string;
  transaction_fee?: number; // NEW
  shipping_type: string;
  transport_mode?: string; // NEW
  order_date: string;
  arrival_date_at_office?: string;
  expected_arrival_date: string;
  expected_hub_arrival_start_date?: string;
  expected_hub_arrival_end_date?: string;
  commission_type?: 'percentage' | 'fixed';
  commission_rate?: number;
  product_links?: string[];
  product_images?: string[]; 
  order_images?: string[];   
  tracking_images?: string[]; // NEW
  hub_arrival_images?: string[]; 
  weighing_images?: string[];    
  notes?: string;
  status: string;
  tracking_number?: string;
  weight?: number;
  shipping_cost?: number;
  storage_location?: string;
  storage_date?: string;
  withdrawal_date?: string;      
  receipt_image?: string;
  receipt_images?: string[];        
  whatsapp_notification_sent?: boolean; 
  shipment_id?: string;
  box_id?: string;
  origin_center?: string;
  receiving_company_id?: string;
  history?: any[]; // JSONB
  is_invoice_printed?: boolean;
  local_delivery_cost?: number;
  driver_name?: string; // Existing text field
  driver_id?: string; // New Link
  delivery_run_id?: string; // NEW: Group ID for delivery runs
  is_delivery_fee_prepaid?: boolean; // NEW
}

export interface DBClient {
  id: string;
  name: string;
  phone: string;
  whatsapp_number?: string;
  address?: string;
  gender?: 'male' | 'female';
  city_id?: string;
}

export interface DBStore {
  id: string;
  name: string;
  country?: string; 
  website?: string; 
  logo?: string;
  color?: string;
  estimated_delivery_days: number;
  default_origin?: string; // NEW: Smart Store Logic
  default_shipping_company_id?: string; // NEW: Smart Store Logic
  default_transport_mode?: string; // NEW
  default_shipping_type?: string; // NEW
  delivery_days_fast?: number; // NEW
  delivery_days_normal?: number; // NEW
}

export interface DBShipment {
  id: string;
  shipment_number: string;
  shipping_type: string;
  transport_mode?: string; // NEW
  shipping_company_id: string;
  departure_date: string;
  expected_arrival_date: string;
  status: string;
  country?: string;
  total_weight?: number;         
  total_shipping_cost?: number;  
  receipt_image?: string;        
  tracking_number?: string;      
  container_number?: string; // NEW
  history?: any[];
  number_of_boxes: number;
  boxes: any[]; // JSONB
  rates_snapshot?: any; // NEW
}

export interface DBShippingCompany {
  id: string;
  name: string;
  origin_country?: string; 
  destination_country?: string; 
  rates?: any; 
  addresses?: any; 
  contact_methods?: any[]; 
}

export interface DBStorageDrawer {
  id: string;
  name: string;
  capacity: number;
  rows?: number;
  columns?: number;
}

export interface DBCurrency {
  id: string;
  name: string;
  code: string;
  rate: number;
}

export interface DBPaymentMethod {
  id: string;
  name: string;
  number?: string;
  logo?: string;
  note?: string;
  fee_rate?: number;
  created_at?: string;
}

export interface DBUser {
  id: string;
  username: string;
  role: string;
  permissions: any; // JSONB
  avatar?: string;
  email?: string;
}

export interface DBGlobalActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
}

export interface DBCompanyInfo {
  id: string;
  name: string;
  logo: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  invoice_terms?: string;      
  invoice_signature?: string;  
}

export interface DBAppSettings {
  id: string;
  commission_rate: number;
  min_commission_threshold?: number; // NEW
  min_commission_value?: number; // NEW
  shipping_rates: any; 
  delivery_days: any;  
  default_shipping_type: string;
  default_origin_center: string;
  order_id_prefix?: string;   
  default_currency?: string; 
  view_order?: string[];
  whatsapp_templates?: any;
  calculator_short_link?: string;
  shipping_zones?: any;
  notification_reminder_enabled?: boolean;
  notification_reminder_interval?: number;
  mobile_dock_views?: string[];
}

export interface DBCity {
    id: string;
    name: string;
    delivery_cost: number;
    is_local: boolean;
}

export interface DBDriver {
    id: string;
    name: string;
    phone: string;
    national_id?: string;
    vehicle_type?: string;
    vehicle_number?: string;
    is_active: boolean;
}

export interface Database {
  public: {
    Tables: {
      Orders: {
        Row: DBOrder;
        Insert: Partial<DBOrder>;
        Update: Partial<DBOrder>;
      };
      Clients: {
        Row: DBClient;
        Insert: Partial<DBClient>;
        Update: Partial<DBClient>;
      };
      Stores: {
        Row: DBStore;
        Insert: Partial<DBStore>;
        Update: Partial<DBStore>;
      };
      Shipments: {
        Row: DBShipment;
        Insert: Partial<DBShipment>;
        Update: Partial<DBShipment>;
      };
      ShippingCompanies: {
        Row: DBShippingCompany;
        Insert: Partial<DBShippingCompany>;
        Update: Partial<DBShippingCompany>;
      };
      StorageDrawers: {
        Row: DBStorageDrawer;
        Insert: Partial<DBStorageDrawer>;
        Update: Partial<DBStorageDrawer>;
      };
      PaymentMethods: {
        Row: DBPaymentMethod;
        Insert: Partial<DBPaymentMethod>;
        Update: Partial<DBPaymentMethod>;
      };
      Currencies: {
        Row: DBCurrency;
        Insert: Partial<DBCurrency>;
        Update: Partial<DBCurrency>;
      };
      Users: {
        Row: DBUser;
        Insert: DBUser;
        Update: Partial<DBUser>;
      };
      GlobalActivityLog: {
        Row: DBGlobalActivityLog;
        Insert: Partial<DBGlobalActivityLog>;
        Update: Partial<DBGlobalActivityLog>;
      };
      CompanyInfo: {
        Row: DBCompanyInfo;
        Insert: Partial<DBCompanyInfo>;
        Update: Partial<DBCompanyInfo>;
      };
      AppSettings: {
        Row: DBAppSettings;
        Insert: Partial<DBAppSettings>;
        Update: Partial<DBAppSettings>;
      };
      Cities: {
        Row: DBCity;
        Insert: Partial<DBCity>;
        Update: Partial<DBCity>;
      };
      Drivers: {
        Row: DBDriver;
        Insert: Partial<DBDriver>;
        Update: Partial<DBDriver>;
      };
    };
  };
}

let supabase: SupabaseClient<Database> | null = null;
let supabaseInitializationError: string | null = null;

try {
    if (supabaseUrl && supabaseAnonKey) {
        supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage,
            },
            realtime: {
                params: {
                    eventsPerSecond: 10,
                },
                heartbeatIntervalMs: 5000, 
            },
        });
    } else {
        supabaseInitializationError = "Missing Credentials";
        console.warn("Supabase credentials not found.");
    }
} catch (e: any) {
    supabaseInitializationError = e.message;
    console.error("Supabase Init Error:", e);
}

export const getErrorMessage = (error: any): string => {
    if (!error) return 'Unknown error';
    
    // Handle Standard Error Objects (which often stringify to {})
    if (error instanceof Error) return error.message;

    if (typeof error === 'string') {
        const lower = error.toLowerCase();
        if (lower.includes('failed to fetch')) return 'فشل الاتصال بالخادم. تأكد من الإنترنت.';
        if (lower.includes('relation') && lower.includes('does not exist')) return 'قاعدة البيانات غير مهيئة. يرجى إعداد قاعدة البيانات.';
        return error;
    }
    // Handle Supabase/Postgrest Error Structures
    if (error.message) return error.message;
    if (error.error_description) return error.error_description;
    if (error.details) return error.details;
    if (error.hint) return error.hint;
    
    // Last resort: Stringify object to see content instead of [object Object]
    try {
        const str = JSON.stringify(error);
        return str === '{}' ? 'Unknown Error (Empty Object)' : str;
    } catch {
        return 'Unknown Error Object';
    }
};

export { supabase, supabaseInitializationError };
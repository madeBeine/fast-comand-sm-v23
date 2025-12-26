
export enum OrderStatus {
  NEW = 'new',
  ORDERED = 'ordered',
  SHIPPED_FROM_STORE = 'shipped_from_store',
  // Removed intermediate statuses for faster workflow
  ARRIVED_AT_OFFICE = 'arrived_at_office',
  STORED = 'stored',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled', // New Status
}

export enum ShippingType {
  FAST = 'fast',
  NORMAL = 'normal',
}

export enum TransportMode {
  AIR = 'air',
  SEA = 'sea',
  LAND = 'land'
}

export enum ShipmentStatus {
    NEW = 'new',
    SHIPPED = 'shipped',
    PARTIALLY_ARRIVED = 'partially_arrived',
    ARRIVED = 'arrived',
    RECEIVED = 'received',
    DELAYED = 'delayed',
}

export interface ActivityLog {
  timestamp: string;
  activity: string;
  user: string;
}

export interface GlobalActivityLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    entityType: 'Order' | 'Shipment' | 'Client' | 'User' | 'Store' | 'ShippingCompany' | 'Currency' | 'Drawer' | 'Settings' | 'City' | 'Auth';
    entityId: string;
    details: string;
}

export interface City {
    id: string;
    name: string;
    deliveryCost: number; // Cost for delivery/agency
    isLocal: boolean; // True for Nouakchott, False for others (Agency)
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  gender?: 'male' | 'female';
  cityId?: string; // Link to City
}

export interface Store {
  id: string;
  name: string;
  country?: string; 
  website?: string; 
  estimatedDeliveryDays: number;
  logo?: string; 
  color?: string; 
  // Smart Logistics Fields
  defaultOrigin?: string; // e.g. "China" (Links to Zone)
  defaultShippingCompanyId?: string; // Auto-select this company
  defaultTransportMode?: TransportMode; // NEW: Default Air/Sea/Land
  defaultShippingType?: ShippingType; // NEW: Default Fast/Normal
  // New Delivery Durations
  deliveryDaysFast?: number;
  deliveryDaysNormal?: number;
}

export interface ContactMethod {
    type: string; // e.g., 'Phone', 'WhatsApp', 'Email'
    value: string;
}

export interface ShippingRate {
    cost: number;  // Cost Rate (What we pay)
    price: number; // Selling Rate (What we charge)
    minDays?: number; // Minimum delivery days for this specific rate
    maxDays?: number; // Maximum delivery days for this specific rate
}

export interface RateMatrix {
    fast: ShippingRate;
    normal: ShippingRate;
}

export interface ModeDetails {
    fast?: ShippingRate;
    normal?: ShippingRate;
    address?: string; // Specific address for this mode (e.g. Warehouse A)
    pricingUnit?: 'KG' | 'CBM'; // Unit type
}

export interface ShippingCompany {
  id: string;
  name: string;
  originCountry?: string; // e.g., China, UAE
  destinationCountry?: string; // e.g., Mauritania
  // Updated rates structure for Multi-Modal Matrix
  rates?: { 
      air?: ModeDetails;
      sea?: ModeDetails;
      land?: ModeDetails;
  };
  addresses?: { origin: string; destination: string }; // Deprecated in favor of mode-specific address
  contactMethods?: ContactMethod[];
}

export interface Currency {
  id: string;
  name: string;
  code: string;
  rate: number; // Rate against MRU (Ouguiya)
}

export interface Order {
  id: string;
  localOrderId: string;
  globalOrderId?: string;
  clientId: string;
  storeId: string;
  price: number;
  currency: string; // This will now be the currency code e.g., 'USD'
  priceInMRU?: number;
  commission?: number; // Assumed to be in MRU
  quantity: number;
  amountPaid: number; // This is in MRU
  paymentMethod?: string; // Added payment method
  transactionFee?: number; // NEW: The actual fee deducted
  shippingType: ShippingType;
  transportMode: TransportMode; // NEW: Air, Sea, Land
  orderDate: string;
  arrivalDateAtOffice?: string;
  expectedArrivalDate: string;
  expectedHubArrivalStartDate?: string;
  expectedHubArrivalEndDate?: string;
  commissionType?: 'percentage' | 'fixed';
  commissionRate?: number;
  productLinks?: string[];
  productImages?: string[]; // Renamed from productImage
  orderImages?: string[];
  trackingImages?: string[]; // NEW: Images related to tracking/shipping labels
  hubArrivalImages?: string[];
  weighingImages?: string[];
  notes?: string;
  status: OrderStatus;
  trackingNumber?: string;
  weight?: number;
  shippingCost?: number;
  storageLocation?: string; 
  storageDate?: string;
  withdrawalDate?: string;
  receiptImage?: string; 
  receiptImages?: string[]; // Support multiple receipts
  shipmentId?: string;
  boxId?: string;
  originCenter?: string; // e.g., "Dubai", "China"
  receivingCompanyId?: string;
  history?: ActivityLog[];
  whatsappNotificationSent?: boolean;
  isInvoicePrinted?: boolean; // New Field
  localDeliveryCost?: number; // تكلفة التوصيل المحلي للزبون
}

export interface Box {
  id: string;
  boxNumber: number;
  status: 'in_transit' | 'arrived';
  arrivalDate?: string;
}

export interface Shipment {
  id:string;
  shipmentNumber: string;
  shippingType: ShippingType;
  transportMode: TransportMode; // NEW
  shippingCompanyId: string;
  departureDate: string;
  expectedArrivalDate: string;
  status: ShipmentStatus;
  country?: string; // e.g., "Dubai", "China"
  totalWeight?: number;
  totalShippingCost?: number;
  receiptImage?: string;
  trackingNumber?: string;
  containerNumber?: string; // NEW: For Sea Freight
  history?: ActivityLog[];
  numberOfBoxes: number;
  boxes: Box[];
  // New: Snapshot of rates at time of shipment creation
  ratesSnapshot?: {
      cost: number;
      price: number;
  };
}

export interface StorageDrawer {
  id: string;
  name: string;
  capacity: number; // Total slots (rows * columns)
  rows: number;     // Number of shelves/rows
  columns: number;  // Number of slots per row
}

export interface CompanyInfo {
    id?: string; // UUID from DB
    name: string;
    logo: string; // base64 string
    email: string;
    phone: string;
    address: string;
    website?: string;
    invoiceTerms?: string;
    invoiceSignature?: string;
}

export interface ShippingZone {
    name: string; // Unique ID effectively (e.g. "China", "Dubai")
    rates: { fast: number; normal: number };
}

export interface PaymentMethod {
    id: string;
    name: string;
    logo?: string;
    number?: string; // Account Number / Phone
    note?: string;
    feeRate?: number; // Transaction Fee Percentage (e.g. 1.5 for 1.5%)
}

export interface AppSettings {
    id?: string; // UUID from DB
    commissionRate: number;
    // New fields for minimum commission logic
    minCommissionThreshold?: number; // If order price < this
    minCommissionValue?: number;     // Use this fixed value
    shippingRates: { fast: number; normal: number }; // Global Default
    shippingZones: ShippingZone[]; // Custom overrides
    deliveryDays: {
        fast: { min: number; max: number };
        normal: { min: number; max: number };
    };
    defaultShippingType: ShippingType;
    defaultOriginCenter: string;
    paymentMethods?: PaymentMethod[]; // Deprecated, kept for interface compat but populated from separate table now
    orderIdPrefix?: string;
    defaultCurrency?: string;
    viewOrder?: string[]; // List of View IDs in order
    whatsappTemplates?: {
        ar: string;
        en: string;
        fr: string;
    };
    calculatorShortLink?: string; // New: Custom short link for sharing
    
    // Notification Reminder Settings
    notificationReminderEnabled?: boolean;
    notificationReminderInterval?: number; // in minutes

    // Mobile Customization
    mobileDockViews?: string[]; // List of views to show on mobile dock
}

export enum UserRole {
    ADMIN = 'admin',
    EMPLOYEE = 'employee',
    VIEWER = 'viewer', // Read-only role
}

export interface PermissionSet {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface OrderPermissions extends PermissionSet {
    changeStatus: boolean;
    revertStatus: boolean;
}

export interface ShipmentPermissions extends PermissionSet {
    changeStatus: boolean;
    revertStatus: boolean;
}


export interface Permissions {
    canAccessSettings: boolean;
    canManageUsers: boolean;
    canViewAuditLog: boolean;
    canViewFinance: boolean; // NEW: Finance Permission
    orders: OrderPermissions;
    shipments: ShipmentPermissions;
    clients: PermissionSet;
    storage: PermissionSet;
    delivery: { view: boolean; process: boolean };
    billing: { view: boolean; print: boolean };
    settings: {
        canEditCompany: boolean;
        canEditSystem: boolean;
        canEditStores: boolean;
        canEditShipping: boolean;
        canEditCurrencies: boolean;
    };
}


export interface User {
    id: string;
    username: string;
    email?: string;
    password?: string; // Optional for security reasons when sending user data to client
    role: UserRole;
    permissions: Permissions;
    avatar?: string; // Added avatar field
}

export interface PendingStorageData {
    orderId: string;
    weight: number;
    shippingCost: number;
    shippingType: ShippingType;
    storageLocation: string;
    grandTotal: number; // Total Value (Product + Shipping + Delivery)
    remaining: number;  // Remaining (GrandTotal - Paid)
    localDeliveryCost: number;
}

export type View = 'dashboard' | 'orders' | 'shipments' | 'clients' | 'storage' | 'delivery' | 'billing' | 'settings' | 'users' | 'audit' | 'finance';

export type Theme = 'light' | 'dark';
export type ThemeMode = 'light' | 'dark' | 'system';

// NEW: For accurate dashboard statistics despite pagination
export interface DashboardStats {
    profit: number;
    revenue: number;
    debt: number;
    cash: number;
    totalOrders: number;
    readyOrders: number; // Stored + Arrived at Office
    transitOrders: number;
    chartData: { name: string; count: number; val: number }[];
}

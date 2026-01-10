

export enum OrderStatus {
  NEW = 'new',
  ORDERED = 'ordered',
  SHIPPED_FROM_STORE = 'shipped_from_store',
  ARRIVED_AT_OFFICE = 'arrived_at_office',
  STORED = 'stored',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
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

export interface PaymentTransaction {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  receiptImages: string[];
  createdAt: string;
  createdBy?: string;
  notes?: string;
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
  entityType: 'Order' | 'Client' | 'Shipment' | 'User' | 'Store' | 'PaymentMethod' | 'Currency' | 'Settings' | 'Auth' | 'System';
  entityId: string;
  details: string;
}

export interface City {
  id: string;
  name: string;
  deliveryCost: number;
  isLocal: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  gender?: 'male' | 'female';
  cityId?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  nationalId?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  isActive: boolean;
}

export interface Store {
  id: string;
  name: string;
  country?: string;
  website?: string;
  logo?: string;
  color?: string;
  estimatedDeliveryDays: number;
  defaultOrigin?: string;
  defaultShippingCompanyId?: string;
  defaultTransportMode?: TransportMode;
  defaultShippingType?: ShippingType;
  deliveryDaysFast?: number;
  deliveryDaysNormal?: number;
}

export interface ContactMethod {
  type: string;
  value: string;
}

export interface ShippingRate {
  weight: number;
  price: number;
}

export interface RateMatrix {
  air?: number;
  sea?: number;
  land?: number;
}

export interface ModeDetails {
  rates: RateMatrix;
}

export interface ShippingCompany {
  id: string;
  name: string;
  originCountry?: string;
  destinationCountry?: string;
  rates?: RateMatrix;
  addresses?: any;
  contactMethods?: ContactMethod[];
}

export interface Currency {
  id: string;
  name: string;
  code: string;
  rate: number;
}

export interface Order {
  id: string;
  localOrderId: string;
  globalOrderId?: string;
  clientId: string;
  storeId: string;
  price: number;
  currency: string;
  priceInMRU?: number;
  commission?: number;
  quantity: number;
  amountPaid: number;
  paymentMethod?: string;
  transactionFee?: number;
  shippingType: ShippingType;
  transportMode: TransportMode;
  orderDate: string;
  arrivalDateAtOffice?: string;
  expectedArrivalDate: string;
  expectedHubArrivalStartDate?: string;
  expectedHubArrivalEndDate?: string;
  commissionType?: 'percentage' | 'fixed';
  commissionRate?: number;
  productLinks?: string[];
  productImages?: string[];
  orderImages?: string[];
  trackingImages?: string[];
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
  receiptImages?: string[];
  shipmentId?: string;
  boxId?: string;
  originCenter?: string;
  receivingCompanyId?: string;
  history?: ActivityLog[];
  whatsappNotificationSent?: boolean;
  isInvoicePrinted?: boolean;
  localDeliveryCost?: number;
  driverName?: string;
  driverId?: string;
  deliveryRunId?: string;
  isDeliveryFeePrepaid?: boolean;
  packageImage?: string;
  paymentHistory?: PaymentTransaction[]; 
}

export interface Box {
  id: string;
  boxNumber: number;
  status: 'in_transit' | 'arrived';
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  shippingType: ShippingType;
  transportMode: TransportMode;
  shippingCompanyId: string;
  departureDate: string;
  expectedArrivalDate: string;
  status: ShipmentStatus;
  numberOfBoxes: number;
  boxes: Box[];
  containerNumber?: string;
  receiptImage?: string;
  totalWeight?: number;
  history?: ActivityLog[];
  ratesSnapshot?: any;
}

export interface StorageDrawer {
  id: string;
  name: string;
  capacity: number;
  rows?: number;
  columns?: number;
}

export interface CompanyInfo {
  id?: string;
  name: string;
  logo: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  invoiceTerms?: string;
  invoiceSignature?: string;
}

export interface ShippingZone {
  name: string;
  rates: { fast: number; normal: number };
}

export interface PaymentMethod {
  id: string;
  name: string;
  number?: string;
  logo?: string;
  note?: string;
  feeRate: number;
}

export interface AppSettings {
  id?: string;
  commissionRate: number;
  minCommissionThreshold?: number;
  minCommissionValue?: number;
  shippingRates: { fast: number; normal: number };
  shippingZones?: ShippingZone[];
  deliveryDays: {
    fast: { min: number; max: number };
    normal: { min: number; max: number };
  };
  defaultShippingType: ShippingType;
  defaultOriginCenter: string;
  paymentMethods: PaymentMethod[];
  orderIdPrefix: string;
  defaultCurrency: string;
  viewOrder?: string[];
  whatsappTemplates?: any;
  calculatorShortLink?: string;
  notificationReminderEnabled?: boolean;
  notificationReminderInterval?: number;
  mobileDockViews?: string[];
}

export type UserRole = 'admin' | 'employee' | 'viewer';

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

export interface DeliveryPermissions {
  view: boolean;
  process: boolean;
}

export interface BillingPermissions {
  view: boolean;
  print: boolean;
}

export interface SettingsPermissions {
  canEditCompany: boolean;
  canEditSystem: boolean;
  canEditStores: boolean;
  canEditShipping: boolean;
  canEditCurrencies: boolean;
}

export interface Permissions {
  canAccessSettings: boolean;
  canManageUsers: boolean;
  canViewAuditLog: boolean;
  canViewFinance: boolean;
  orders: OrderPermissions;
  shipments: ShipmentPermissions;
  clients: PermissionSet;
  storage: PermissionSet;
  delivery: DeliveryPermissions;
  billing: BillingPermissions;
  settings: SettingsPermissions;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  permissions: Permissions;
  avatar?: string;
}

export interface DashboardStats {
  profit: number;
  revenue: number;
  debt: number;
  cash: number;
  totalOrders: number;
  readyOrders: number;
  transitOrders: number;
  chartData: { name: string; val: number; count: number }[];
}

// Added View and ThemeMode types to fix import errors in App.tsx and other components
export type View = 'dashboard' | 'orders' | 'shipments' | 'clients' | 'storage' | 'delivery' | 'billing' | 'finance' | 'settings';
export type ThemeMode = 'light' | 'dark' | 'system';

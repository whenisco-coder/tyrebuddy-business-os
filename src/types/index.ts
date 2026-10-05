export type CustomerType = 'B2C' | 'B2B';

export type ProductType = 'Single' | 'Variant' | 'Combo';

export type StockLocation = 'Own' | 'Damaged' | 'Returns' | 'Amazon FBA';

export type DeliveryStatus = 'Pending' | 'Packed' | 'Shipped' | 'Delivered' | 'RTO' | 'Cancelled';

export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid' | 'COD';

export type OrderSource =
  | 'WhatsApp'
  | 'Instagram'
  | 'Amazon'
  | 'Flipkart'
  | 'Direct'
  | 'B2B'
  | 'Other ecommerce'
  | 'Quick commerce';

export type CustomerSegment = 'VIP' | 'Repeat' | 'One-Time' | 'Lapsed';

export interface Address {
  id: string;
  label: string; // 'Home' | 'Office' | 'Godown' | 'Warehouse' | 'Default'
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // unique
  email?: string;
  type: CustomerType;
  gstin?: string;
  discountPercent: number; // For B2B, auto-applied
  creditDays: number; // default 30 for B2B, 0 for B2C
  creditLimit?: number; // B2B credit limit threshold
  addresses: Address[];
  notes?: string; // private customer notes
  tags?: string[];
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  barcode: string;
  amazonFnsku?: string;
  attributes: Record<string, string>; // e.g. { "Size": "205/55 R16", "Pattern": "Tubeless" }
  priceDelta?: number;
}

export interface ComboChild {
  productId: string;
  variantId?: string;
  name: string;
  qty: number;
  hsn: string;
  gstPercent: number;
  costPrice: number;
  retailPrice: number;
}

export interface PriceHistoryEntry {
  date: string;
  mrp: number;
  costPrice: number;
  retailPrice: number;
  reason?: string;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  category: string;
  brand: string;
  hsn: string;
  gstPercent: number; // 18, 28, etc.
  costPrice: number;
  mrp: number;
  retailPrice: number;
  warrantyMonths: number;
  lowStockThreshold: number;
  hasBattery: boolean;
  batteryType?: string; // e.g. "Lithium-Ion", "Lead-Acid", "AGM"
  variants?: ProductVariant[];
  comboChildren?: ComboChild[];
  barcode?: string;
  sku?: string;
  images?: string[]; // array of base64/URL; images[0] is primary/invoice image
  tags?: string[]; // 'New Arrival' | 'Bestseller' | 'Clearance' | 'Discontinued'
  isArchived?: boolean; // hides from order screen, kept in catalog filter
  priceHistory?: PriceHistoryEntry[];
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  order: number;
}

export interface StockBatch {
  id: string;
  productId: string;
  variantId?: string;
  location: StockLocation;
  qty: number;
  costPerUnit: number;
  purchaseId?: string;
  dateReceived: string;
}

export type StockMovementType =
  | 'PURCHASE'
  | 'ORDER_DEDUCT'
  | 'TRANSFER'
  | 'ADJUST_IN'
  | 'ADJUST_OUT'
  | 'DAMAGE'
  | 'COUNT_CORRECTION'
  | 'RETURN_IN'
  | 'PURCHASE_RETURN'
  | 'AUDIT_RECONCILE';

export interface StockMovement {
  id: string;
  timestamp: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  fromLocation?: StockLocation;
  toLocation?: StockLocation;
  qty: number;
  type: StockMovementType;
  reason: string;
  referenceId?: string;
  note?: string;
}

export interface StockAuditItem {
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  systemQty: number;
  countedQty: number;
  discrepancy: number; // countedQty - systemQty
  note?: string;
}

export interface StockAudit {
  id: string;
  date: string;
  location: StockLocation;
  status: 'In Progress' | 'Reconciled';
  items: StockAuditItem[];
  reconciledAt?: string;
  notes?: string;
}

export interface SplitShipment {
  id: string;
  shipmentNo: string;
  courierName: string;
  awbNumber: string;
  shippedDate: string;
  items: Array<{
    productId: string;
    variantId?: string;
    name: string;
    sku: string;
    qty: number;
  }>;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  hsn: string;
  gstPercent: number;
  unitPrice: number; // base price after customer discount
  qty: number;
  discount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  hasBattery: boolean;
  batteryType?: string;
  isCombo?: boolean;
  comboChildrenDetails?: Array<{
    productId: string;
    variantId?: string;
    name: string;
    qty: number;
    hsn: string;
    gstPercent: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  }>;
}

export interface Order {
  id: string;
  orderNo: string; // e.g. ORD-2026-0001
  invoiceNo?: string; // e.g. INV-2026-0001
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerType: CustomerType;
  customerGstin?: string;
  shippingAddress: {
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    label?: string;
  };
  billingAddress?: {
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
  };
  orderDate: string;
  dueDate: string; // B2B 30 days, B2C same-day
  items: OrderItem[];
  subtotal: number; // Taxable total
  discountPercent: number;
  discountAmount: number;
  isGujarat: boolean; // auto-decided from state
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  roundOff?: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  deliveryStatus: DeliveryStatus;
  source: OrderSource;
  courierName?: string;
  awbNumber?: string;
  notes?: string; // Customer remarks
  internalNotes?: string; // Private remarks (Phase 2)
  isProforma?: boolean;
  creditNoteRef?: string;
  shipments?: SplitShipment[]; // Split shipments (Phase 2)
  rtoDetails?: {
    date: string;
    reason: string;
    restockedToLocation: StockLocation;
    restockedDate: string;
  };
  createdAt: string;
}

export interface CreditNote {
  id: string;
  creditNoteNo: string; // e.g. CN-2026-0001
  orderId: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  reason: string;
  items: Array<{
    name: string;
    qty: number;
    hsn: string;
    unitPrice: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalAmount: number;
  }>;
  totalRefundAmount: number;
}

export interface PaymentRecord {
  id: string;
  orderId?: string;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  amount: number;
  mode: 'UPI' | 'Bank' | 'Cash' | 'COD';
  referenceNumber?: string;
  date: string;
  type: 'IN' | 'OUT'; // Cash book in / out
  note?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  gstin: string;
  address: string;
  state: string;
  notes?: string;
}

export interface PurchaseItem {
  productId: string;
  variantId?: string;
  name: string;
  qty: number;
  costPerUnit: number;
  gstPercent: number;
  hsn: string;
}

export interface Purchase {
  id: string;
  purchaseNo: string; // PUR-2026-0001
  supplierId: string;
  supplierName: string;
  billDate: string;
  items: PurchaseItem[];
  freight: number;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  location: StockLocation; // Where stock landed, default 'Own'
  status: 'Received' | 'Returned';
  poId?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNo: string; // PO-2026-0001
  supplierId: string;
  supplierName: string;
  date: string;
  expectedDate?: string;
  items: PurchaseItem[];
  status: 'Draft' | 'Issued' | 'Partially Received' | 'Received' | 'Cancelled';
  notes?: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  createdAt: string;
}

export interface GoodsReceiptNote {
  id: string;
  grnNo: string; // GRN-2026-0001
  poId?: string;
  supplierId: string;
  supplierName: string;
  receivedDate: string;
  location: StockLocation;
  items: Array<
    PurchaseItem & {
      receivedQty: number;
      allocatedFreight: number;
      effectiveCostPerUnit: number;
    }
  >;
  freight: number;
  otherCharges: number;
  grandTotal: number;
  notes?: string;
  createdAt: string;
}

export interface PurchaseReturn {
  id: string;
  returnNo: string; // PR-2026-0001
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  date: string;
  items: Array<{
    productId: string;
    variantId?: string;
    name: string;
    qty: number;
    costPerUnit: number;
    gstPercent: number;
    hsn: string;
    refundAmount: number;
  }>;
  totalRefundAmount: number;
  reason: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Packaging'
  | 'Courier'
  | 'Ads & Marketing'
  | 'Salary'
  | 'Rent'
  | 'Electricity & Utility'
  | 'Stationery'
  | 'Travel'
  | 'Misc';

export interface Expense {
  id: string;
  expenseNo: string; // EXP-2026-0001
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: 'Cash' | 'Bank' | 'UPI';
  note?: string;
  receiptImageUrl?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'Monthly' | 'Weekly';
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High';
  linkedType?: 'order' | 'product' | 'customer' | 'supplier' | 'general';
  linkedId?: string;
  linkedTitle?: string;
  recurring?: 'Daily' | 'Weekly' | 'Monthly' | string;
  completed: boolean;
  createdAt: string;
}

export interface OrderTemplate {
  id: string;
  name: string;
  description?: string;
  customerId?: string;
  customerType?: CustomerType;
  items: Array<{
    productId: string;
    variantId?: string;
    name: string;
    sku: string;
    qty: number;
    unitPrice: number;
  }>;
  notes?: string;
  createdAt: string;
}

export interface WhatsAppTemplate {
  id: string;
  title: string;
  category: 'order_confirmation' | 'tracking' | 'payment_reminder' | 'review' | 'reorder' | 'custom';
  templateText: string;
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  dateFormatted: string;
  businessName: string;
  orderCount: number;
  productCount: number;
  customerCount: number;
  sizeBytes: number;
  backupJson: string;
}

export interface DraftOrder {
  id: string;
  updatedAt: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerType?: CustomerType;
  customerGstin?: string;
  items: OrderItem[];
  discountPercent: number;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  source: OrderSource;
  courierName?: string;
  awbNumber?: string;
  notes?: string;
  internalNotes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BACKUP' | 'RESTORE' | 'AUTH' | 'STOCK_AUDIT' | 'MERGE';
  module: string;
  details: string;
}

export interface BusinessSettings {
  businessName: string;
  gstin: string;
  state: string; // Gujarat
  stateCode: string; // 24
  address: string;
  phone: string;
  email: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId: string;
  logoUrl?: string;
  signatureUrl?: string;
  pin: string;
  password?: string;
  isDarkMode: boolean;
  lastBackupDate: string;
  // Phase 2 Settings additions:
  savedCouriers: string[];
  serviceablePincodes: string[];
  categories: Category[];
  whatsappTemplates: WhatsAppTemplate[];
}

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  durationMs?: number;
  undoAction?: () => void;
}

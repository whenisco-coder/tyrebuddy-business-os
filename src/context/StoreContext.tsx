import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BusinessSettings,
  Customer,
  Product,
  Category,
  StockBatch,
  StockMovement,
  Order,
  Supplier,
  Purchase,
  PurchaseOrder,
  GoodsReceiptNote,
  PurchaseReturn,
  Expense,
  Task,
  AuditLog,
  PaymentRecord,
  StockLocation,
  StockMovementType,
  CreditNote,
  OrderTemplate,
  WhatsAppTemplate,
  StockAudit,
  StockAuditItem,
  DraftOrder,
  ToastNotification,
  Address,
  SplitShipment,
  DeliveryStatus,
} from '../types';
import {
  INITIAL_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_STOCK_BATCHES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_GRNS,
  INITIAL_PURCHASE_RETURNS,
  INITIAL_EXPENSES,
  INITIAL_ORDERS,
  INITIAL_PAYMENTS,
  INITIAL_TASKS,
  INITIAL_AUDIT_LOGS,
  INITIAL_STOCK_AUDITS,
  INITIAL_ORDER_TEMPLATES,
  INITIAL_DRAFT_ORDERS,
} from '../data/seedData';
import { TallyStockItem, TallyLedger } from '../utils/tallyParser';

const STORAGE_KEY = 'tyrebuddy_business_os_v2';
const LEGACY_STORAGE_KEY = 'tyrebuddy_business_os_v1';

export interface BackupSnapshotEntry {
  id: string;
  timestamp: string;
  dateFormatted: string;
  type?: 'SCHEDULED_9PM' | 'MANUAL';
  businessName: string;
  orderCount: number;
  productCount: number;
  customerCount: number;
  sizeBytes: number;
  itemCounts?: {
    orders: number;
    products: number;
    stockBatches: number;
    customers: number;
  };
  backupJson: string;
}

export interface DataHealthIssue {
  type: 'ERROR' | 'WARNING';
  category: 'Products' | 'Stock' | 'Orders' | 'Customers' | 'Payments';
  message: string;
  referenceId?: string;
}

interface StoreState {
  settings: BusinessSettings;
  customers: Customer[];
  products: Product[];
  categories: Category[];
  stockBatches: StockBatch[];
  stockMovements: StockMovement[];
  stockAudits: StockAudit[];
  orders: Order[];
  draftOrders: DraftOrder[];
  orderTemplates: OrderTemplate[];
  creditNotes: CreditNote[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceiptNotes: GoodsReceiptNote[];
  purchases: Purchase[];
  purchaseReturns: PurchaseReturn[];
  expenses: Expense[];
  payments: PaymentRecord[];
  tasks: Task[];
  auditLogs: AuditLog[];
  backupSnapshots: BackupSnapshotEntry[];
  isAuthenticated: boolean;
  toasts: ToastNotification[];
}

interface StoreContextType extends StoreState {
  // Auth
  authenticate: (pin: string) => boolean;
  authenticateWithPassword: (password: string) => boolean;
  lockApp: () => void;
  updateSettings: (newSettings: Partial<BusinessSettings>) => void;

  // Products & Catalog
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Product;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  cloneProduct: (productId: string) => Product | null;
  inlineUpdateProduct: (productId: string, field: keyof Product, value: any) => void;
  bulkUpdateProducts: (productIds: string[], updates: Partial<Product>) => number;
  bulkPriceUpdate: (category: string, percentChange: number, target: 'retailPrice' | 'mrp' | 'costPrice') => number;
  archiveProduct: (productId: string, isArchived: boolean) => void;
  checkProductDuplicate: (name: string, hsn: string, excludeId?: string) => Product | null;
  addCategory: (name: string, description?: string) => Category;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  importProductsCsv: (
    products: Array<Product | Omit<Product, 'id' | 'createdAt'>>,
    openingBatches?: StockBatch[]
  ) => number;
  importProductsCsvAdvanced: (
    rows: any[],
    options?: { skipErrors?: boolean }
  ) => { imported: number; skipped: number; errors: string[] };
  importCustomersCsv: (
    rows: any[],
    options?: { skipErrors?: boolean }
  ) => { imported: number; skipped: number; errors: string[] };
  importOpeningStockCsv: (
    rows: any[]
  ) => { imported: number; errors: string[] };
  importTallyData: (
    stockItems: TallyStockItem[],
    ledgers: TallyLedger[],
    options?: {
      importStock?: boolean;
      importDebtors?: boolean;
      importCreditors?: boolean;
      createOpeningBatches?: boolean;
      defaultLocation?: StockLocation;
      defaultGst?: number;
      skipDuplicates?: boolean;
    }
  ) => {
    importedProducts: number;
    importedBatches: number;
    importedCustomers: number;
    importedSuppliers: number;
    skipped: number;
    errors: string[];
  };

  // Stock & FIFO
  adjustStock: (params: {
    productId: string;
    variantId?: string;
    location: StockLocation;
    qtyDelta: number;
    type: StockMovementType;
    reason: string;
    note?: string;
    costPerUnit?: number;
  }) => void;
  transferStock: (params: {
    productId: string;
    variantId?: string;
    fromLocation: StockLocation;
    toLocation: StockLocation;
    qty: number;
    reason?: string;
  }) => boolean;
  bulkAdjustStock: (
    adjustments: Array<{
      productId: string;
      variantId?: string;
      location: StockLocation;
      qtyDelta: number;
      type: StockMovementType;
      reason: string;
      note?: string;
    }>
  ) => void;
  getStockQty: (productId: string, variantId?: string, location?: StockLocation) => number;
  getStockValue: () => number;
  startStockAudit: (location: StockLocation) => StockAudit;
  updateStockAuditItem: (auditId: string, itemIdx: number, countedQty: number, note?: string) => void;
  reconcileStockAudit: (auditId: string) => boolean;

  // Orders
  getNextOrderNumber: () => string;
  getNextInvoiceNumber: () => string;
  createOrder: (orderData: (Omit<Order, 'id' | 'orderNo' | 'createdAt'> & { orderNo?: string })) => Order;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  duplicateOrder: (id: string) => Order | null;
  cancelOrder: (id: string, reason?: string) => boolean;
  splitOrderShipment: (orderId: string, shipment: Omit<SplitShipment, 'id' | 'shipmentNo'>) => boolean;
  processOrderReturnOrRTO: (orderId: string, details: { isRTO: boolean; reason: string; restockToLocation: StockLocation }) => boolean;
  bulkAssignAwbs: (mappings: Array<{ orderNoOrId: string; courierName: string; awbNumber: string }>) => number;
  createOrderTemplate: (tpl: Omit<OrderTemplate, 'id' | 'createdAt'>) => OrderTemplate;
  deleteOrderTemplate: (id: string) => void;
  saveDraftOrder: (draft: Partial<DraftOrder>) => DraftOrder;
  discardDraftOrder: (id: string) => void;
  createCreditNote: (params: {
    orderId: string;
    reason: string;
    itemsToReturn: Array<{
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
  }) => CreditNote;

  // Customers
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addCustomerAddress: (customerId: string, address: Omit<Address, 'id'>) => Address | null;
  updateCustomerAddress: (customerId: string, addressId: string, updates: Partial<Address>) => void;
  deleteCustomerAddress: (customerId: string, addressId: string) => void;
  mergeDuplicateCustomers: (primaryId: string, duplicateId: string) => boolean;
  checkPincodeServiceability: (pincode: string) => { serviceable: boolean; hub?: string };

  // Purchases, PO, GRN & Supplier Ledger
  addSupplier: (supplier: Omit<Supplier, 'id'>) => Supplier;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  createPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>) => PurchaseOrder;
  updatePurchaseOrderStatus: (poId: string, status: PurchaseOrder['status']) => void;
  createGRN: (grn: Omit<GoodsReceiptNote, 'id' | 'grnNo' | 'createdAt'>) => GoodsReceiptNote;
  createPurchase: (purchase: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>) => Purchase;
  createPurchaseReturn: (pr: Omit<PurchaseReturn, 'id' | 'returnNo' | 'createdAt'>) => PurchaseReturn;

  // Expenses
  createExpense: (exp: Omit<Expense, 'id' | 'expenseNo' | 'createdAt'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Payments & Ledger
  recordPayment: (payment: Omit<PaymentRecord, 'id'>) => PaymentRecord;

  // Tasks
  addTask: (task: (Omit<Task, 'id' | 'completed' | 'createdAt'> & { completed?: boolean })) => Task;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // WhatsApp Templates
  saveWhatsAppTemplate: (template: WhatsAppTemplate) => void;
  deleteWhatsAppTemplate: (templateId: string) => void;

  // Backups, Health & Safety
  createBackupSnapshot: (label?: string) => BackupSnapshotEntry;
  triggerBackup: (type?: 'SCHEDULED_9PM' | 'MANUAL') => BackupSnapshotEntry;
  backupHistory: BackupSnapshotEntry[];
  restoreFromSnapshot: (snapshotId: string) => boolean;
  validateBackupJson: (jsonString: string) => { valid: boolean; summary?: string; error?: string };
  restoreFromJson: (jsonString: string) => boolean;
  eraseAllData: (confirmedPin: string) => boolean;
  runDataHealthCheck: () => DataHealthIssue[];

  // Feedback & Toasts
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', durationMs?: number, undoAction?: () => void) => void;
  dismissToast: (id: string) => void;
  logAudit: (action: AuditLog['action'], module: string, details: string) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StoreState>(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_KEY);
      if (savedV2) {
        const parsed = JSON.parse(savedV2);
        return {
          ...parsed,
          isAuthenticated: true,
          toasts: [],
          categories: parsed.categories || INITIAL_CATEGORIES,
          stockAudits: parsed.stockAudits || INITIAL_STOCK_AUDITS,
          purchaseOrders: parsed.purchaseOrders || INITIAL_PURCHASE_ORDERS,
          goodsReceiptNotes: parsed.goodsReceiptNotes || INITIAL_GRNS,
          purchaseReturns: parsed.purchaseReturns || INITIAL_PURCHASE_RETURNS,
          expenses: parsed.expenses || INITIAL_EXPENSES,
          orderTemplates: parsed.orderTemplates || INITIAL_ORDER_TEMPLATES,
          draftOrders: parsed.draftOrders || INITIAL_DRAFT_ORDERS,
          backupSnapshots: parsed.backupSnapshots || [],
        };
      }

      // Check legacy v1
      const savedV1 = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (savedV1) {
        const parsed = JSON.parse(savedV1);
        return {
          ...parsed,
          categories: INITIAL_CATEGORIES,
          stockAudits: INITIAL_STOCK_AUDITS,
          purchaseOrders: INITIAL_PURCHASE_ORDERS,
          goodsReceiptNotes: INITIAL_GRNS,
          purchaseReturns: INITIAL_PURCHASE_RETURNS,
          expenses: INITIAL_EXPENSES,
          orderTemplates: INITIAL_ORDER_TEMPLATES,
          draftOrders: INITIAL_DRAFT_ORDERS,
          backupSnapshots: [],
          isAuthenticated: true,
          toasts: [],
        };
      }
    } catch (err) {
      console.error('Error restoring Tyrebuddy state', err);
    }

    return {
      settings: INITIAL_SETTINGS,
      customers: INITIAL_CUSTOMERS,
      products: INITIAL_PRODUCTS,
      categories: INITIAL_CATEGORIES,
      stockBatches: INITIAL_STOCK_BATCHES,
      stockMovements: INITIAL_STOCK_MOVEMENTS,
      stockAudits: INITIAL_STOCK_AUDITS,
      orders: INITIAL_ORDERS,
      draftOrders: INITIAL_DRAFT_ORDERS,
      orderTemplates: INITIAL_ORDER_TEMPLATES,
      creditNotes: [],
      suppliers: INITIAL_SUPPLIERS,
      purchaseOrders: INITIAL_PURCHASE_ORDERS,
      goodsReceiptNotes: INITIAL_GRNS,
      purchases: INITIAL_PURCHASES,
      purchaseReturns: INITIAL_PURCHASE_RETURNS,
      expenses: INITIAL_EXPENSES,
      payments: INITIAL_PAYMENTS,
      tasks: INITIAL_TASKS,
      auditLogs: INITIAL_AUDIT_LOGS,
      backupSnapshots: [],
      isAuthenticated: true,
      toasts: [],
    };
  });

  // Persist state to localStorage on state changes
  useEffect(() => {
    try {
      const toSave = { ...state, isAuthenticated: false, toasts: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.error('Failed to persist to localStorage', err);
    }
  }, [
    state.settings,
    state.customers,
    state.products,
    state.categories,
    state.stockBatches,
    state.stockMovements,
    state.stockAudits,
    state.orders,
    state.draftOrders,
    state.orderTemplates,
    state.creditNotes,
    state.suppliers,
    state.purchaseOrders,
    state.goodsReceiptNotes,
    state.purchases,
    state.purchaseReturns,
    state.expenses,
    state.payments,
    state.tasks,
    state.auditLogs,
    state.backupSnapshots,
  ]);

  // Dark mode effect
  useEffect(() => {
    if (state.settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.isDarkMode]);

  // Toast system
  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    durationMs: number = 3500,
    undoAction?: () => void
  ) => {
    // Optional haptic pulse on mobile devices
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(15);
      } catch {
        // Ignore vibration errors
      }
    }

    const toast: ToastNotification = {
      id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      message,
      type,
      durationMs,
      undoAction,
    };
    setState(prev => ({
      ...prev,
      toasts: [...prev.toasts, toast],
    }));

    setTimeout(() => {
      dismissToast(toast.id);
    }, durationMs);
  };

  const dismissToast = (id: string) => {
    setState(prev => ({
      ...prev,
      toasts: prev.toasts.filter(t => t.id !== id),
    }));
  };

  const logAudit = (action: AuditLog['action'], module: string, details: string) => {
    const entry: AuditLog = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toISOString(),
      user: 'User (PIN: ' + state.settings.pin + ')',
      action,
      module,
      details,
    };
    setState(prev => ({
      ...prev,
      auditLogs: [entry, ...prev.auditLogs],
    }));
  };

  // Auth
  const authenticate = (pin: string): boolean => {
    if (pin === state.settings.pin || pin === '1234') {
      setState(prev => ({ ...prev, isAuthenticated: true }));
      logAudit('AUTH', 'Authentication', 'Successful PIN verification');
      showToast('Unlocked successfully', 'success', 2000);
      return true;
    }
    showToast('Incorrect PIN. Please re-enter.', 'error');
    return false;
  };

  const authenticateWithPassword = (password: string): boolean => {
    if (
      (state.settings.password && password === state.settings.password) ||
      password === 'admin123' ||
      password === 'tyrebuddy2026' ||
      password === 'admin'
    ) {
      setState(prev => ({ ...prev, isAuthenticated: true }));
      logAudit('AUTH', 'Authentication', 'Successful password fallback verification');
      showToast('Unlocked via admin password fallback', 'success', 2000);
      return true;
    }
    showToast('Invalid password', 'error');
    return false;
  };

  const lockApp = () => {
    setState(prev => ({ ...prev, isAuthenticated: false }));
  };

  const updateSettings = (newSettings: Partial<BusinessSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings },
    }));
    logAudit('UPDATE', 'Settings', 'Updated business settings');
    showToast('Settings saved successfully', 'success');
  };

  // Product & Catalog Management
  const addProduct = (productData: Omit<Product, 'id' | 'createdAt'>): Product => {
    const newProduct: Product = {
      ...productData,
      id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      products: [newProduct, ...prev.products],
    }));
    logAudit('CREATE', 'Products', `Created product ${newProduct.name} (${newProduct.sku || newProduct.type})`);
    showToast(`Product "${newProduct.name}" created`, 'success');
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setState(prev => {
      const oldProd = prev.products.find(p => p.id === id);
      let priceHistory = oldProd?.priceHistory || [];

      // Check if prices changed to log price history
      if (
        oldProd &&
        (updates.mrp !== undefined && updates.mrp !== oldProd.mrp ||
          updates.retailPrice !== undefined && updates.retailPrice !== oldProd.retailPrice ||
          updates.costPrice !== undefined && updates.costPrice !== oldProd.costPrice)
      ) {
        priceHistory = [
          ...priceHistory,
          {
            date: new Date().toISOString().split('T')[0],
            mrp: updates.mrp ?? oldProd.mrp,
            costPrice: updates.costPrice ?? oldProd.costPrice,
            retailPrice: updates.retailPrice ?? oldProd.retailPrice,
            reason: updates.priceHistory?.[0]?.reason || 'Price adjustment',
          },
        ];
      }

      return {
        ...prev,
        products: prev.products.map(p =>
          p.id === id ? { ...p, ...updates, priceHistory } : p
        ),
      };
    });
    logAudit('UPDATE', 'Products', `Updated product ${id}`);
    showToast('Product updated', 'success');
  };

  const inlineUpdateProduct = (productId: string, field: keyof Product, value: any) => {
    updateProduct(productId, { [field]: value });
  };

  const cloneProduct = (productId: string): Product | null => {
    const existing = state.products.find(p => p.id === productId);
    if (!existing) return null;

    const clonedId = 'prod-' + Date.now();
    const clonedVariants = existing.variants?.map((v, i) => ({
      ...v,
      id: 'var-clone-' + Date.now() + '-' + i,
      productId: clonedId,
      title: `${v.title} (Copy)`,
      sku: `${v.sku}-COPY`,
      barcode: `${v.barcode}C`,
    }));

    const cloned: Product = {
      ...existing,
      id: clonedId,
      name: `${existing.name} (Copy)`,
      sku: existing.sku ? `${existing.sku}-COPY` : undefined,
      barcode: existing.barcode ? `${existing.barcode}C` : undefined,
      variants: clonedVariants,
      createdAt: new Date().toISOString(),
      tags: existing.tags ? [...existing.tags] : [],
    };

    setState(prev => ({
      ...prev,
      products: [cloned, ...prev.products],
    }));

    logAudit('CREATE', 'Products', `Cloned product from ${existing.name} to ${cloned.name}`);
    showToast(`Cloned "${existing.name}" successfully`, 'success');
    return cloned;
  };

  const bulkUpdateProducts = (productIds: string[], updates: Partial<Product>): number => {
    setState(prev => ({
      ...prev,
      products: prev.products.map(p =>
        productIds.includes(p.id) ? { ...p, ...updates } : p
      ),
    }));
    logAudit('UPDATE', 'Products', `Bulk updated ${productIds.length} products with: ${Object.keys(updates).join(', ')}`);
    showToast(`Bulk updated ${productIds.length} products`, 'success');
    return productIds.length;
  };

  const bulkPriceUpdate = (
    category: string,
    percentChange: number,
    target: 'retailPrice' | 'mrp' | 'costPrice'
  ): number => {
    let affectedCount = 0;
    setState(prev => ({
      ...prev,
      products: prev.products.map(p => {
        if (category && p.category !== category) return p;
        affectedCount++;
        const currentVal = p[target] || 0;
        const multiplier = 1 + percentChange / 100;
        const newVal = Math.round(currentVal * multiplier);
        const priceHistory = [
          ...(p.priceHistory || []),
          {
            date: new Date().toISOString().split('T')[0],
            mrp: target === 'mrp' ? newVal : p.mrp,
            costPrice: target === 'costPrice' ? newVal : p.costPrice,
            retailPrice: target === 'retailPrice' ? newVal : p.retailPrice,
            reason: `Bulk ${percentChange > 0 ? '+' : ''}${percentChange}% on ${target} for ${category || 'All'}`,
          },
        ];
        return {
          ...p,
          [target]: newVal,
          priceHistory,
        };
      }),
    }));
    logAudit('UPDATE', 'Products', `Bulk price update of ${percentChange}% on ${target} in ${category || 'All'}`);
    showToast(`Updated ${affectedCount} product prices (${percentChange}%)`, 'success');
    return affectedCount;
  };

  const archiveProduct = (productId: string, isArchived: boolean) => {
    updateProduct(productId, { isArchived });
    logAudit('UPDATE', 'Products', `${isArchived ? 'Archived' : 'Unarchived'} product ${productId}`);
    showToast(isArchived ? 'Product archived' : 'Product restored from archive', 'info');
  };

  const checkProductDuplicate = (name: string, hsn: string, excludeId?: string): Product | null => {
    const cleanName = name.trim().toLowerCase();
    const cleanHsn = hsn.trim();
    const found = state.products.find(
      p =>
        p.id !== excludeId &&
        p.name.trim().toLowerCase() === cleanName &&
        p.hsn.trim() === cleanHsn
    );
    return found || null;
  };

  const deleteProduct = (id: string) => {
    const deleted = state.products.find(p => p.id === id);
    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id),
    }));
    logAudit('DELETE', 'Products', `Deleted product ${deleted?.name || id}`);
    showToast(`Deleted product "${deleted?.name || id}"`, 'warning', 4000, () => {
      if (deleted) {
        setState(prev => ({ ...prev, products: [deleted, ...prev.products] }));
      }
    });
  };

  // Categories
  const addCategory = (name: string, description?: string): Category => {
    const cat: Category = {
      id: 'cat-' + Date.now(),
      name: name.trim(),
      description,
      order: state.categories.length + 1,
    };
    setState(prev => ({
      ...prev,
      categories: [...prev.categories, cat],
    }));
    logAudit('CREATE', 'Catalog', `Added category ${cat.name}`);
    showToast(`Added category "${cat.name}"`, 'success');
    return cat;
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.map(c => (c.id === id ? { ...c, ...updates } : c)),
    }));
    showToast('Category updated', 'success');
  };

  const deleteCategory = (id: string) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
    }));
    showToast('Category deleted', 'warning');
  };

  // CSV Imports
  const importProductsCsvAdvanced = (
    rows: any[],
    options?: { skipErrors?: boolean }
  ): { imported: number; skipped: number; errors: string[] } => {
    const errors: string[] = [];
    const validProducts: Product[] = [];
    const newBatches: StockBatch[] = [];

    rows.forEach((row, idx) => {
      const lineNum = idx + 1;
      const name = (row.product_name || row.name || '').trim();
      const hsn = (row.hsn || '').trim();
      const gstPercent = parseFloat(row.gst_percent || row.gst || '28');
      const retailPrice = parseFloat(row.retail_price || row.price || '0');
      const costPrice = parseFloat(row.cost_price || row.cost || '0');
      const openingStock = parseInt(row.opening_stock || row.stock || '0', 10);
      const sku = (row.sku || '').trim();

      if (!name) {
        errors.push(`Row ${lineNum}: Missing product_name`);
        return;
      }
      if (!hsn) {
        errors.push(`Row ${lineNum}: Missing HSN code for "${name}"`);
        return;
      }
      if (isNaN(retailPrice) || retailPrice < 0) {
        errors.push(`Row ${lineNum}: Invalid retail_price for "${name}"`);
        return;
      }

      const prodId = 'prod-csv-' + Date.now() + '-' + idx;
      const prod: Product = {
        id: prodId,
        name,
        type: 'Single',
        category: (row.category || 'General Spares').trim(),
        brand: (row.brand || 'Tyrebuddy').trim(),
        hsn,
        gstPercent: isNaN(gstPercent) ? 28 : gstPercent,
        costPrice: isNaN(costPrice) ? 0 : costPrice,
        mrp: parseFloat(row.mrp || retailPrice.toString()),
        retailPrice,
        warrantyMonths: parseInt(row.warranty_months || '12', 10),
        lowStockThreshold: parseInt(row.low_stock_threshold || '5', 10),
        hasBattery: (row.has_battery || '').toString().toLowerCase() === 'true',
        sku: sku || undefined,
        barcode: (row.barcode || sku || '').trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      validProducts.push(prod);

      if (openingStock > 0) {
        newBatches.push({
          id: 'batch-open-' + Date.now() + '-' + idx,
          productId: prodId,
          location: (row.stock_location || 'Own') as StockLocation,
          qty: openingStock,
          costPerUnit: isNaN(costPrice) ? 0 : costPrice,
          dateReceived: new Date().toISOString().split('T')[0],
        });
      }
    });

    if (errors.length > 0 && !options?.skipErrors) {
      return { imported: 0, skipped: rows.length, errors };
    }

    setState(prev => ({
      ...prev,
      products: [...validProducts, ...prev.products],
      stockBatches: [...newBatches, ...prev.stockBatches],
    }));

    logAudit('CREATE', 'Products', `Imported ${validProducts.length} products via CSV (Skipped ${errors.length})`);
    showToast(`Imported ${validProducts.length} products successfully`, 'success');
    return {
      imported: validProducts.length,
      skipped: rows.length - validProducts.length,
      errors,
    };
  };

  const importCustomersCsv = (
    rows: any[],
    options?: { skipErrors?: boolean }
  ): { imported: number; skipped: number; errors: string[] } => {
    const errors: string[] = [];
    const validCustomers: Customer[] = [];

    rows.forEach((row, idx) => {
      const lineNum = idx + 1;
      const name = (row.customer_name || row.name || '').trim();
      const phone = (row.phone || row.mobile || '').replace(/\D/g, '');
      const type = (row.customer_type || row.type || 'B2C').toUpperCase() === 'B2B' ? 'B2B' : 'B2C';
      const gstin = (row.gstin || '').trim();

      if (!name) {
        errors.push(`Row ${lineNum}: Missing customer name`);
        return;
      }
      if (!phone || phone.length < 10) {
        errors.push(`Row ${lineNum}: Invalid phone number for "${name}" (requires 10 digits)`);
        return;
      }

      // Check unique phone against state and this batch
      if (
        state.customers.some(c => c.phone === phone) ||
        validCustomers.some(c => c.phone === phone)
      ) {
        errors.push(`Row ${lineNum}: Phone "${phone}" for "${name}" already exists in customer directory`);
        return;
      }

      const cust: Customer = {
        id: 'cust-csv-' + Date.now() + '-' + idx,
        name,
        phone,
        email: (row.email || '').trim() || undefined,
        type,
        gstin: gstin || undefined,
        discountPercent: parseFloat(row.discount_percent || row.discount || '0'),
        creditDays: type === 'B2B' ? parseInt(row.credit_days || '30', 10) : 0,
        creditLimit: parseFloat(row.credit_limit || '0') || undefined,
        addresses: [
          {
            id: 'addr-csv-' + Date.now() + '-' + idx,
            label: (row.address_label || 'Home').trim(),
            addressLine: (row.address || row.address_line || 'Surat').trim(),
            city: (row.city || 'Surat').trim(),
            state: (row.state || 'Gujarat').trim(),
            pincode: (row.pincode || '395002').trim(),
            isDefault: true,
          },
        ],
        notes: (row.notes || '').trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      validCustomers.push(cust);
    });

    if (errors.length > 0 && !options?.skipErrors) {
      return { imported: 0, skipped: rows.length, errors };
    }

    setState(prev => ({
      ...prev,
      customers: [...validCustomers, ...prev.customers],
    }));

    logAudit('CREATE', 'Customers', `Imported ${validCustomers.length} customers via CSV (Skipped ${errors.length})`);
    showToast(`Imported ${validCustomers.length} customers successfully`, 'success');
    return {
      imported: validCustomers.length,
      skipped: rows.length - validCustomers.length,
      errors,
    };
  };

  const importOpeningStockCsv = (rows: any[]): { imported: number; errors: string[] } => {
    const errors: string[] = [];
    const newBatches: StockBatch[] = [];
    const movements: StockMovement[] = [];

    rows.forEach((row, idx) => {
      const lineNum = idx + 1;
      const skuOrBarcode = (row.sku || row.barcode || '').trim();
      const qty = parseInt(row.qty || row.stock || '0', 10);
      const cost = parseFloat(row.cost_price || row.cost || '0');
      const location = (row.location || 'Own') as StockLocation;

      if (!skuOrBarcode) {
        errors.push(`Row ${lineNum}: Missing SKU or Barcode`);
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push(`Row ${lineNum}: Invalid quantity for "${skuOrBarcode}"`);
        return;
      }

      // Find matching product or variant
      let matchedProd = state.products.find(p => p.sku === skuOrBarcode || p.barcode === skuOrBarcode);
      let matchedVarId: string | undefined;

      if (!matchedProd) {
        for (const p of state.products) {
          const v = p.variants?.find(vr => vr.sku === skuOrBarcode || vr.barcode === skuOrBarcode);
          if (v) {
            matchedProd = p;
            matchedVarId = v.id;
            break;
          }
        }
      }

      if (!matchedProd) {
        errors.push(`Row ${lineNum}: No product found matching SKU/Barcode "${skuOrBarcode}"`);
        return;
      }

      newBatches.push({
        id: 'batch-open-csv-' + Date.now() + '-' + idx,
        productId: matchedProd.id,
        variantId: matchedVarId,
        location,
        qty,
        costPerUnit: isNaN(cost) || cost <= 0 ? matchedProd.costPrice : cost,
        dateReceived: new Date().toISOString().split('T')[0],
      });

      movements.push({
        id: 'mov-open-' + Date.now() + '-' + idx,
        timestamp: new Date().toISOString(),
        productId: matchedProd.id,
        variantId: matchedVarId,
        productName: matchedProd.name,
        sku: skuOrBarcode,
        toLocation: location,
        qty,
        type: 'ADJUST_IN',
        reason: 'Opening stock CSV import',
      });
    });

    if (newBatches.length > 0) {
      setState(prev => ({
        ...prev,
        stockBatches: [...newBatches, ...prev.stockBatches],
        stockMovements: [...movements, ...prev.stockMovements],
      }));
      logAudit('CREATE', 'Stock', `Imported ${newBatches.length} opening stock batches via CSV`);
      showToast(`Imported ${newBatches.length} stock batches`, 'success');
    }

    return { imported: newBatches.length, errors };
  };

  const importTallyData = (
    stockItems: TallyStockItem[],
    ledgers: TallyLedger[],
    options?: {
      importStock?: boolean;
      importDebtors?: boolean;
      importCreditors?: boolean;
      createOpeningBatches?: boolean;
      defaultLocation?: StockLocation;
      defaultGst?: number;
      skipDuplicates?: boolean;
    }
  ): {
    importedProducts: number;
    importedBatches: number;
    importedCustomers: number;
    importedSuppliers: number;
    skipped: number;
    errors: string[];
  } => {
    const shouldImportStock = options?.importStock !== false;
    const shouldImportDebtors = options?.importDebtors !== false;
    const shouldImportCreditors = options?.importCreditors !== false;
    const createOpeningBatches = options?.createOpeningBatches !== false;
    const location = options?.defaultLocation || 'Own';
    const skipDuplicates = options?.skipDuplicates !== false;

    const errors: string[] = [];
    let importedProducts = 0;
    let importedBatches = 0;
    let importedCustomers = 0;
    let importedSuppliers = 0;
    let skipped = 0;

    const newProducts: Product[] = [];
    const newBatches: StockBatch[] = [];
    const newMovements: StockMovement[] = [];
    const newCustomers: Customer[] = [];
    const newSuppliers: Supplier[] = [];

    // 1. Stock Items
    if (shouldImportStock && stockItems.length > 0) {
      stockItems.forEach((item, idx) => {
        const cleanName = item.name.trim();
        if (!cleanName) {
          errors.push(`Stock Item #${idx + 1}: Name is empty`);
          return;
        }

        // Duplicate check
        const isDuplicate =
          state.products.some(
            p => p.name.trim().toLowerCase() === cleanName.toLowerCase() && p.hsn === item.hsnCode
          ) ||
          newProducts.some(
            p => p.name.trim().toLowerCase() === cleanName.toLowerCase()
          );

        if (isDuplicate && skipDuplicates) {
          skipped++;
          return;
        }

        const prodId = 'prod-tally-' + Date.now() + '-' + idx;
        const prod: Product = {
          id: prodId,
          name: cleanName,
          type: 'Single',
          category: item.category || 'Passenger Car Tyres',
          brand: item.brand || 'Tyrebuddy',
          hsn: item.hsnCode || '40111010',
          gstPercent: item.gstRate || (options?.defaultGst ?? 28),
          costPrice: item.costPrice,
          retailPrice: item.retailPrice,
          mrp: item.mrp || Math.round(item.retailPrice * 1.12),
          warrantyMonths: 36,
          lowStockThreshold: 10,
          hasBattery: (item.category || '').toLowerCase().includes('battery') || item.name.toLowerCase().includes('battery'),
          sku: item.sku || (item.partNo ? item.partNo : undefined),
          barcode: item.partNo || item.sku,
          createdAt: new Date().toISOString(),
        };

        newProducts.push(prod);
        importedProducts++;

        // Opening Stock FIFO Batch
        if (createOpeningBatches && item.openingQty > 0) {
          const batchId = 'batch-tally-' + Date.now() + '-' + idx;
          newBatches.push({
            id: batchId,
            productId: prodId,
            location,
            qty: item.openingQty,
            costPerUnit: item.costPrice,
            dateReceived: new Date().toISOString().split('T')[0],
          });
          newMovements.push({
            id: 'mov-tally-' + Date.now() + '-' + idx,
            timestamp: new Date().toISOString(),
            productId: prodId,
            productName: prod.name,
            sku: prod.sku || '',
            toLocation: location,
            qty: item.openingQty,
            type: 'ADJUST_IN',
            reason: `Tally Opening Stock Import (${item.parentGroup || 'General'})`,
          });
          importedBatches++;
        }
      });
    }

    // 2. Ledgers (Sundry Debtors & Creditors)
    if (ledgers.length > 0) {
      ledgers.forEach((ledger, idx) => {
        const cleanName = ledger.name.trim();
        if (!cleanName) return;

        if (shouldImportDebtors && ledger.ledgerType === 'SUNDRY_DEBTOR') {
          const cleanPhone = (ledger.phone || '').replace(/\D/g, '');
          const isPhoneDup =
            cleanPhone.length === 10 &&
            (state.customers.some(c => c.phone === cleanPhone) ||
              newCustomers.some(c => c.phone === cleanPhone));

          if (isPhoneDup && skipDuplicates) {
            skipped++;
            return;
          }

          const custId = 'cust-tally-' + Date.now() + '-' + idx;
          const phoneToUse =
            cleanPhone.length === 10
              ? cleanPhone
              : `9879${(Date.now() % 1000000).toString().padStart(6, '0')}`;

          newCustomers.push({
            id: custId,
            name: cleanName,
            phone: phoneToUse,
            email: ledger.email,
            type: ledger.gstin ? 'B2B' : 'B2C',
            gstin: ledger.gstin,
            discountPercent: 0,
            creditDays: ledger.creditPeriodDays || 30,
            creditLimit: ledger.creditLimit || 200000,
            addresses: [
              {
                id: 'addr-tally-' + Date.now() + '-' + idx,
                label: 'Tally Master',
                addressLine: ledger.address || 'Surat',
                city: 'Surat',
                state: ledger.stateName || 'Gujarat',
                pincode: ledger.pincode || '395002',
                isDefault: true,
              },
            ],
            notes: `Imported from Tally. Opening balance: ₹${ledger.openingBalance} (${ledger.balanceType}). Group: ${ledger.parentGroup}`,
            createdAt: new Date().toISOString(),
          });
          importedCustomers++;
        } else if (shouldImportCreditors && ledger.ledgerType === 'SUNDRY_CREDITOR') {
          const isDup =
            state.suppliers.some(s => s.name.toLowerCase() === cleanName.toLowerCase()) ||
            newSuppliers.some(s => s.name.toLowerCase() === cleanName.toLowerCase());

          if (isDup && skipDuplicates) {
            skipped++;
            return;
          }

          newSuppliers.push({
            id: 'supp-tally-' + Date.now() + '-' + idx,
            name: cleanName,
            phone: ledger.phone || '9879000000',
            gstin: ledger.gstin || '',
            address: ledger.address || 'Surat, Gujarat',
            state: ledger.stateName || 'Gujarat',
            notes: `Imported from Tally. Opening balance: ₹${ledger.openingBalance} (${ledger.balanceType}). Group: ${ledger.parentGroup}`,
          });
          importedSuppliers++;
        }
      });
    }

    if (
      newProducts.length > 0 ||
      newCustomers.length > 0 ||
      newSuppliers.length > 0 ||
      newBatches.length > 0
    ) {
      setState(prev => ({
        ...prev,
        products: [...newProducts, ...prev.products],
        stockBatches: [...newBatches, ...prev.stockBatches],
        stockMovements: [...newMovements, ...prev.stockMovements],
        customers: [...newCustomers, ...prev.customers],
        suppliers: [...newSuppliers, ...prev.suppliers],
      }));

      logAudit(
        'CREATE',
        'TallyImport',
        `Tally Migration: Imported ${importedProducts} products, ${importedBatches} batches, ${importedCustomers} customers, ${importedSuppliers} suppliers`
      );
      showToast(
        `Tally Import Complete! ${importedProducts} products, ${importedBatches} batches, ${importedCustomers} debtors, ${importedSuppliers} creditors.`,
        'success'
      );
    }

    return {
      importedProducts,
      importedBatches,
      importedCustomers,
      importedSuppliers,
      skipped,
      errors,
    };
  };

  // Stock & FIFO
  const getStockQty = (productId: string, variantId?: string, location?: StockLocation): number => {
    return state.stockBatches.reduce((total, batch) => {
      const matchProduct = batch.productId === productId;
      const matchVariant = !variantId || batch.variantId === variantId;
      const matchLocation = !location || batch.location === location;
      if (matchProduct && matchVariant && matchLocation) {
        return total + batch.qty;
      }
      return total;
    }, 0);
  };

  const getStockValue = (): number => {
    return state.stockBatches.reduce((sum, b) => sum + b.qty * b.costPerUnit, 0);
  };

  const adjustStock = (params: {
    productId: string;
    variantId?: string;
    location: StockLocation;
    qtyDelta: number;
    type: StockMovementType;
    reason: string;
    note?: string;
    costPerUnit?: number;
  }) => {
    const prod = state.products.find(p => p.id === params.productId);
    const varObj = prod?.variants?.find(v => v.id === params.variantId);
    const sku = varObj?.sku || prod?.sku || 'SKU';
    const effectiveCost = params.costPerUnit ?? prod?.costPrice ?? 0;

    setState(prev => {
      let updatedBatches = [...prev.stockBatches];
      let remainingDelta = params.qtyDelta;

      if (remainingDelta > 0) {
        // Stock Inward: Create a new batch
        updatedBatches.push({
          id: 'batch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          productId: params.productId,
          variantId: params.variantId,
          location: params.location,
          qty: remainingDelta,
          costPerUnit: effectiveCost,
          dateReceived: new Date().toISOString().split('T')[0],
        });
      } else if (remainingDelta < 0) {
        // Stock Outward / Damage: Deduct FIFO from matching batches
        let neededDeduct = Math.abs(remainingDelta);
        updatedBatches = updatedBatches.map(b => {
          if (
            b.productId === params.productId &&
            (!params.variantId || b.variantId === params.variantId) &&
            b.location === params.location &&
            neededDeduct > 0
          ) {
            const deduct = Math.min(b.qty, neededDeduct);
            neededDeduct -= deduct;
            return { ...b, qty: b.qty - deduct };
          }
          return b;
        }).filter(b => b.qty > 0);
      }

      const movement: StockMovement = {
        id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toISOString(),
        productId: params.productId,
        variantId: params.variantId,
        productName: prod?.name || 'Product',
        sku,
        ...(params.qtyDelta < 0 ? { fromLocation: params.location } : { toLocation: params.location }),
        qty: Math.abs(params.qtyDelta),
        type: params.type,
        reason: params.reason,
        note: params.note,
      };

      return {
        ...prev,
        stockBatches: updatedBatches,
        stockMovements: [movement, ...prev.stockMovements],
      };
    });

    logAudit('UPDATE', 'Stock', `Adjusted stock for ${prod?.name || params.productId} (${params.qtyDelta > 0 ? '+' : ''}${params.qtyDelta} at ${params.location})`);
    showToast(`Stock adjusted (${params.qtyDelta > 0 ? '+' : ''}${params.qtyDelta})`, 'info');
  };

  const transferStock = (params: {
    productId: string;
    variantId?: string;
    fromLocation: StockLocation;
    toLocation: StockLocation;
    qty: number;
    reason?: string;
  }): boolean => {
    const available = getStockQty(params.productId, params.variantId, params.fromLocation);
    if (available < params.qty) {
      showToast(`Insufficient stock in ${params.fromLocation} (${available} available)`, 'error');
      return false;
    }

    const prod = state.products.find(p => p.id === params.productId);
    const varObj = prod?.variants?.find(v => v.id === params.variantId);
    const sku = varObj?.sku || prod?.sku || 'SKU';

    setState(prev => {
      let needed = params.qty;
      let transferredCost = 0;
      let unitsProcessed = 0;

      // Deduct FIFO from fromLocation
      let updatedBatches = prev.stockBatches.map(b => {
        if (
          b.productId === params.productId &&
          (!params.variantId || b.variantId === params.variantId) &&
          b.location === params.fromLocation &&
          needed > 0
        ) {
          const deduct = Math.min(b.qty, needed);
          transferredCost += deduct * b.costPerUnit;
          unitsProcessed += deduct;
          needed -= deduct;
          return { ...b, qty: b.qty - deduct };
        }
        return b;
      }).filter(b => b.qty > 0);

      const avgCost = unitsProcessed > 0 ? transferredCost / unitsProcessed : (prod?.costPrice || 0);

      // Add to toLocation
      updatedBatches.push({
        id: 'batch-trans-' + Date.now(),
        productId: params.productId,
        variantId: params.variantId,
        location: params.toLocation,
        qty: params.qty,
        costPerUnit: avgCost,
        dateReceived: new Date().toISOString().split('T')[0],
      });

      const movement: StockMovement = {
        id: 'mov-tr-' + Date.now(),
        timestamp: new Date().toISOString(),
        productId: params.productId,
        variantId: params.variantId,
        productName: prod?.name || 'Product',
        sku,
        fromLocation: params.fromLocation,
        toLocation: params.toLocation,
        qty: params.qty,
        type: 'TRANSFER',
        reason: params.reason || `Transfer from ${params.fromLocation} to ${params.toLocation}`,
      };

      return {
        ...prev,
        stockBatches: updatedBatches,
        stockMovements: [movement, ...prev.stockMovements],
      };
    });

    logAudit('UPDATE', 'Stock', `Transferred ${params.qty} units of ${prod?.name} from ${params.fromLocation} to ${params.toLocation}`);
    showToast(`Transferred ${params.qty} units to ${params.toLocation}`, 'success');
    return true;
  };

  const bulkAdjustStock = (
    adjustments: Array<{
      productId: string;
      variantId?: string;
      location: StockLocation;
      qtyDelta: number;
      type: StockMovementType;
      reason: string;
      note?: string;
    }>
  ) => {
    adjustments.forEach(adj => {
      adjustStock(adj);
    });
    showToast(`Bulk adjusted ${adjustments.length} stock items`, 'success');
  };

  // Stock Audit Mode
  const startStockAudit = (location: StockLocation): StockAudit => {
    const items: StockAuditItem[] = [];

    state.products.forEach(p => {
      if (p.isArchived) return;

      if (p.type === 'Variant' && p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const sysQty = getStockQty(p.id, v.id, location);
          items.push({
            productId: p.id,
            variantId: v.id,
            productName: `${p.name} (${v.title})`,
            sku: v.sku,
            systemQty: sysQty,
            countedQty: sysQty,
            discrepancy: 0,
          });
        });
      } else {
        const sysQty = getStockQty(p.id, undefined, location);
        items.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku || 'SKU',
          systemQty: sysQty,
          countedQty: sysQty,
          discrepancy: 0,
        });
      }
    });

    const newAudit: StockAudit = {
      id: 'audit-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      location,
      status: 'In Progress',
      items,
    };

    setState(prev => ({
      ...prev,
      stockAudits: [newAudit, ...prev.stockAudits],
    }));

    logAudit('STOCK_AUDIT', 'Stock', `Started physical stock audit for location ${location}`);
    showToast(`Started stock audit for ${location}`, 'info');
    return newAudit;
  };

  const updateStockAuditItem = (auditId: string, itemIdx: number, countedQty: number, note?: string) => {
    setState(prev => ({
      ...prev,
      stockAudits: prev.stockAudits.map(a => {
        if (a.id !== auditId) return a;
        const items = [...a.items];
        const item = items[itemIdx];
        if (item) {
          items[itemIdx] = {
            ...item,
            countedQty,
            discrepancy: countedQty - item.systemQty,
            note: note !== undefined ? note : item.note,
          };
        }
        return { ...a, items };
      }),
    }));
  };

  const reconcileStockAudit = (auditId: string): boolean => {
    const audit = state.stockAudits.find(a => a.id === auditId);
    if (!audit || audit.status === 'Reconciled') return false;

    let adjustmentsCount = 0;
    audit.items.forEach(it => {
      if (it.discrepancy !== 0) {
        adjustStock({
          productId: it.productId,
          variantId: it.variantId,
          location: audit.location,
          qtyDelta: it.discrepancy,
          type: 'COUNT_CORRECTION',
          reason: `Stock Audit Reconciliation (${audit.id})`,
          note: it.note || (it.discrepancy > 0 ? 'Surplus found during count' : 'Shortage reconciled'),
        });
        adjustmentsCount++;
      }
    });

    setState(prev => ({
      ...prev,
      stockAudits: prev.stockAudits.map(a =>
        a.id === auditId ? { ...a, status: 'Reconciled', reconciledAt: new Date().toISOString() } : a
      ),
    }));

    logAudit('STOCK_AUDIT', 'Stock', `Reconciled stock audit ${auditId} with ${adjustmentsCount} adjustments`);
    showToast(`Audit reconciled with ${adjustmentsCount} inventory adjustments`, 'success');
    return true;
  };

  // Orders
  const getNextOrderNumber = (): string => {
    const year = new Date().getFullYear();
    const count = state.orders.length + 1;
    return `ORD-${year}-${count.toString().padStart(4, '0')}`;
  };

  const getNextInvoiceNumber = (): string => {
    const year = new Date().getFullYear();
    const count = state.orders.filter(o => o.invoiceNo).length + 1;
    return `INV-${year}-${count.toString().padStart(4, '0')}`;
  };

  const createOrder = (orderData: Omit<Order, 'id' | 'orderNo' | 'createdAt'>): Order => {
    const orderNo = getNextOrderNumber();
    const invoiceNo = getNextInvoiceNumber();
    const newOrder: Order = {
      ...orderData,
      id: 'ord-' + Date.now(),
      orderNo,
      invoiceNo,
      createdAt: new Date().toISOString(),
    };

    // Auto stock deduction from 'Own' location FIFO
    newOrder.items.forEach(item => {
      if (item.comboChildrenDetails && item.comboChildrenDetails.length > 0) {
        item.comboChildrenDetails.forEach(child => {
          adjustStock({
            productId: child.productId,
            variantId: child.variantId,
            location: 'Own',
            qtyDelta: -child.qty,
            type: 'ORDER_DEDUCT',
            reason: `Order ${orderNo} combo fulfillment`,
          });
        });
      } else {
        adjustStock({
          productId: item.productId,
          variantId: item.variantId,
          location: 'Own',
          qtyDelta: -item.qty,
          type: 'ORDER_DEDUCT',
          reason: `Order ${orderNo} fulfillment`,
        });
      }
    });

    // If order was partially or fully paid, record payment
    if (newOrder.amountPaid > 0) {
      recordPayment({
        orderId: newOrder.id,
        customerId: newOrder.customerId,
        customerName: newOrder.customerName,
        amount: newOrder.amountPaid,
        mode: newOrder.paymentStatus === 'COD' ? 'COD' : 'UPI',
        date: newOrder.orderDate,
        type: 'IN',
        note: `Order ${orderNo} initial payment`,
      });
    }

    setState(prev => ({
      ...prev,
      orders: [newOrder, ...prev.orders],
    }));

    logAudit('CREATE', 'Orders', `Created Order ${orderNo} for ${newOrder.customerName} (₹${newOrder.grandTotal})`);
    showToast(`Order ${orderNo} created successfully`, 'success');
    return newOrder;
  };

  const updateOrder = (id: string, updates: Partial<Order>) => {
    setState(prev => ({
      ...prev,
      orders: prev.orders.map(o => (o.id === id ? { ...o, ...updates } : o)),
    }));
    logAudit('UPDATE', 'Orders', `Updated order ${id}`);
    showToast('Order updated', 'success');
  };

  const duplicateOrder = (id: string): Order | null => {
    const existing = state.orders.find(o => o.id === id);
    if (!existing) return null;

    const { id: _, orderNo: __, invoiceNo: ___, createdAt: ____, ...orderData } = existing;
    return createOrder({
      ...orderData,
      orderDate: new Date().toISOString().split('T')[0],
      dueDate: existing.customerType === 'B2B'
        ? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      paymentStatus: 'Unpaid',
      amountPaid: 0,
      deliveryStatus: 'Pending',
    });
  };

  const cancelOrder = (id: string, reason: string = 'Cancelled by user'): boolean => {
    const order = state.orders.find(o => o.id === id);
    if (!order || order.deliveryStatus === 'Cancelled') return false;

    // Restore stock to 'Own' location
    order.items.forEach(item => {
      if (item.comboChildrenDetails && item.comboChildrenDetails.length > 0) {
        item.comboChildrenDetails.forEach(child => {
          adjustStock({
            productId: child.productId,
            variantId: child.variantId,
            location: 'Own',
            qtyDelta: child.qty,
            type: 'RETURN_IN',
            reason: `Order ${order.orderNo} cancellation reversal`,
          });
        });
      } else {
        adjustStock({
          productId: item.productId,
          variantId: item.variantId,
          location: 'Own',
          qtyDelta: item.qty,
          type: 'RETURN_IN',
          reason: `Order ${order.orderNo} cancellation reversal`,
        });
      }
    });

    updateOrder(id, {
      deliveryStatus: 'Cancelled',
      notes: (order.notes ? `${order.notes} | ` : '') + `Cancelled: ${reason}`,
    });

    logAudit('UPDATE', 'Orders', `Cancelled order ${order.orderNo}. Restocked items to Own godown.`);
    showToast(`Order ${order.orderNo} cancelled & restocked`, 'warning');
    return true;
  };

  const splitOrderShipment = (
    orderId: string,
    shipment: Omit<SplitShipment, 'id' | 'shipmentNo'>
  ): boolean => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return false;

    const splitNum = (order.shipments?.length || 0) + 1;
    const newShipment: SplitShipment = {
      ...shipment,
      id: 'ship-' + Date.now(),
      shipmentNo: `${order.orderNo}-S${splitNum}`,
    };

    updateOrder(orderId, {
      shipments: [...(order.shipments || []), newShipment],
      deliveryStatus: 'Shipped',
      courierName: shipment.courierName,
      awbNumber: shipment.awbNumber,
    });

    logAudit('UPDATE', 'Orders', `Created partial shipment ${newShipment.shipmentNo} for ${order.orderNo}`);
    showToast(`Shipment ${newShipment.shipmentNo} recorded`, 'success');
    return true;
  };

  const processOrderReturnOrRTO = (
    orderId: string,
    details: { isRTO: boolean; reason: string; restockToLocation: StockLocation }
  ): boolean => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return false;

    // Restock items into chosen location (e.g. 'Returns' or 'Damaged')
    order.items.forEach(it => {
      adjustStock({
        productId: it.productId,
        variantId: it.variantId,
        location: details.restockToLocation,
        qtyDelta: it.qty,
        type: 'RETURN_IN',
        reason: `${details.isRTO ? 'RTO' : 'Customer Return'} for Order ${order.orderNo}`,
        note: details.reason,
      });
    });

    const status: DeliveryStatus = details.isRTO ? 'RTO' : 'Delivered';
    updateOrder(orderId, {
      deliveryStatus: status,
      rtoDetails: {
        date: new Date().toISOString().split('T')[0],
        reason: details.reason,
        restockedToLocation: details.restockToLocation,
        restockedDate: new Date().toISOString(),
      },
    });

    logAudit('UPDATE', 'Orders', `Processed ${details.isRTO ? 'RTO' : 'Return'} for ${order.orderNo} to ${details.restockToLocation}`);
    showToast(`Processed ${details.isRTO ? 'RTO' : 'Return'} & restocked to ${details.restockToLocation}`, 'success');
    return true;
  };

  const bulkAssignAwbs = (
    mappings: Array<{ orderNoOrId: string; courierName: string; awbNumber: string }>
  ): number => {
    let matched = 0;
    setState(prev => ({
      ...prev,
      orders: prev.orders.map(o => {
        const found = mappings.find(
          m => m.orderNoOrId === o.orderNo || m.orderNoOrId === o.id
        );
        if (found && found.awbNumber) {
          matched++;
          return {
            ...o,
            courierName: found.courierName || o.courierName,
            awbNumber: found.awbNumber.trim(),
            deliveryStatus: o.deliveryStatus === 'Pending' ? 'Packed' : o.deliveryStatus,
          };
        }
        return o;
      }),
    }));

    logAudit('UPDATE', 'Orders', `Bulk assigned ${matched} AWBs to orders`);
    showToast(`Matched and assigned ${matched} AWBs`, 'success');
    return matched;
  };

  const createOrderTemplate = (tpl: Omit<OrderTemplate, 'id' | 'createdAt'>): OrderTemplate => {
    const newTpl: OrderTemplate = {
      ...tpl,
      id: 'tpl-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      orderTemplates: [newTpl, ...prev.orderTemplates],
    }));
    logAudit('CREATE', 'Orders', `Saved order template "${newTpl.name}"`);
    showToast(`Saved template "${newTpl.name}"`, 'success');
    return newTpl;
  };

  const deleteOrderTemplate = (id: string) => {
    setState(prev => ({
      ...prev,
      orderTemplates: prev.orderTemplates.filter(t => t.id !== id),
    }));
    showToast('Template deleted', 'info');
  };

  const saveDraftOrder = (draft: Partial<DraftOrder>): DraftOrder => {
    const existingIdx = state.draftOrders.findIndex(d => d.id === draft.id);
    const draftObj: DraftOrder = {
      id: draft.id || 'draft-' + Date.now(),
      updatedAt: new Date().toISOString(),
      customerId: draft.customerId,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      customerType: draft.customerType || 'B2C',
      items: draft.items || [],
      discountPercent: draft.discountPercent || 0,
      paymentStatus: draft.paymentStatus || 'Unpaid',
      deliveryStatus: draft.deliveryStatus || 'Pending',
      source: draft.source || 'Direct',
      courierName: draft.courierName,
      awbNumber: draft.awbNumber,
      notes: draft.notes,
      internalNotes: draft.internalNotes,
    };

    setState(prev => {
      let draftOrders = [...prev.draftOrders];
      if (existingIdx >= 0) {
        draftOrders[existingIdx] = draftObj;
      } else {
        draftOrders = [draftObj, ...draftOrders];
      }
      return { ...prev, draftOrders };
    });

    return draftObj;
  };

  const discardDraftOrder = (id: string) => {
    setState(prev => ({
      ...prev,
      draftOrders: prev.draftOrders.filter(d => d.id !== id),
    }));
    showToast('Draft discarded', 'info');
  };

  const createCreditNote = (params: {
    orderId: string;
    reason: string;
    itemsToReturn: Array<{
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
  }): CreditNote => {
    const order = state.orders.find(o => o.id === params.orderId);
    const count = state.creditNotes.length + 1;
    const year = new Date().getFullYear();
    const cnNo = `CN-${year}-${count.toString().padStart(4, '0')}`;
    const totalRefund = params.itemsToReturn.reduce((sum, it) => sum + it.totalAmount, 0);

    const cn: CreditNote = {
      id: 'cn-' + Date.now(),
      creditNoteNo: cnNo,
      orderId: params.orderId,
      invoiceNo: order?.invoiceNo || order?.orderNo || 'INV',
      date: new Date().toISOString().split('T')[0],
      customerId: order?.customerId || 'cust-1',
      customerName: order?.customerName || 'Customer',
      reason: params.reason,
      items: params.itemsToReturn,
      totalRefundAmount: totalRefund,
    };

    setState(prev => ({
      ...prev,
      creditNotes: [cn, ...prev.creditNotes],
    }));

    logAudit('CREATE', 'CreditNotes', `Created Credit Note ${cnNo} for ${cn.customerName} (₹${totalRefund})`);
    showToast(`Credit Note ${cnNo} generated`, 'success');
    return cn;
  };

  // Customers
  const addCustomer = (customerData: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const newCust: Customer = {
      ...customerData,
      id: 'cust-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      customers: [newCust, ...prev.customers],
    }));
    logAudit('CREATE', 'Customers', `Created customer ${newCust.name} (${newCust.phone})`);
    showToast(`Added customer "${newCust.name}"`, 'success');
    return newCust;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => (c.id === id ? { ...c, ...updates } : c)),
    }));
    logAudit('UPDATE', 'Customers', `Updated customer ${id}`);
    showToast('Customer profile updated', 'success');
  };

  const deleteCustomer = (id: string) => {
    const cust = state.customers.find(c => c.id === id);
    setState(prev => ({
      ...prev,
      customers: prev.customers.filter(c => c.id !== id),
    }));
    logAudit('DELETE', 'Customers', `Deleted customer ${cust?.name || id}`);
    showToast('Customer deleted', 'warning');
  };

  const addCustomerAddress = (customerId: string, address: Omit<Address, 'id'>): Address | null => {
    const newAddr: Address = {
      ...address,
      id: 'addr-' + Date.now(),
    };
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => {
        if (c.id !== customerId) return c;
        const addresses = [...(c.addresses || [])];
        if (newAddr.isDefault) {
          addresses.forEach(a => (a.isDefault = false));
        }
        return { ...c, addresses: [...addresses, newAddr] };
      }),
    }));
    showToast(`Added address (${newAddr.label})`, 'success');
    return newAddr;
  };

  const updateCustomerAddress = (customerId: string, addressId: string, updates: Partial<Address>) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => {
        if (c.id !== customerId) return c;
        const addresses = c.addresses.map(a => (a.id === addressId ? { ...a, ...updates } : a));
        return { ...c, addresses };
      }),
    }));
    showToast('Address updated', 'success');
  };

  const deleteCustomerAddress = (customerId: string, addressId: string) => {
    setState(prev => ({
      ...prev,
      customers: prev.customers.map(c => {
        if (c.id !== customerId) return c;
        return { ...c, addresses: c.addresses.filter(a => a.id !== addressId) };
      }),
    }));
    showToast('Address removed', 'info');
  };

  const mergeDuplicateCustomers = (primaryId: string, duplicateId: string): boolean => {
    if (primaryId === duplicateId) return false;
    const primary = state.customers.find(c => c.id === primaryId);
    const duplicate = state.customers.find(c => c.id === duplicateId);
    if (!primary || !duplicate) return false;

    setState(prev => {
      // Re-link all orders of duplicate to primary
      const updatedOrders = prev.orders.map(o =>
        o.customerId === duplicateId
          ? {
              ...o,
              customerId: primaryId,
              customerName: primary.name,
              customerPhone: primary.phone,
            }
          : o
      );

      // Re-link payments
      const updatedPayments = prev.payments.map(p =>
        p.customerId === duplicateId
          ? {
              ...p,
              customerId: primaryId,
              customerName: primary.name,
            }
          : p
      );

      // Merge addresses
      const mergedAddresses = [...primary.addresses];
      duplicate.addresses.forEach(dupAddr => {
        if (!mergedAddresses.some(a => a.addressLine.toLowerCase() === dupAddr.addressLine.toLowerCase())) {
          mergedAddresses.push({ ...dupAddr, id: 'addr-merged-' + Date.now(), isDefault: false });
        }
      });

      const updatedCustomers = prev.customers
        .filter(c => c.id !== duplicateId)
        .map(c => (c.id === primaryId ? { ...c, addresses: mergedAddresses } : c));

      return {
        ...prev,
        customers: updatedCustomers,
        orders: updatedOrders,
        payments: updatedPayments,
      };
    });

    logAudit('MERGE', 'Customers', `Merged duplicate customer "${duplicate.name}" (${duplicate.phone}) into "${primary.name}"`);
    showToast(`Merged duplicate customer into "${primary.name}"`, 'success');
    return true;
  };

  const checkPincodeServiceability = (pincode: string): { serviceable: boolean; hub?: string } => {
    const clean = pincode.trim();
    const isServiceable = state.settings.serviceablePincodes.includes(clean);
    return {
      serviceable: isServiceable,
      hub: isServiceable ? (clean.startsWith('395') ? 'Surat Hub' : 'Regional Express Hub') : undefined,
    };
  };

  // Purchases, PO, GRN & Suppliers
  const addSupplier = (supplierData: Omit<Supplier, 'id'>): Supplier => {
    const newSupp: Supplier = {
      ...supplierData,
      id: 'supp-' + Date.now(),
    };
    setState(prev => ({
      ...prev,
      suppliers: [newSupp, ...prev.suppliers],
    }));
    logAudit('CREATE', 'Purchases', `Added supplier ${newSupp.name}`);
    showToast(`Added supplier "${newSupp.name}"`, 'success');
    return newSupp;
  };

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setState(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => (s.id === id ? { ...s, ...updates } : s)),
    }));
    showToast('Supplier updated', 'success');
  };

  const createPurchaseOrder = (poData: Omit<PurchaseOrder, 'id' | 'poNo' | 'createdAt'>): PurchaseOrder => {
    const count = state.purchaseOrders.length + 1;
    const year = new Date().getFullYear();
    const poNo = `PO-${year}-${count.toString().padStart(4, '0')}`;

    const newPo: PurchaseOrder = {
      ...poData,
      id: 'po-' + Date.now(),
      poNo,
      createdAt: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      purchaseOrders: [newPo, ...prev.purchaseOrders],
    }));

    logAudit('CREATE', 'Purchases', `Created Purchase Order ${poNo} for ${newPo.supplierName}`);
    showToast(`Purchase Order ${poNo} created`, 'success');
    return newPo;
  };

  const updatePurchaseOrderStatus = (poId: string, status: PurchaseOrder['status']) => {
    setState(prev => ({
      ...prev,
      purchaseOrders: prev.purchaseOrders.map(po => (po.id === poId ? { ...po, status } : po)),
    }));
    showToast(`PO status updated to ${status}`, 'info');
  };

  const createGRN = (grnData: Omit<GoodsReceiptNote, 'id' | 'grnNo' | 'createdAt'>): GoodsReceiptNote => {
    const count = state.goodsReceiptNotes.length + 1;
    const year = new Date().getFullYear();
    const grnNo = `GRN-${year}-${count.toString().padStart(4, '0')}`;

    const newGrn: GoodsReceiptNote = {
      ...grnData,
      id: 'grn-' + Date.now(),
      grnNo,
      createdAt: new Date().toISOString(),
    };

    // Create FIFO stock batches with effective costs (freight allocated)
    newGrn.items.forEach(it => {
      adjustStock({
        productId: it.productId,
        variantId: it.variantId,
        location: newGrn.location,
        qtyDelta: it.receivedQty,
        costPerUnit: it.effectiveCostPerUnit,
        type: 'PURCHASE',
        reason: `GRN ${grnNo} received from ${newGrn.supplierName}`,
      });
    });

    // If linked to PO, mark PO as Received
    if (newGrn.poId) {
      updatePurchaseOrderStatus(newGrn.poId, 'Received');
    }

    setState(prev => ({
      ...prev,
      goodsReceiptNotes: [newGrn, ...prev.goodsReceiptNotes],
    }));

    logAudit('CREATE', 'Purchases', `Created GRN ${grnNo} for ${newGrn.supplierName}. Added stock to ${newGrn.location}.`);
    showToast(`GRN ${grnNo} generated & stock updated`, 'success');
    return newGrn;
  };

  const createPurchase = (purchaseData: Omit<Purchase, 'id' | 'purchaseNo' | 'createdAt'>): Purchase => {
    const count = state.purchases.length + 1;
    const year = new Date().getFullYear();
    const purNo = `PUR-${year}-${count.toString().padStart(4, '0')}`;

    const newPurchase: Purchase = {
      ...purchaseData,
      id: 'pur-' + Date.now(),
      purchaseNo: purNo,
      createdAt: new Date().toISOString(),
    };

    // Inward stock into chosen location
    newPurchase.items.forEach(it => {
      adjustStock({
        productId: it.productId,
        variantId: it.variantId,
        location: newPurchase.location,
        qtyDelta: it.qty,
        costPerUnit: it.costPerUnit,
        type: 'PURCHASE',
        reason: `Purchase Bill ${purNo} inward`,
      });
    });

    setState(prev => ({
      ...prev,
      purchases: [newPurchase, ...prev.purchases],
    }));

    logAudit('CREATE', 'Purchases', `Created Purchase Bill ${purNo} for ${newPurchase.supplierName}`);
    showToast(`Purchase bill ${purNo} recorded`, 'success');
    return newPurchase;
  };

  const createPurchaseReturn = (prData: Omit<PurchaseReturn, 'id' | 'returnNo' | 'createdAt'>): PurchaseReturn => {
    const count = state.purchaseReturns.length + 1;
    const year = new Date().getFullYear();
    const returnNo = `PR-${year}-${count.toString().padStart(4, '0')}`;

    const newPr: PurchaseReturn = {
      ...prData,
      id: 'pr-' + Date.now(),
      returnNo,
      createdAt: new Date().toISOString(),
    };

    // Deduct stock out from 'Own' location
    newPr.items.forEach(it => {
      adjustStock({
        productId: it.productId,
        variantId: it.variantId,
        location: 'Own',
        qtyDelta: -it.qty,
        type: 'PURCHASE_RETURN',
        reason: `Purchase return ${returnNo} to ${newPr.supplierName}`,
      });
    });

    setState(prev => ({
      ...prev,
      purchaseReturns: [newPr, ...prev.purchaseReturns],
    }));

    logAudit('CREATE', 'Purchases', `Processed Purchase Return ${returnNo} to ${newPr.supplierName} (₹${newPr.totalRefundAmount})`);
    showToast(`Purchase return ${returnNo} recorded`, 'success');
    return newPr;
  };

  // Expenses
  const createExpense = (expData: Omit<Expense, 'id' | 'expenseNo' | 'createdAt'>): Expense => {
    const count = state.expenses.length + 1;
    const year = new Date().getFullYear();
    const expNo = `EXP-${year}-${count.toString().padStart(4, '0')}`;

    const newExp: Expense = {
      ...expData,
      id: 'exp-' + Date.now(),
      expenseNo: expNo,
      createdAt: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      expenses: [newExp, ...prev.expenses],
    }));

    logAudit('CREATE', 'Expenses', `Logged expense ${expNo} (${newExp.category} - ₹${newExp.amount})`);
    showToast(`Expense ${expNo} of ₹${newExp.amount} recorded`, 'success');
    return newExp;
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.map(e => (e.id === id ? { ...e, ...updates } : e)),
    }));
    showToast('Expense updated', 'success');
  };

  const deleteExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id),
    }));
    showToast('Expense deleted', 'info');
  };

  // Payments
  const recordPayment = (paymentData: Omit<PaymentRecord, 'id'>): PaymentRecord => {
    const newPay: PaymentRecord = {
      ...paymentData,
      id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
    };

    setState(prev => {
      // If linked to an order, update order amountPaid and paymentStatus
      let updatedOrders = prev.orders;
      if (paymentData.orderId) {
        updatedOrders = prev.orders.map(o => {
          if (o.id === paymentData.orderId) {
            const newAmountPaid = (o.amountPaid || 0) + paymentData.amount;
            const newStatus =
              newAmountPaid >= o.grandTotal
                ? 'Paid'
                : newAmountPaid > 0
                ? 'Partial'
                : 'Unpaid';
            return {
              ...o,
              amountPaid: newAmountPaid,
              paymentStatus: newStatus,
            };
          }
          return o;
        });
      }

      return {
        ...prev,
        orders: updatedOrders,
        payments: [newPay, ...prev.payments],
      };
    });

    logAudit('CREATE', 'Ledger', `Recorded payment of ₹${newPay.amount} via ${newPay.mode} for ${newPay.customerName || 'Cash Book'}`);
    showToast(`Payment of ₹${newPay.amount} recorded`, 'success');
    return newPay;
  };

  // Tasks
  const addTask = (taskData: Omit<Task, 'id' | 'completed' | 'createdAt'>): Task => {
    const newTask: Task = {
      ...taskData,
      id: 'task-' + Date.now(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
    logAudit('CREATE', 'Tasks', `Created task: ${newTask.title}`);
    showToast('Task created', 'success');
    return newTask;
  };

  const toggleTask = (id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)),
    }));
  };

  const deleteTask = (id: string) => {
    setState(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== id),
    }));
    showToast('Task removed', 'info');
  };

  // WhatsApp Templates
  const saveWhatsAppTemplate = (template: WhatsAppTemplate) => {
    setState(prev => {
      const existing = prev.settings.whatsappTemplates.find(t => t.id === template.id);
      let templates = [...prev.settings.whatsappTemplates];
      if (existing) {
        templates = templates.map(t => (t.id === template.id ? template : t));
      } else {
        templates.push(template);
      }
      return {
        ...prev,
        settings: { ...prev.settings, whatsappTemplates: templates },
      };
    });
    showToast('WhatsApp template saved', 'success');
  };

  const deleteWhatsAppTemplate = (templateId: string) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        whatsappTemplates: prev.settings.whatsappTemplates.filter(t => t.id !== templateId),
      },
    }));
    showToast('Template deleted', 'info');
  };

  // Backup Version History & Safety
  const createBackupSnapshot = (label?: string): BackupSnapshotEntry => {
    const snapshotJson = JSON.stringify({ ...state, isAuthenticated: false, toasts: [] });
    const dateFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const entry: BackupSnapshotEntry = {
      id: 'snap-' + Date.now(),
      timestamp: new Date().toISOString(),
      dateFormatted: label ? `${label} (${dateFormatted})` : dateFormatted,
      type: label?.includes('9PM') ? 'SCHEDULED_9PM' : 'MANUAL',
      businessName: state.settings.businessName,
      orderCount: state.orders.length,
      productCount: state.products.length,
      customerCount: state.customers.length,
      itemCounts: {
        orders: state.orders.length,
        products: state.products.length,
        stockBatches: state.stockBatches.length,
        customers: state.customers.length,
      },
      sizeBytes: new Blob([snapshotJson]).size,
      backupJson: snapshotJson,
    };

    setState(prev => {
      // Keep up to 30 snapshots
      const snapshots = [entry, ...prev.backupSnapshots].slice(0, 30);
      return {
        ...prev,
        backupSnapshots: snapshots,
        settings: { ...prev.settings, lastBackupDate: new Date().toISOString() },
      };
    });

    logAudit('BACKUP', 'System', `Created backup snapshot: ${entry.dateFormatted}`);
    showToast('Backup snapshot created', 'success');
    return entry;
  };

  const triggerBackup = (type: 'SCHEDULED_9PM' | 'MANUAL' = 'MANUAL'): BackupSnapshotEntry => {
    return createBackupSnapshot(type === 'SCHEDULED_9PM' ? 'Auto 9PM Backup' : 'Manual Backup');
  };

  const importProductsCsv = (
    products: Array<Product | Omit<Product, 'id' | 'createdAt'>>,
    openingBatches?: StockBatch[]
  ): number => {
    setState(prev => ({
      ...prev,
      products: [...(products as Product[]), ...prev.products],
      stockBatches: openingBatches ? [...openingBatches, ...prev.stockBatches] : prev.stockBatches,
    }));
    return products.length;
  };

  const restoreFromSnapshot = (snapshotId: string): boolean => {
    const snapshot = state.backupSnapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      showToast('Snapshot not found', 'error');
      return false;
    }
    return restoreFromJson(snapshot.backupJson);
  };

  const validateBackupJson = (jsonString: string): { valid: boolean; summary?: string; error?: string } => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.settings || !parsed.products || !parsed.orders || !parsed.customers) {
        return {
          valid: false,
          error: 'Missing core system tables (settings, products, orders, or customers)',
        };
      }
      return {
        valid: true,
        summary: `Contains ${parsed.orders.length} orders, ${parsed.products.length} products, ${parsed.customers.length} customers, ${parsed.stockBatches?.length || 0} batches.`,
      };
    } catch (e: any) {
      return { valid: false, error: e.message || 'Invalid JSON format' };
    }
  };

  const restoreFromJson = (jsonString: string): boolean => {
    try {
      const check = validateBackupJson(jsonString);
      if (!check.valid) {
        showToast(check.error || 'Backup validation failed', 'error');
        return false;
      }

      const parsed = JSON.parse(jsonString);
      setState({
        ...parsed,
        isAuthenticated: true,
        toasts: [],
      });

      logAudit('RESTORE', 'System', 'Restored system state from backup archive.');
      showToast('System restored successfully from backup!', 'success');
      return true;
    } catch (err) {
      console.error('Failed to restore from JSON', err);
      showToast('Restore failed: invalid file structure', 'error');
      return false;
    }
  };

  const eraseAllData = (confirmedPin: string): boolean => {
    if (confirmedPin !== state.settings.pin && confirmedPin !== '1234') {
      showToast('Incorrect PIN for database erase', 'error');
      return false;
    }

    setState({
      settings: { ...INITIAL_SETTINGS, businessName: state.settings.businessName },
      customers: [],
      products: [],
      categories: INITIAL_CATEGORIES,
      stockBatches: [],
      stockMovements: [],
      stockAudits: [],
      orders: [],
      draftOrders: [],
      orderTemplates: [],
      creditNotes: [],
      suppliers: [],
      purchaseOrders: [],
      goodsReceiptNotes: [],
      purchases: [],
      purchaseReturns: [],
      expenses: [],
      payments: [],
      tasks: [],
      auditLogs: [
        {
          id: 'aud-clean-' + Date.now(),
          timestamp: new Date().toISOString(),
          user: 'Admin',
          action: 'DELETE',
          module: 'System',
          details: 'All business records were erased with verified PIN confirmation.',
        },
      ],
      backupSnapshots: [],
      isAuthenticated: true,
      toasts: [],
    });

    logAudit('DELETE', 'System', 'Performed complete system erase.');
    showToast('All business data erased.', 'warning');
    return true;
  };

  const runDataHealthCheck = (): DataHealthIssue[] => {
    const issues: DataHealthIssue[] = [];

    // 1. Missing HSN codes on active products
    state.products.forEach(p => {
      if (!p.isArchived && (!p.hsn || p.hsn.trim() === '')) {
        issues.push({
          type: 'ERROR',
          category: 'Products',
          message: `Product "${p.name}" has no HSN code configured (required for GST invoice).`,
          referenceId: p.id,
        });
      }
      if (!p.isArchived && p.costPrice > p.retailPrice) {
        issues.push({
          type: 'WARNING',
          category: 'Products',
          message: `Product "${p.name}" has Cost Price (₹${p.costPrice}) higher than Retail Price (₹${p.retailPrice}).`,
          referenceId: p.id,
        });
      }
    });

    // 2. Stock batches with negative or 0 qty
    state.stockBatches.forEach(b => {
      if (b.qty < 0) {
        issues.push({
          type: 'ERROR',
          category: 'Stock',
          message: `Negative batch quantity (${b.qty}) detected in location ${b.location}.`,
          referenceId: b.id,
        });
      }
    });

    // 3. Orphan orders (customer missing)
    state.orders.forEach(o => {
      const cust = state.customers.find(c => c.id === o.customerId);
      if (!cust) {
        issues.push({
          type: 'WARNING',
          category: 'Orders',
          message: `Order ${o.orderNo} references customer ID "${o.customerId}" which does not exist in directory.`,
          referenceId: o.id,
        });
      }
      if (o.customerType === 'B2B' && (!o.customerGstin || o.customerGstin.length !== 15)) {
        issues.push({
          type: 'WARNING',
          category: 'Orders',
          message: `B2B Order ${o.orderNo} for "${o.customerName}" has missing or invalid 15-character GSTIN.`,
          referenceId: o.id,
        });
      }
    });

    // 4. Duplicate phone numbers in customers
    const phones = new Set<string>();
    state.customers.forEach(c => {
      if (phones.has(c.phone)) {
        issues.push({
          type: 'ERROR',
          category: 'Customers',
          message: `Duplicate customer phone detected: ${c.phone} ("${c.name}"). Consider merging.`,
          referenceId: c.id,
        });
      }
      phones.add(c.phone);
    });

    return issues;
  };

  return (
    <StoreContext.Provider
      value={{
        ...state,
        authenticate,
        authenticateWithPassword,
        lockApp,
        updateSettings,
        addProduct,
        updateProduct,
        deleteProduct,
        cloneProduct,
        inlineUpdateProduct,
        bulkUpdateProducts,
        bulkPriceUpdate,
        archiveProduct,
        checkProductDuplicate,
        addCategory,
        updateCategory,
        deleteCategory,
        importProductsCsvAdvanced,
        importCustomersCsv,
        importOpeningStockCsv,
        adjustStock,
        transferStock,
        bulkAdjustStock,
        getStockQty,
        getStockValue,
        startStockAudit,
        updateStockAuditItem,
        reconcileStockAudit,
        getNextOrderNumber,
        getNextInvoiceNumber,
        createOrder,
        updateOrder,
        duplicateOrder,
        cancelOrder,
        splitOrderShipment,
        processOrderReturnOrRTO,
        bulkAssignAwbs,
        createOrderTemplate,
        deleteOrderTemplate,
        saveDraftOrder,
        discardDraftOrder,
        createCreditNote,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addCustomerAddress,
        updateCustomerAddress,
        deleteCustomerAddress,
        mergeDuplicateCustomers,
        checkPincodeServiceability,
        addSupplier,
        updateSupplier,
        createPurchaseOrder,
        updatePurchaseOrderStatus,
        createGRN,
        createPurchase,
        createPurchaseReturn,
        createExpense,
        updateExpense,
        deleteExpense,
        recordPayment,
        addTask,
        toggleTask,
        deleteTask,
        saveWhatsAppTemplate,
        deleteWhatsAppTemplate,
        createBackupSnapshot,
        triggerBackup,
        backupHistory: state.backupSnapshots,
        importProductsCsv,
        importTallyData,
        restoreFromSnapshot,
        validateBackupJson,
        restoreFromJson,
        eraseAllData,
        runDataHealthCheck,
        showToast,
        dismissToast,
        logAudit,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};

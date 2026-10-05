import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Order,
  OrderItem,
  Customer,
  DeliveryStatus,
  PaymentStatus,
  OrderSource,
  CustomerType,
  StockLocation,
  SplitShipment,
} from '../../types';
import { formatINR, calculateItemTax, isGujaratState } from '../../utils/gst';
import {
  openWhatsAppLink,
  generateOrderConfirmationMessage,
  generateShippingTrackingMessage,
  generatePaymentReminderMessage,
  generateReviewRequestMessage,
} from '../../utils/whatsapp';
import {
  Plus,
  Search,
  Filter,
  Copy,
  Printer,
  FileText,
  Truck,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Scan,
  X,
  ExternalLink,
  RotateCcw,
  Split,
  BookmarkCheck,
  FileSpreadsheet,
  Globe,
  Share2,
  Lock,
  Eye,
  Check,
} from 'lucide-react';
import { BarcodeScannerModal } from '../scanner/BarcodeScannerModal';

interface OrdersViewProps {
  onViewInvoice: (order: Order) => void;
  onViewLabel: (order: Order) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onViewInvoice, onViewLabel }) => {
  const {
    orders,
    customers,
    products,
    settings,
    orderTemplates,
    draftOrders,
    getStockQty,
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
    saveDraftOrder,
    discardDraftOrder,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('ALL');

  // Modals State
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSplitShipmentOpen, setIsSplitShipmentOpen] = useState(false);
  const [selectedOrderForSplit, setSelectedOrderForSplit] = useState<Order | null>(null);

  const [isRtoModalOpen, setIsRtoModalOpen] = useState(false);
  const [selectedOrderForRto, setSelectedOrderForRto] = useState<Order | null>(null);
  const [rtoReason, setRtoReason] = useState('Customer rejected package at delivery doorstep');
  const [rtoLocation, setRtoLocation] = useState<StockLocation>('Returns');

  const [isBulkAwbModalOpen, setIsBulkAwbModalOpen] = useState(false);
  const [bulkAwbText, setBulkAwbText] = useState('');

  const [isStatusPageOpen, setIsStatusPageOpen] = useState(false);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState<Order | null>(null);

  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedOrderForWa, setSelectedOrderForWa] = useState<Order | null>(null);
  const [customWaMessage, setCustomWaMessage] = useState('');

  // New Order Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustType, setNewCustType] = useState<CustomerType>('B2C');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustDiscount, setNewCustDiscount] = useState<number>(0);
  const [shippingAddress, setShippingAddress] = useState({
    addressLine: '',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395002',
  });

  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [orderSource, setOrderSource] = useState<OrderSource>('WhatsApp');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('Pending');
  const [courierName, setCourierName] = useState<string>(settings.savedCouriers[0] || 'Delhivery Express');
  const [customCourier, setCustomCourier] = useState('');
  const [awbNumber, setAwbNumber] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');

  // Item selector state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [customRate, setCustomRate] = useState<string>('');

  // Split shipment form state
  const [splitCourier, setSplitCourier] = useState(settings.savedCouriers[0] || 'Delhivery Express');
  const [splitAwb, setSplitAwb] = useState('');
  const [splitQtys, setSplitQtys] = useState<Record<string, number>>({});

  // Auto-save draft when form changes
  const activeDraft = draftOrders[0];

  const handleOpenNewOrder = () => {
    setSelectedCustomerId(customers[0]?.id || '');
    setIsNewCustomer(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustType('B2C');
    setNewCustGstin('');
    setNewCustDiscount(0);

    const firstCust = customers[0];
    if (firstCust) {
      const defAddr = firstCust.addresses.find(a => a.isDefault) || firstCust.addresses[0];
      setShippingAddress({
        addressLine: defAddr?.addressLine || 'Surat Market',
        city: defAddr?.city || 'Surat',
        state: defAddr?.state || 'Gujarat',
        pincode: defAddr?.pincode || '395002',
      });
      if (firstCust.type === 'B2B') {
        const d = new Date();
        d.setDate(d.getDate() + (firstCust.creditDays || 30));
        setDueDate(d.toISOString().split('T')[0]);
      }
    }

    setOrderDate(new Date().toISOString().split('T')[0]);
    setOrderSource('WhatsApp');
    setOrderItems([]);
    setPaymentStatus('Unpaid');
    setAmountPaid(0);
    setDeliveryStatus('Pending');
    setCourierName(settings.savedCouriers[0] || 'Delhivery Express');
    setCustomCourier('');
    setAwbNumber('');
    setOrderNotes('');
    setInternalNotes('');
    setIsOrderModalOpen(true);
  };

  // Resume Draft Order
  const handleResumeDraft = () => {
    if (!activeDraft) return;
    setSelectedCustomerId(activeDraft.customerId || '');
    setOrderItems(activeDraft.items || []);
    setOrderNotes(activeDraft.notes || '');
    setInternalNotes(activeDraft.internalNotes || '');
    setOrderSource(activeDraft.source || 'Direct');
    setCourierName(activeDraft.courierName || settings.savedCouriers[0] || 'Delhivery');
    setAwbNumber(activeDraft.awbNumber || '');
    setIsOrderModalOpen(true);
  };

  // Load from Template
  const handleLoadTemplate = (tplId: string) => {
    const tpl = orderTemplates.find(t => t.id === tplId);
    if (!tpl) return;

    if (tpl.customerId) {
      setSelectedCustomerId(tpl.customerId);
      const c = customers.find(x => x.id === tpl.customerId);
      if (c) {
        const defAddr = c.addresses.find(a => a.isDefault) || c.addresses[0];
        setShippingAddress({
          addressLine: defAddr?.addressLine || 'Surat',
          city: defAddr?.city || 'Surat',
          state: defAddr?.state || 'Gujarat',
          pincode: defAddr?.pincode || '395002',
        });
      }
    }

    // Build items
    const loadedItems: OrderItem[] = [];
    tpl.items.forEach(it => {
      const p = products.find(prod => prod.id === it.productId);
      if (p) {
        const isGuj = isGujaratState(shippingAddress.state);
        const itemTax = calculateItemTax(it.unitPrice * it.qty, p.gstPercent, isGuj);
        loadedItems.push({
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
          productId: p.id,
          variantId: it.variantId,
          name: p.name,
          sku: it.sku || p.sku || 'SKU',
          hsn: p.hsn,
          gstPercent: p.gstPercent,
          unitPrice: it.unitPrice,
          qty: it.qty,
          discount: 0,
          taxableAmount: itemTax.taxableAmount,
          cgstAmount: itemTax.cgstAmount,
          sgstAmount: itemTax.sgstAmount,
          igstAmount: itemTax.igstAmount,
          totalAmount: itemTax.grandTotal,
          hasBattery: p.hasBattery,
          batteryType: p.batteryType,
        });
      }
    });

    setOrderItems(loadedItems);
  };

  // Add Item to Order
  const handleAddItem = () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const currentCustomer = isNewCustomer
      ? { type: newCustType, discountPercent: newCustDiscount }
      : customers.find(c => c.id === selectedCustomerId) || { type: 'B2C', discountPercent: 0 };

    let effectivePrice = customRate ? parseFloat(customRate) : prod.retailPrice;

    // Apply B2B discount if from base price
    if (!customRate && currentCustomer.type === 'B2B' && currentCustomer.discountPercent > 0) {
      effectivePrice = Math.round(prod.retailPrice * (1 - currentCustomer.discountPercent / 100));
    }

    const isGuj = isGujaratState(shippingAddress.state);

    if (prod.type === 'Combo' && prod.comboChildren && prod.comboChildren.length > 0) {
      // Slab-wise combo item
      let comboTaxableTotal = 0;
      let comboCgstTotal = 0;
      let comboSgstTotal = 0;
      let comboIgstTotal = 0;
      let comboTotalAmount = 0;

      const comboChildrenDetails = prod.comboChildren.map(child => {
        const childTax = calculateItemTax(child.retailPrice * (child.qty * itemQty), child.gstPercent, isGuj);
        comboTaxableTotal += childTax.taxableAmount;
        comboCgstTotal += childTax.cgstAmount;
        comboSgstTotal += childTax.sgstAmount;
        comboIgstTotal += childTax.igstAmount;
        comboTotalAmount += childTax.grandTotal;

        return {
          productId: child.productId,
          variantId: child.variantId,
          name: child.name,
          qty: child.qty * itemQty,
          hsn: child.hsn,
          gstPercent: child.gstPercent,
          taxableAmount: childTax.taxableAmount,
          cgstAmount: childTax.cgstAmount,
          sgstAmount: childTax.sgstAmount,
          igstAmount: childTax.igstAmount,
        };
      });

      const newItem: OrderItem = {
        id: 'oi-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        productId: prod.id,
        name: prod.name,
        sku: prod.sku || 'COMBO',
        hsn: prod.hsn,
        gstPercent: prod.gstPercent,
        unitPrice: effectivePrice,
        qty: itemQty,
        discount: 0,
        taxableAmount: comboTaxableTotal,
        cgstAmount: comboCgstTotal,
        sgstAmount: comboSgstTotal,
        igstAmount: comboIgstTotal,
        totalAmount: comboTotalAmount,
        hasBattery: prod.hasBattery,
        isCombo: true,
        comboChildrenDetails,
      };

      setOrderItems([...orderItems, newItem]);
    } else {
      const itemTax = calculateItemTax(effectivePrice * itemQty, prod.gstPercent, isGuj);
      const variantObj = prod.variants?.find(v => v.id === selectedVariantId);
      const itemName = variantObj ? `${prod.name} (${variantObj.title})` : prod.name;
      const itemSku = variantObj?.sku || prod.sku || 'SKU';

      const newItem: OrderItem = {
        id: 'oi-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        productId: prod.id,
        variantId: selectedVariantId || undefined,
        name: itemName,
        sku: itemSku,
        hsn: prod.hsn,
        gstPercent: prod.gstPercent,
        unitPrice: effectivePrice,
        qty: itemQty,
        discount: 0,
        taxableAmount: itemTax.taxableAmount,
        cgstAmount: itemTax.cgstAmount,
        sgstAmount: itemTax.sgstAmount,
        igstAmount: itemTax.igstAmount,
        totalAmount: itemTax.grandTotal,
        hasBattery: prod.hasBattery,
        batteryType: prod.batteryType,
      };

      setOrderItems([...orderItems, newItem]);
    }

    // Reset item selector
    setSelectedProductId('');
    setSelectedVariantId('');
    setItemQty(1);
    setCustomRate('');
  };

  // Order Totals
  const orderSubtotal = orderItems.reduce((sum, it) => sum + it.taxableAmount, 0);
  const orderCgst = orderItems.reduce((sum, it) => sum + it.cgstAmount, 0);
  const orderSgst = orderItems.reduce((sum, it) => sum + it.sgstAmount, 0);
  const orderIgst = orderItems.reduce((sum, it) => sum + it.igstAmount, 0);
  const orderTaxTotal = orderCgst + orderSgst + orderIgst;
  const rawGrandTotal = orderSubtotal + orderTaxTotal;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

  // Save Order
  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    let custId = selectedCustomerId;
    let custName = '';
    let custPhone = '';
    let custType: CustomerType = 'B2C';
    let custGstin = '';

    if (isNewCustomer) {
      custId = 'cust-' + Date.now();
      custName = newCustName;
      custPhone = newCustPhone;
      custType = newCustType;
      custGstin = newCustGstin;
    } else {
      const c = customers.find(x => x.id === selectedCustomerId);
      if (c) {
        custName = c.name;
        custPhone = c.phone;
        custType = c.type;
        custGstin = c.gstin || '';
      }
    }

    const effectiveCourier = courierName === 'CUSTOM' ? customCourier : courierName;

    const created = createOrder({
      customerId: custId,
      customerName: custName,
      customerPhone: custPhone,
      customerType: custType,
      customerGstin: custGstin,
      shippingAddress,
      billingAddress: shippingAddress,
      orderDate,
      dueDate,
      items: orderItems,
      subtotal: orderSubtotal,
      discountPercent: custType === 'B2B' ? (isNewCustomer ? newCustDiscount : customers.find(x => x.id === custId)?.discountPercent || 0) : 0,
      discountAmount: 0,
      isGujarat: isGujaratState(shippingAddress.state),
      cgstTotal: orderCgst,
      sgstTotal: orderSgst,
      igstTotal: orderIgst,
      taxTotal: orderTaxTotal,
      roundOff,
      grandTotal: roundedGrandTotal,
      paymentStatus,
      amountPaid: paymentStatus === 'Paid' ? roundedGrandTotal : amountPaid,
      deliveryStatus,
      source: orderSource,
      courierName: effectiveCourier,
      awbNumber,
      notes: orderNotes,
      internalNotes,
    });

    // Clear active draft if matching
    if (activeDraft) {
      discardDraftOrder(activeDraft.id);
    }

    setIsOrderModalOpen(false);
    // User requirement: Invoice 1st afterwards label
    onViewInvoice(created);
  };

  // Execute Split Shipment
  const handleExecuteSplit = () => {
    if (!selectedOrderForSplit) return;
    const splitItems = selectedOrderForSplit.items
      .map(it => ({
        productId: it.productId,
        variantId: it.variantId,
        name: it.name,
        sku: it.sku,
        qty: splitQtys[it.id] || 0,
      }))
      .filter(it => it.qty > 0);

    if (splitItems.length === 0) return;

    splitOrderShipment(selectedOrderForSplit.id, {
      courierName: splitCourier,
      awbNumber: splitAwb || `AWB-${Date.now().toString().slice(-6)}`,
      shippedDate: new Date().toISOString().split('T')[0],
      items: splitItems,
    });

    setIsSplitShipmentOpen(false);
    setSelectedOrderForSplit(null);
  };

  // Execute RTO / Return
  const handleExecuteRto = () => {
    if (!selectedOrderForRto) return;
    processOrderReturnOrRTO(selectedOrderForRto.id, {
      isRTO: true,
      reason: rtoReason,
      restockToLocation: rtoLocation,
    });
    setIsRtoModalOpen(false);
    setSelectedOrderForRto(null);
  };

  // Bulk AWB Mapping commit
  const handleCommitBulkAwbs = () => {
    if (!bulkAwbText.trim()) return;
    const lines = bulkAwbText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const mappings: Array<{ orderNoOrId: string; courierName: string; awbNumber: string }> = [];

    lines.forEach(line => {
      // Formats supported:
      // ORD-2026-0001, DEL123456
      // ORD-2026-0001: DEL123456
      // ORD-2026-0001   Blue Dart   BLU998877
      const parts = line.split(/[,:\t]+/).map(p => p.trim());
      if (parts.length >= 2) {
        const orderNo = parts[0];
        const awbNumber = parts.length >= 3 ? parts[2] : parts[1];
        const courier = parts.length >= 3 ? parts[1] : 'Delhivery Express';
        mappings.push({ orderNoOrId: orderNo, courierName: courier, awbNumber });
      }
    });

    bulkAssignAwbs(mappings);
    setIsBulkAwbModalOpen(false);
    setBulkAwbText('');
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'ALL' && o.deliveryStatus !== statusFilter) return false;
      if (paymentFilter !== 'ALL' && o.paymentStatus !== paymentFilter) return false;
      if (sourceFilter !== 'ALL' && o.source !== sourceFilter) return false;
      if (customerTypeFilter !== 'ALL' && o.customerType !== customerTypeFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchNo = o.orderNo.toLowerCase().includes(term);
      const matchInv = o.invoiceNo?.toLowerCase().includes(term);
      const matchCust = o.customerName.toLowerCase().includes(term);
      const matchPhone = o.customerPhone.includes(term);
      const matchAwb = o.awbNumber?.toLowerCase().includes(term);
      const matchItems = o.items.some(
        it => it.name.toLowerCase().includes(term) || it.sku.toLowerCase().includes(term)
      );

      return matchNo || matchInv || matchCust || matchPhone || matchAwb || matchItems;
    });
  }, [orders, statusFilter, paymentFilter, sourceFilter, customerTypeFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            Orders & Dispatches
          </h1>
          <p className="text-xs text-neutral-500">
            Split shipments, RTO returns, AWB bulk entry, and WhatsApp dispatches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBulkAwbModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            Bulk Paste AWBs
          </button>

          <button
            onClick={handleOpenNewOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New Order (N)
          </button>
        </div>
      </div>

      {/* Draft Resume Alert Banner */}
      {activeDraft && !isOrderModalOpen && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Unfinished Draft Order found: {activeDraft.customerName || 'Pending'} ({activeDraft.items.length} items)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResumeDraft}
              className="px-2.5 py-1 bg-amber-600 text-white font-bold hover:bg-amber-700 text-xs rounded"
            >
              Resume Draft
            </button>
            <button
              onClick={() => discardDraftOrder(activeDraft.id)}
              className="px-2 py-1 text-neutral-500 hover:text-black dark:hover:text-white"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search order no, customer, phone, AWB, SKU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black focus:outline-none"
            />
          </div>

          {/* Delivery Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-medium"
          >
            <option value="ALL">All Delivery (6 States)</option>
            <option value="Pending">Pending</option>
            <option value="Packed">Packed</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="RTO">RTO (Returned)</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-medium"
          >
            <option value="ALL">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Unpaid">Unpaid</option>
            <option value="COD">COD</option>
          </select>

          {/* Customer Type Filter */}
          <select
            value={customerTypeFilter}
            onChange={e => setCustomerTypeFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-medium"
          >
            <option value="ALL">B2B & B2C</option>
            <option value="B2B">B2B Wholesale</option>
            <option value="B2C">B2C Retail</option>
          </select>
        </div>

        <span className="text-xs font-mono text-neutral-500">
          Showing {filteredOrders.length} of {orders.length} orders
        </span>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
              <th className="p-3">Order / Inv #</th>
              <th className="p-3">Date / Due</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Items Summary</th>
              <th className="p-3">Courier / AWB</th>
              <th className="p-3 text-right">Grand Total (₹)</th>
              <th className="p-3 text-center">Payment</th>
              <th className="p-3 text-center">Delivery</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
            {filteredOrders.map(order => {
              const balanceDue = Math.max(0, order.grandTotal - order.amountPaid);

              return (
                <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3">
                    <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 block">
                      {order.orderNo}
                    </span>
                    {order.invoiceNo && (
                      <span className="text-[11px] font-mono text-neutral-500 block">
                        {order.invoiceNo}
                      </span>
                    )}
                    {order.shipments && order.shipments.length > 0 && (
                      <span className="text-[10px] font-mono bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1 py-0.2 rounded mt-0.5 inline-block">
                        Split ({order.shipments.length})
                      </span>
                    )}
                  </td>

                  <td className="p-3 font-mono text-neutral-500 whitespace-nowrap">
                    <div>{order.orderDate}</div>
                    <div className="text-[10px] text-neutral-400">Due: {order.dueDate}</div>
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <span>{order.customerName}</span>
                      <span
                        className={`text-[10px] font-mono px-1 py-0.2 border ${
                          order.customerType === 'B2B'
                            ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                        }`}
                      >
                        {order.customerType}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {order.customerPhone} · {order.shippingAddress.city}, {order.shippingAddress.state}
                    </div>
                    {order.internalNotes && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Private: {order.internalNotes}</span>
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-neutral-600 dark:text-neutral-400 max-w-xs">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {order.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                    </span>
                  </td>

                  <td className="p-3 font-mono text-xs">
                    {order.courierName ? (
                      <div>
                        <span className="font-semibold block">{order.courierName}</span>
                        <span className="text-[11px] text-neutral-500">{order.awbNumber || 'No AWB'}</span>
                      </div>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>

                  <td className="p-3 text-right font-mono font-bold">
                    <div className="text-sm">{formatINR(order.grandTotal)}</div>
                    {balanceDue > 0 && order.paymentStatus !== 'Paid' && (
                      <div className="text-[10px] text-red-600 font-normal">
                        Due: {formatINR(balanceDue)}
                      </div>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                        order.paymentStatus === 'Paid'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : order.paymentStatus === 'Partial'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : order.paymentStatus === 'COD'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded uppercase ${
                        order.deliveryStatus === 'Delivered'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : order.deliveryStatus === 'Shipped'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : order.deliveryStatus === 'RTO'
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          : order.deliveryStatus === 'Cancelled'
                          ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {order.deliveryStatus}
                    </span>
                  </td>

                  {/* Actions (Workflow: 1st Invoice, 2nd Shipping Label) */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Step 1: Invoice */}
                      <button
                        onClick={() => onViewInvoice(order)}
                        className="px-2 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-[10px] font-mono font-bold flex items-center gap-1 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition shadow-2xs"
                        title="Step 1: View / Print Invoice"
                      >
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>1. Invoice</span>
                      </button>

                      {/* Step 2: Shipping Label */}
                      <button
                        onClick={() => onViewLabel(order)}
                        className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-[10px] font-mono font-bold flex items-center gap-1 hover:bg-amber-100 dark:hover:bg-amber-900 transition shadow-2xs"
                        title="Step 2: Print Courier Shipping Label"
                      >
                        <Truck className="w-3 h-3 text-amber-600" />
                        <span>2. Label</span>
                      </button>

                      {/* Split Shipment Button */}
                      <button
                        onClick={() => {
                          setSelectedOrderForSplit(order);
                          const qtys: Record<string, number> = {};
                          order.items.forEach(it => {
                            qtys[it.id] = Math.ceil(it.qty / 2);
                          });
                          setSplitQtys(qtys);
                          setIsSplitShipmentOpen(true);
                        }}
                        className="p-1 text-neutral-400 hover:text-blue-600 transition"
                        title="Split Shipment"
                      >
                        <Split className="w-3.5 h-3.5" />
                      </button>

                      {/* Return / RTO */}
                      {order.deliveryStatus !== 'Cancelled' && (
                        <button
                          onClick={() => {
                            setSelectedOrderForRto(order);
                            setIsRtoModalOpen(true);
                          }}
                          className="p-1 text-neutral-500 hover:text-purple-600"
                          title="Process Return / RTO"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Customer Status Page */}
                      <button
                        onClick={() => {
                          setSelectedOrderForStatus(order);
                          setIsStatusPageOpen(true);
                        }}
                        className="p-1 text-neutral-500 hover:text-emerald-600"
                        title="Customer Order Status View"
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </button>

                      {/* WhatsApp Dispatch */}
                      <button
                        onClick={() => {
                          setSelectedOrderForWa(order);
                          setCustomWaMessage(
                            generateOrderConfirmationMessage(order, settings)
                          );
                          setIsWhatsAppModalOpen(true);
                        }}
                        className="p-1 text-neutral-500 hover:text-green-600"
                        title="WhatsApp Dispatch & Templates"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => duplicateOrder(order.id)}
                        className="p-1 text-neutral-500 hover:text-blue-600"
                        title="Duplicate Order"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Cancel Order */}
                      {order.deliveryStatus !== 'Cancelled' && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          className="p-1 text-neutral-400 hover:text-red-600"
                          title="Cancel Order & Revert Stock"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-4xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 border-neutral-200 dark:border-neutral-800">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-500" />
                Create New Order / Dispatch
              </h2>
              <div className="flex items-center gap-2">
                {orderTemplates.length > 0 && (
                  <select
                    onChange={e => e.target.value && handleLoadTemplate(e.target.value)}
                    className="p-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="">⚡ Load Template...</option>
                    {orderTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <button onClick={() => setIsOrderModalOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
              {/* Customer Selector Section */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide">Customer Selection</span>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(!isNewCustomer)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {isNewCustomer ? '← Choose Existing Customer' : '+ New Customer'}
                  </button>
                </div>

                {!isNewCustomer ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Select Customer</label>
                      <select
                        value={selectedCustomerId}
                        onChange={e => {
                          setSelectedCustomerId(e.target.value);
                          const c = customers.find(x => x.id === e.target.value);
                          if (c) {
                            const def = c.addresses.find(a => a.isDefault) || c.addresses[0];
                            setShippingAddress({
                              addressLine: def?.addressLine || 'Surat Market',
                              city: def?.city || 'Surat',
                              state: def?.state || 'Gujarat',
                              pincode: def?.pincode || '395002',
                            });
                          }
                        }}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type} · {c.phone})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Shipping Address</label>
                      <input
                        type="text"
                        value={shippingAddress.addressLine}
                        onChange={e => setShippingAddress({ ...shippingAddress, addressLine: e.target.value })}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Customer Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Royal Automobiles"
                        value={newCustName}
                        onChange={e => setNewCustName(e.target.value)}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Mobile / WhatsApp *</label>
                      <input
                        type="text"
                        required
                        placeholder="10 digit phone"
                        value={newCustPhone}
                        onChange={e => setNewCustPhone(e.target.value)}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Type</label>
                      <select
                        value={newCustType}
                        onChange={e => setNewCustType(e.target.value as CustomerType)}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                      >
                        <option value="B2C">B2C Retail</option>
                        <option value="B2B">B2B Wholesale</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">GSTIN</label>
                      <input
                        type="text"
                        placeholder="15 character GSTIN"
                        value={newCustGstin}
                        onChange={e => setNewCustGstin(e.target.value)}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Order Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Order Source</label>
                  <select
                    value={orderSource}
                    onChange={e => setOrderSource(e.target.value as OrderSource)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Amazon">Amazon</option>
                    <option value="Flipkart">Flipkart</option>
                    <option value="B2B">B2B Wholesale</option>
                    <option value="Direct">Direct Store Walk-in</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Courier Delivery Partner</label>
                  <select
                    value={courierName}
                    onChange={e => setCourierName(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    {settings.savedCouriers.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Custom Courier Name...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">AWB Tracking Number</label>
                  <input
                    type="text"
                    placeholder="e.g. DEL-9988123"
                    value={awbNumber}
                    onChange={e => setAwbNumber(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid in Full</option>
                    <option value="Partial">Partial Advance</option>
                    <option value="COD">COD (Cash on Delivery)</option>
                  </select>
                </div>
              </div>

              {/* Private Notes vs Customer Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Customer Notes (Printed on Invoice)</label>
                  <input
                    type="text"
                    placeholder="e.g. Call before dispatch; leave at gate"
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  />
                </div>
                <div>
                  <label className="block text-amber-700 dark:text-amber-400 mb-1 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Internal Remarks (Private - Hidden from Customer)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Client requested 5% extra cash discount on next batch"
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    className="w-full p-2 border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
                  />
                </div>
              </div>

              {/* Add Item Row */}
              <div className="p-3 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 space-y-2">
                <span className="font-bold block uppercase tracking-wide">Add Products to Order</span>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <select
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                    >
                      <option value="">Select product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatINR(p.retailPrice)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={itemQty}
                      onChange={e => setItemQty(parseInt(e.target.value || '1', 10))}
                      className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-3">
                    <input
                      type="number"
                      placeholder="Custom Rate (₹)"
                      value={customRate}
                      onChange={e => setCustomRate(e.target.value)}
                      className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProductId}
                      className="w-full py-2 bg-black text-white dark:bg-white dark:text-black font-bold disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-100 dark:bg-neutral-800">
                    <tr>
                      <th className="p-2">Description</th>
                      <th className="p-2">HSN</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Taxable</th>
                      <th className="p-2 text-right">Tax (GST)</th>
                      <th className="p-2 text-right">Total (₹)</th>
                      <th className="p-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 font-sans font-semibold">{it.name}</td>
                        <td className="p-2">{it.hsn}</td>
                        <td className="p-2 text-right font-bold">{it.qty}</td>
                        <td className="p-2 text-right">{formatINR(it.unitPrice)}</td>
                        <td className="p-2 text-right">{formatINR(it.taxableAmount)}</td>
                        <td className="p-2 text-right">
                          {formatINR(it.cgstAmount + it.sgstAmount + it.igstAmount)}
                        </td>
                        <td className="p-2 text-right font-bold">{formatINR(it.totalAmount)}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                            className="text-neutral-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {orderItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-neutral-400 italic">
                          No items added to this order yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Order Totals Summary */}
              {orderItems.length > 0 && (
                <div className="flex justify-end">
                  <div className="w-64 space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Taxable Value:</span>
                      <span>{formatINR(orderSubtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">GST Taxes:</span>
                      <span>{formatINR(orderTaxTotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm border-t pt-1">
                      <span>Grand Total:</span>
                      <span className="text-base">{formatINR(roundedGrandTotal)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={orderItems.length === 0}
                  className="px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold text-xs disabled:opacity-40 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confirm &amp; Open Invoice (1st) &rarr;</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Shipment Modal */}
      {isSplitShipmentOpen && selectedOrderForSplit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Split className="w-4 h-4 text-blue-600" />
                Split Shipment for {selectedOrderForSplit.orderNo}
              </h2>
              <button onClick={() => setIsSplitShipmentOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Ship part of this order right now with its own AWB, and keep the rest pending.
            </p>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Courier</label>
                  <select
                    value={splitCourier}
                    onChange={e => setSplitCourier(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    {settings.savedCouriers.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">AWB Tracking #</label>
                  <input
                    type="text"
                    placeholder="e.g. DEL-SPLIT-9988"
                    value={splitAwb}
                    onChange={e => setSplitAwb(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                  />
                </div>
              </div>

              {/* Items Quantity Selection */}
              <div className="space-y-2 border p-3">
                <span className="font-bold block">Select Quantities to Dispatch in this Part:</span>
                {selectedOrderForSplit.items.map(it => (
                  <div key={it.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold block">{it.name}</span>
                      <span className="text-[10px] text-neutral-500">Total in order: {it.qty}</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={it.qty}
                      value={splitQtys[it.id] || 0}
                      onChange={e =>
                        setSplitQtys({ ...splitQtys, [it.id]: parseInt(e.target.value || '0', 10) })
                      }
                      className="w-20 p-1 border font-mono text-right font-bold text-xs"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setIsSplitShipmentOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleExecuteSplit}
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs"
                >
                  Confirm Split Dispatch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RTO / Return Modal */}
      {isRtoModalOpen && selectedOrderForRto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                Process Return / RTO for {selectedOrderForRto.orderNo}
              </h2>
              <button onClick={() => setIsRtoModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Mark this order as returned. Items will be automatically restocked into the chosen godown.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Restock Destination Godown</label>
                <select
                  value={rtoLocation}
                  onChange={e => setRtoLocation(e.target.value as StockLocation)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  <option value="Returns">Returns Godown</option>
                  <option value="Damaged">Damaged Godown</option>
                  <option value="Own">Own Primary Godown</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Reason for Return / RTO</label>
                <input
                  type="text"
                  value={rtoReason}
                  onChange={e => setRtoReason(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setIsRtoModalOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleExecuteRto}
                  className="px-4 py-1.5 bg-purple-600 text-white font-bold text-xs"
                >
                  Restock & Mark RTO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk AWB Paste Modal */}
      {isBulkAwbModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                Bulk Paste Courier AWBs
              </h2>
              <button onClick={() => setIsBulkAwbModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Paste order numbers and their AWBs line-by-line. The system will match and assign tracking numbers automatically.
            </p>

            <div className="p-2 bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono">
              <strong>Example format (one per line):</strong>
              <div>ORD-2026-0001, DEL99881234</div>
              <div>ORD-2026-0002, Blue Dart, BLU774411</div>
            </div>

            <textarea
              rows={6}
              placeholder="Paste line by line here..."
              value={bulkAwbText}
              onChange={e => setBulkAwbText(e.target.value)}
              className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono text-xs"
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsBulkAwbModalOpen(false)} className="px-3 py-1.5 border text-xs">
                Cancel
              </button>
              <button
                onClick={handleCommitBulkAwbs}
                className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs"
              >
                Match & Assign AWBs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Status Page Modal */}
      {isStatusPageOpen && selectedOrderForStatus && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-neutral-500">Customer Status Page</span>
                <h3 className="font-bold text-base">Order #{selectedOrderForStatus.orderNo}</h3>
              </div>
              <button onClick={() => setIsStatusPageOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Timeline */}
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Order Placed ({selectedOrderForStatus.orderDate})</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    ['Packed', 'Shipped', 'Delivered'].includes(selectedOrderForStatus.deliveryStatus)
                      ? 'text-green-600'
                      : 'text-neutral-300'
                  }`}
                />
                <span>Packed & QC Inspected</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    ['Shipped', 'Delivered'].includes(selectedOrderForStatus.deliveryStatus)
                      ? 'text-green-600'
                      : 'text-neutral-300'
                  }`}
                />
                <span>
                  Dispatched via {selectedOrderForStatus.courierName || 'Surface Courier'}
                  {selectedOrderForStatus.awbNumber && ` (AWB: ${selectedOrderForStatus.awbNumber})`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    selectedOrderForStatus.deliveryStatus === 'Delivered'
                      ? 'text-green-600'
                      : 'text-neutral-300'
                  }`}
                />
                <span>Delivered to {selectedOrderForStatus.shippingAddress.city}</span>
              </div>
            </div>

            {/* Item summary */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border text-xs">
              <span className="font-bold block mb-1">Package Contents:</span>
              {selectedOrderForStatus.items.map(it => (
                <div key={it.id} className="flex justify-between">
                  <span>{it.qty}x {it.name}</span>
                  <span className="font-mono">{formatINR(it.totalAmount)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs font-mono font-bold">Total: {formatINR(selectedOrderForStatus.grandTotal)}</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Track your order ${selectedOrderForStatus.orderNo}: Dispatched via ${selectedOrderForStatus.courierName} with AWB ${selectedOrderForStatus.awbNumber}`
                  );
                  alert('Status snippet copied to clipboard!');
                }}
                className="px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-semibold"
              >
                Copy Link Snippet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Dispatch & Template Selector Modal */}
      {isWhatsAppModalOpen && selectedOrderForWa && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2 text-green-600">
                <MessageSquare className="w-4 h-4" />
                WhatsApp Message Dispatcher ({selectedOrderForWa.customerPhone})
              </h2>
              <button onClick={() => setIsWhatsAppModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Selector */}
            <div className="space-y-1 text-xs">
              <label className="font-semibold block">Select Template:</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setCustomWaMessage(generateOrderConfirmationMessage(selectedOrderForWa, settings))
                  }
                  className="px-2 py-1 border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px]"
                >
                  Confirmation
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomWaMessage(generateShippingTrackingMessage(selectedOrderForWa, settings))
                  }
                  className="px-2 py-1 border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px]"
                >
                  Shipping & Tracking
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomWaMessage(generatePaymentReminderMessage(selectedOrderForWa, settings))
                  }
                  className="px-2 py-1 border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px]"
                >
                  Overdue Reminder + UPI
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCustomWaMessage(generateReviewRequestMessage(selectedOrderForWa, settings))
                  }
                  className="px-2 py-1 border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px]"
                >
                  Warranty & Review
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={customWaMessage}
              onChange={e => setCustomWaMessage(e.target.value)}
              className="w-full p-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-sans text-xs"
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsWhatsAppModalOpen(false)} className="px-3 py-1.5 border text-xs">
                Cancel
              </button>
              <button
                onClick={() => {
                  openWhatsAppLink(selectedOrderForWa.customerPhone, customWaMessage);
                  setIsWhatsAppModalOpen(false);
                }}
                className="px-4 py-1.5 bg-green-600 text-white font-bold text-xs hover:bg-green-700"
              >
                Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

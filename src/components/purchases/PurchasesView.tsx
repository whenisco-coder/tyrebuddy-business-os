import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Supplier,
  Purchase,
  PurchaseOrder,
  GoodsReceiptNote,
  PurchaseReturn,
  PurchaseItem,
  StockLocation,
} from '../../types';
import { formatINR } from '../../utils/gst';
import {
  ShoppingBag,
  Plus,
  Truck,
  FileCheck,
  Search,
  Building,
  RotateCcw,
  X,
  FileText,
  DollarSign,
  ClipboardList,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const {
    suppliers,
    purchases,
    purchaseOrders,
    goodsReceiptNotes,
    purchaseReturns,
    products,
    payments,
    addSupplier,
    createPurchaseOrder,
    updatePurchaseOrderStatus,
    createGRN,
    createPurchase,
    createPurchaseReturn,
    recordPayment,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'po' | 'grn' | 'bills' | 'returns' | 'suppliers'>('po');
  const [searchTerm, setSearchTerm] = useState('');

  // PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<PurchaseItem[]>([]);

  // GRN Modal
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [grnPoId, setGrnPoId] = useState<string>('');
  const [grnSupplierId, setGrnSupplierId] = useState('');
  const [grnLocation, setGrnLocation] = useState<StockLocation>('Own');
  const [grnFreight, setGrnFreight] = useState<number>(1000);
  const [grnOtherCharges, setGrnOtherCharges] = useState<number>(0);
  const [grnItems, setGrnItems] = useState<Array<PurchaseItem & { receivedQty: number }>>([]);

  // Purchase Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnSupplierId, setReturnSupplierId] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged bead / defective batch returned to distributor');
  const [returnItems, setReturnItems] = useState<Array<{ productId: string; name: string; qty: number; costPerUnit: number; gstPercent: number; hsn: string }>>([]);

  // Supplier Modal & Payment Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supGstin, setSupGstin] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supState, setSupState] = useState('Gujarat');
  const [supNotes, setSupNotes] = useState('');

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);

  // Line item selector in modals
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [itemQty, setItemQty] = useState<number>(10);
  const [itemCost, setItemCost] = useState<number>(products[0]?.costPrice || 3450);

  // Supplier Ledger calculation
  const supplierLedger = useMemo(() => {
    return suppliers.map(sup => {
      const supPurchases = purchases.filter(p => p.supplierId === sup.id);
      const totalBilled = supPurchases.reduce((s, p) => s + p.grandTotal, 0);

      const supPayments = payments.filter(p => p.supplierId === sup.id && p.type === 'OUT');
      const totalPaid = supPayments.reduce((s, p) => s + p.amount, 0);

      const supReturns = purchaseReturns.filter(r => r.supplierId === sup.id);
      const totalRefunded = supReturns.reduce((s, r) => s + r.totalRefundAmount, 0);

      const outstanding = Math.max(0, totalBilled - totalPaid - totalRefunded);

      return {
        supplier: sup,
        totalBilled,
        totalPaid,
        totalRefunded,
        outstanding,
      };
    });
  }, [suppliers, purchases, payments, purchaseReturns]);

  // Open PO Modal
  const handleOpenNewPo = () => {
    setPoSupplierId(suppliers[0]?.id || '');
    setPoDate(new Date().toISOString().split('T')[0]);
    setPoExpectedDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setPoNotes('');
    setPoItems([]);
    setIsPoModalOpen(true);
  };

  // Add Item to PO
  const handleAddPoItem = () => {
    const p = products.find(prod => prod.id === selectedProdId);
    if (!p) return;

    setPoItems([
      ...poItems,
      {
        productId: p.id,
        name: p.name,
        qty: itemQty,
        costPerUnit: itemCost,
        gstPercent: p.gstPercent,
        hsn: p.hsn,
      },
    ]);
  };

  // Save PO
  const handleSavePo = (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) return;
    const sup = suppliers.find(s => s.id === poSupplierId);

    const subtotal = poItems.reduce((s, it) => s + it.qty * it.costPerUnit, 0);
    const taxTotal = poItems.reduce((s, it) => s + (it.qty * it.costPerUnit * it.gstPercent) / 100, 0);

    createPurchaseOrder({
      supplierId: poSupplierId,
      supplierName: sup?.name || 'Supplier',
      date: poDate,
      expectedDate: poExpectedDate || undefined,
      items: poItems,
      status: 'Issued',
      notes: poNotes || undefined,
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
    });

    setIsPoModalOpen(false);
  };

  // Open GRN Modal against a PO
  const handleOpenGrnForPo = (po: PurchaseOrder) => {
    setGrnPoId(po.id);
    setGrnSupplierId(po.supplierId);
    setGrnLocation('Own');
    setGrnFreight(800);
    setGrnOtherCharges(0);
    setGrnItems(
      po.items.map(it => ({
        ...it,
        receivedQty: it.qty,
      }))
    );
    setIsGrnModalOpen(true);
  };

  // Save GRN with freight allocated across line items
  const handleSaveGrn = (e: React.FormEvent) => {
    e.preventDefault();
    if (grnItems.length === 0) return;
    const sup = suppliers.find(s => s.id === grnSupplierId);

    const totalUnits = grnItems.reduce((s, it) => s + it.receivedQty, 0);
    const totalFreight = grnFreight + grnOtherCharges;
    const freightPerUnit = totalUnits > 0 ? totalFreight / totalUnits : 0;

    const allocatedItems = grnItems.map(it => ({
      ...it,
      allocatedFreight: freightPerUnit,
      effectiveCostPerUnit: Math.round((it.costPerUnit + freightPerUnit) * 100) / 100,
    }));

    const subtotal = allocatedItems.reduce((s, it) => s + it.receivedQty * it.costPerUnit, 0);
    const taxTotal = allocatedItems.reduce((s, it) => s + (it.receivedQty * it.costPerUnit * it.gstPercent) / 100, 0);
    const grandTotal = subtotal + taxTotal + totalFreight;

    createGRN({
      poId: grnPoId || undefined,
      supplierId: grnSupplierId,
      supplierName: sup?.name || 'Supplier',
      receivedDate: new Date().toISOString().split('T')[0],
      location: grnLocation,
      items: allocatedItems,
      freight: grnFreight,
      otherCharges: grnOtherCharges,
      grandTotal,
      notes: 'Received in godown with allocated freight',
    });

    // Also auto-create Purchase Bill matching the GRN
    createPurchase({
      poId: grnPoId || undefined,
      supplierId: grnSupplierId,
      supplierName: sup?.name || 'Supplier',
      billDate: new Date().toISOString().split('T')[0],
      items: grnItems.map(it => ({
        productId: it.productId,
        name: it.name,
        qty: it.receivedQty,
        costPerUnit: it.costPerUnit,
        gstPercent: it.gstPercent,
        hsn: it.hsn,
      })),
      freight: grnFreight,
      subtotal,
      taxTotal,
      grandTotal,
      location: grnLocation,
      status: 'Received',
    });

    setIsGrnModalOpen(false);
  };

  // Save Purchase Return
  const handleSavePurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnItems.length === 0) return;
    const sup = suppliers.find(s => s.id === returnSupplierId);

    const totalRefund = returnItems.reduce((s, it) => {
      const lineCost = it.qty * it.costPerUnit;
      const lineTax = (lineCost * it.gstPercent) / 100;
      return s + lineCost + lineTax;
    }, 0);

    createPurchaseReturn({
      supplierId: returnSupplierId,
      supplierName: sup?.name || 'Supplier',
      date: new Date().toISOString().split('T')[0],
      items: returnItems.map(it => ({
        productId: it.productId,
        name: it.name,
        qty: it.qty,
        costPerUnit: it.costPerUnit,
        gstPercent: it.gstPercent,
        hsn: it.hsn,
        refundAmount: it.qty * it.costPerUnit * (1 + it.gstPercent / 100),
      })),
      totalRefundAmount: totalRefund,
      reason: returnReason,
    });

    setIsReturnModalOpen(false);
  };

  // Record payment to supplier
  const handleSaveSupplierPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) return;
    const sup = suppliers.find(s => s.id === paySupplierId);

    recordPayment({
      supplierId: paySupplierId,
      supplierName: sup?.name,
      amount: payAmount,
      mode: 'Bank',
      type: 'OUT',
      date: new Date().toISOString().split('T')[0],
      note: `Payment to supplier ${sup?.name}`,
    });

    setIsPayModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            Purchases, PO, GRN & Supplier Ledger
          </h1>
          <p className="text-xs text-neutral-500">
            Create Purchase Orders, receive via GRN with allocated freight, manage vendor ledgers and returns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setReturnSupplierId(suppliers[0]?.id || '');
              setReturnItems([
                {
                  productId: products[0]?.id || '',
                  name: products[0]?.name || 'Product',
                  qty: 2,
                  costPerUnit: products[0]?.costPrice || 3450,
                  gstPercent: products[0]?.gstPercent || 28,
                  hsn: products[0]?.hsn || '40111010',
                },
              ]);
              setIsReturnModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 bg-purple-50 dark:bg-purple-950/40 text-xs font-semibold hover:bg-purple-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Purchase Return
          </button>

          <button
            onClick={() => {
              setGrnPoId('');
              setGrnSupplierId(suppliers[0]?.id || '');
              setGrnLocation('Own');
              setGrnFreight(800);
              setGrnOtherCharges(0);
              setGrnItems([
                {
                  productId: products[0]?.id || '',
                  name: products[0]?.name || 'Product',
                  qty: 20,
                  receivedQty: 20,
                  costPerUnit: products[0]?.costPrice || 3450,
                  gstPercent: products[0]?.gstPercent || 28,
                  hsn: products[0]?.hsn || '40111010',
                },
              ]);
              setIsGrnModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            New GRN Inward
          </button>

          <button
            onClick={handleOpenNewPo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order (PO)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('po')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'po'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Purchase Orders ({purchaseOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'grn'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          Goods Receipt Notes (GRN) ({goodsReceiptNotes.length})
        </button>

        <button
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'bills'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Purchase Bills ({purchases.length})
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'returns'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Purchase Returns ({purchaseReturns.length})
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'suppliers'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          Suppliers Master & Ledger ({suppliers.length})
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS (PO) */}
      {activeTab === 'po' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">PO Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Items Ordered</th>
                <th className="p-3 text-right">PO Total (₹)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {purchaseOrders.map(po => (
                <tr key={po.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 font-mono font-bold">{po.poNo}</td>
                  <td className="p-3 font-mono text-neutral-500">{po.date}</td>
                  <td className="p-3 font-semibold">{po.supplierName}</td>
                  <td className="p-3 text-neutral-600 max-w-xs">
                    {po.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-sm">
                    {formatINR(po.grandTotal)}
                  </td>
                  <td className="p-3 text-center font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        po.status === 'Received'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950'
                          : po.status === 'Issued'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950'
                          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800'
                      }`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {po.status !== 'Received' ? (
                      <button
                        onClick={() => handleOpenGrnForPo(po)}
                        className="px-2 py-1 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
                      >
                        Receive Goods (GRN)
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400 font-mono">✓ Received</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: GOODS RECEIPT NOTES (GRN) */}
      {activeTab === 'grn' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">GRN #</th>
                <th className="p-3">Received Date</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Landed Godown</th>
                <th className="p-3">Items Received & Landed Cost</th>
                <th className="p-3 text-right">Freight (₹)</th>
                <th className="p-3 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {goodsReceiptNotes.map(grn => (
                <tr key={grn.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 font-mono font-bold">{grn.grnNo}</td>
                  <td className="p-3 font-mono text-neutral-500">{grn.receivedDate}</td>
                  <td className="p-3 font-semibold">{grn.supplierName}</td>
                  <td className="p-3 font-mono">
                    <span className="px-1.5 py-0.5 border bg-neutral-100 dark:bg-neutral-800 text-[10px]">
                      {grn.location}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {grn.items.map((it, idx) => (
                      <div key={idx} className="text-neutral-700 dark:text-neutral-300">
                        {it.receivedQty}x {it.name} · Landed: {formatINR(it.effectiveCostPerUnit)}/u
                      </div>
                    ))}
                  </td>
                  <td className="p-3 text-right font-mono">{formatINR(grn.freight)}</td>
                  <td className="p-3 text-right font-mono font-bold text-sm">
                    {formatINR(grn.grandTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PURCHASE BILLS */}
      {activeTab === 'bills' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">Bill Number</th>
                <th className="p-3">Bill Date</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Items Inwarded</th>
                <th className="p-3 text-right">Freight</th>
                <th className="p-3 text-right">Grand Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {purchases.map(pur => (
                <tr key={pur.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 font-mono font-bold">{pur.purchaseNo}</td>
                  <td className="p-3 font-mono text-neutral-500">{pur.billDate}</td>
                  <td className="p-3 font-semibold">{pur.supplierName}</td>
                  <td className="p-3 text-neutral-600">
                    {pur.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                  </td>
                  <td className="p-3 text-right font-mono">{formatINR(pur.freight)}</td>
                  <td className="p-3 text-right font-mono font-bold text-sm">
                    {formatINR(pur.grandTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: PURCHASE RETURNS */}
      {activeTab === 'returns' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">Return #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Items Returned</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-right">Refund / Debit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {purchaseReturns.map(ret => (
                <tr key={ret.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 font-mono font-bold text-purple-700">{ret.returnNo}</td>
                  <td className="p-3 font-mono text-neutral-500">{ret.date}</td>
                  <td className="p-3 font-semibold">{ret.supplierName}</td>
                  <td className="p-3 text-neutral-600">
                    {ret.items.map(it => `${it.qty}x ${it.name}`).join(', ')}
                  </td>
                  <td className="p-3 text-neutral-500 text-xs italic">{ret.reason}</td>
                  <td className="p-3 text-right font-mono font-bold text-sm text-purple-700">
                    {formatINR(ret.totalRefundAmount)}
                  </td>
                </tr>
              ))}
              {purchaseReturns.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 italic">
                    No supplier purchase returns recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: SUPPLIERS MASTER & LEDGER */}
      {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">Supplier / Vendor</th>
                <th className="p-3">GSTIN & Phone</th>
                <th className="p-3 text-right">Total Purchases</th>
                <th className="p-3 text-right">Total Paid</th>
                <th className="p-3 text-right">Returns / Debit</th>
                <th className="p-3 text-right text-red-600">Outstanding Payable (₹)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {supplierLedger.map(({ supplier, totalBilled, totalPaid, totalRefunded, outstanding }) => (
                <tr key={supplier.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3">
                    <span className="font-semibold block">{supplier.name}</span>
                    <span className="text-[11px] text-neutral-500">{supplier.address}</span>
                  </td>
                  <td className="p-3 font-mono text-neutral-500">
                    <div>{supplier.gstin}</div>
                    <div>{supplier.phone}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{formatINR(totalBilled)}</td>
                  <td className="p-3 text-right font-mono text-green-600">{formatINR(totalPaid)}</td>
                  <td className="p-3 text-right font-mono text-purple-600">{formatINR(totalRefunded)}</td>
                  <td className="p-3 text-right font-mono font-bold text-sm text-red-600">
                    {formatINR(outstanding)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => {
                        setPaySupplierId(supplier.id);
                        setPayAmount(outstanding);
                        setIsPayModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Create Modal */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                Create Purchase Order (PO)
              </h2>
              <button onClick={() => setIsPoModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePo} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Supplier *</label>
                  <select
                    value={poSupplierId}
                    onChange={e => setPoSupplierId(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Expected Date</label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={e => setPoExpectedDate(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>
              </div>

              {/* Add item */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border space-y-2">
                <span className="font-bold block">Add Items to PO:</span>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <select
                      value={selectedProdId}
                      onChange={e => {
                        setSelectedProdId(e.target.value);
                        const p = products.find(prod => prod.id === e.target.value);
                        if (p) setItemCost(p.costPrice);
                      }}
                      className="w-full p-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={itemQty}
                      onChange={e => setItemQty(parseInt(e.target.value || '1', 10))}
                      className="w-full p-1.5 border font-mono text-center"
                    />
                  </div>
                  <div className="col-span-3">
                    <button
                      type="button"
                      onClick={handleAddPoItem}
                      className="w-full py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="border p-2 max-h-36 overflow-auto font-mono text-xs">
                {poItems.map((it, i) => (
                  <div key={i} className="flex justify-between py-1 border-b">
                    <span>{it.qty}x {it.name}</span>
                    <span className="font-bold">{formatINR(it.qty * it.costPerUnit)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setIsPoModalOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={poItems.length === 0}
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs disabled:opacity-40"
                >
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRN Inward Modal with Allocated Freight */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-600" />
                Goods Receipt Note (GRN) & Freight Allocation
              </h2>
              <button onClick={() => setIsGrnModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGrn} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Landing Godown</label>
                  <select
                    value={grnLocation}
                    onChange={e => setGrnLocation(e.target.value as StockLocation)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="Own">Own Primary Godown</option>
                    <option value="Amazon FBA">Amazon FBA Godown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Freight Charge (₹)</label>
                  <input
                    type="number"
                    value={grnFreight}
                    onChange={e => setGrnFreight(parseFloat(e.target.value || '0'))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Other Charges (₹)</label>
                  <input
                    type="number"
                    value={grnOtherCharges}
                    onChange={e => setGrnOtherCharges(parseFloat(e.target.value || '0'))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>
              </div>

              {/* Received Items */}
              <div className="space-y-2 border p-3">
                <span className="font-bold block">Verify Physical Quantities Received:</span>
                {grnItems.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between font-mono">
                    <span className="font-sans font-semibold">{it.name}</span>
                    <input
                      type="number"
                      min="1"
                      value={it.receivedQty}
                      onChange={e => {
                        const updated = [...grnItems];
                        updated[idx].receivedQty = parseInt(e.target.value || '1', 10);
                        setGrnItems(updated);
                      }}
                      className="w-20 p-1 border font-bold text-right"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setIsGrnModalOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-green-600 text-white font-bold text-xs hover:bg-green-700"
                >
                  Commit GRN & Inward Batches
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Record Vendor Payment
              </h2>
              <button onClick={() => setIsPayModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(parseFloat(e.target.value || '0'))}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setIsPayModalOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

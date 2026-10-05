import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { StockLocation, StockMovementType, StockBatch } from '../../types';
import { formatINR } from '../../utils/gst';
import {
  Boxes,
  ArrowRightLeft,
  SlidersHorizontal,
  AlertTriangle,
  History,
  Scan,
  Plus,
  CheckCircle2,
  Warehouse,
  Search,
  ClipboardCheck,
  Clock,
  TrendingDown,
  RotateCcw,
  Check,
  X,
  Play,
  FileSpreadsheet,
} from 'lucide-react';
import { BarcodeScannerModal } from '../scanner/BarcodeScannerModal';

export const StockView: React.FC = () => {
  const {
    products,
    stockBatches,
    stockMovements,
    stockAudits,
    orders,
    getStockQty,
    getStockValue,
    adjustStock,
    transferStock,
    bulkAdjustStock,
    startStockAudit,
    updateStockAuditItem,
    reconcileStockAudit,
  } = useStore();

  const [activeTab, setActiveTab] = useState<
    'inventory' | 'batches' | 'audit' | 'reorder' | 'aging' | 'bulk_adjust' | 'journal'
  >('inventory');
  const [selectedLocation, setSelectedLocation] = useState<StockLocation | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustVariantId, setAdjustVariantId] = useState('');
  const [adjustLocation, setAdjustLocation] = useState<StockLocation>('Own');
  const [adjustType, setAdjustType] = useState<StockMovementType>('COUNT_CORRECTION');
  const [adjustQtyDelta, setAdjustQtyDelta] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Stock Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferProductId, setTransferProductId] = useState('');
  const [transferVariantId, setTransferVariantId] = useState('');
  const [transferFrom, setTransferFrom] = useState<StockLocation>('Own');
  const [transferTo, setTransferTo] = useState<StockLocation>('Amazon FBA');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferReason, setTransferReason] = useState('');

  // Stock Audit State
  const [selectedAuditLocation, setSelectedAuditLocation] = useState<StockLocation>('Own');
  const currentAudit = stockAudits.find(a => a.status === 'In Progress');

  // Dead Stock Window (days)
  const [deadStockDays, setDeadStockDays] = useState<60 | 90 | 120>(60);

  // Bulk Adjust Rows
  const [bulkRows, setBulkRows] = useState<
    Array<{
      productId: string;
      variantId?: string;
      location: StockLocation;
      qtyDelta: number;
      type: StockMovementType;
      reason: string;
      note?: string;
    }>
  >([
    {
      productId: products[0]?.id || '',
      location: 'Own',
      qtyDelta: 5,
      type: 'COUNT_CORRECTION',
      reason: 'Physical count adjustment',
    },
  ]);

  const locations: StockLocation[] = ['Own', 'Damaged', 'Returns', 'Amazon FBA'];
  const totalStockVal = getStockValue();

  // 30-Day Sales Velocity Calculation
  const salesVelocityMap = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const map = new Map<string, number>(); // key: productId, value: units sold

    orders.forEach(o => {
      if (o.deliveryStatus !== 'Cancelled') {
        const orderDate = new Date(o.orderDate);
        if (orderDate >= thirtyDaysAgo) {
          o.items.forEach(it => {
            const current = map.get(it.productId) || 0;
            map.set(it.productId, current + it.qty);
          });
        }
      }
    });
    return map;
  }, [orders]);

  // Reorder Suggestions based on 30-Day Velocity & Lead Time
  const reorderSuggestions = useMemo(() => {
    return products
      .filter(p => !p.isArchived && p.type !== 'Combo')
      .map(p => {
        const unitsSold30Days = salesVelocityMap.get(p.id) || 0;
        const dailyVelocity = unitsSold30Days / 30;
        const currentStock = getStockQty(p.id, undefined, 'Own');
        const daysOfCover = dailyVelocity > 0 ? Math.round(currentStock / dailyVelocity) : 999;

        // Lead time of 7 days buffer + 15 days cycle = 22 days stock needed
        const recommendedMinStock = Math.ceil(dailyVelocity * 22) || p.lowStockThreshold;
        const shortage = Math.max(0, recommendedMinStock - currentStock);
        const shouldReorder = currentStock <= p.lowStockThreshold || daysOfCover <= 10;

        return {
          product: p,
          currentStock,
          unitsSold30Days,
          dailyVelocity: Math.round(dailyVelocity * 10) / 10,
          daysOfCover,
          recommendedMinStock,
          shortage,
          shouldReorder,
        };
      })
      .filter(item => item.shouldReorder)
      .sort((a, b) => a.daysOfCover - b.daysOfCover);
  }, [products, salesVelocityMap, getStockQty]);

  // Dead Stock Calculation (items not sold in 60, 90, 120 days)
  const deadStockItems = useMemo(() => {
    const thresholdDate = new Date(Date.now() - deadStockDays * 86400000);
    const soldProductIds = new Set<string>();

    orders.forEach(o => {
      if (o.deliveryStatus !== 'Cancelled') {
        const orderDate = new Date(o.orderDate);
        if (orderDate >= thresholdDate) {
          o.items.forEach(it => soldProductIds.add(it.productId));
        }
      }
    });

    return products
      .filter(p => !p.isArchived && !soldProductIds.has(p.id))
      .map(p => {
        const stockOwn = getStockQty(p.id, undefined, 'Own');
        const tiedCapital = stockOwn * p.costPrice;
        return {
          product: p,
          stockOwn,
          tiedCapital,
        };
      })
      .filter(item => item.stockOwn > 0)
      .sort((a, b) => b.tiedCapital - a.tiedCapital);
  }, [products, orders, deadStockDays, getStockQty]);

  // Stock Aging Report (Batches categorized by age)
  const stockAgingBuckets = useMemo(() => {
    const now = Date.now();
    const buckets = {
      under30: { label: '0–30 Days (Fresh)', batches: [] as StockBatch[], capital: 0, qty: 0 },
      under60: { label: '31–60 Days (Normal)', batches: [] as StockBatch[], capital: 0, qty: 0 },
      under90: { label: '61–90 Days (Slow)', batches: [] as StockBatch[], capital: 0, qty: 0 },
      over90: { label: '90+ Days (Aged / Stagnant)', batches: [] as StockBatch[], capital: 0, qty: 0 },
    };

    stockBatches.forEach(b => {
      const receivedTime = new Date(b.dateReceived).getTime();
      const ageDays = Math.floor((now - receivedTime) / 86400000);
      const cap = b.qty * b.costPerUnit;

      if (ageDays <= 30) {
        buckets.under30.batches.push(b);
        buckets.under30.capital += cap;
        buckets.under30.qty += b.qty;
      } else if (ageDays <= 60) {
        buckets.under60.batches.push(b);
        buckets.under60.capital += cap;
        buckets.under60.qty += b.qty;
      } else if (ageDays <= 90) {
        buckets.under90.batches.push(b);
        buckets.under90.capital += cap;
        buckets.under90.qty += b.qty;
      } else {
        buckets.over90.batches.push(b);
        buckets.over90.capital += cap;
        buckets.over90.qty += b.qty;
      }
    });

    return buckets;
  }, [stockBatches]);

  // Filtered Products for Inventory Tab
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.isArchived) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        p.brand.toLowerCase().includes(term)
      );
    });
  }, [products, searchTerm]);

  // Filtered Movements for Journal
  const filteredMovements = useMemo(() => {
    return stockMovements.filter(m => {
      if (selectedLocation === 'ALL') return true;
      return m.fromLocation === selectedLocation || m.toLocation === selectedLocation;
    });
  }, [stockMovements, selectedLocation]);

  const handleOpenAdjust = (prodId?: string, varId?: string) => {
    setAdjustProductId(prodId || products[0]?.id || '');
    setAdjustVariantId(varId || '');
    setAdjustLocation('Own');
    setAdjustType('COUNT_CORRECTION');
    setAdjustQtyDelta(1);
    setAdjustReason('Physical stock audit check');
    setAdjustNote('');
    setIsAdjustModalOpen(true);
  };

  const handleOpenTransfer = (prodId?: string, varId?: string) => {
    setTransferProductId(prodId || products[0]?.id || '');
    setTransferVariantId(varId || '');
    setTransferFrom('Own');
    setTransferTo('Amazon FBA');
    setTransferQty(1);
    setTransferReason('Replenishment batch to Amazon FBA warehouse');
    setIsTransferModalOpen(true);
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    adjustStock({
      productId: adjustProductId,
      variantId: adjustVariantId || undefined,
      location: adjustLocation,
      qtyDelta: adjustQtyDelta,
      type: adjustType,
      reason: adjustReason || 'Inventory adjustment',
      note: adjustNote,
    });
    setIsAdjustModalOpen(false);
  };

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferFrom === transferTo) return;
    transferStock({
      productId: transferProductId,
      variantId: transferVariantId || undefined,
      fromLocation: transferFrom,
      toLocation: transferTo,
      qty: transferQty,
      reason: transferReason,
    });
    setIsTransferModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            Stock & FIFO Batch Management
          </h1>
          <p className="text-xs text-neutral-500">
            Own, Damaged, Returns & Amazon FBA inventory, audit reconciliation, and reorder velocity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Scan className="w-3.5 h-3.5" />
            Scan for Count
          </button>

          <button
            onClick={() => handleOpenTransfer()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Stock Transfer
          </button>

          <button
            onClick={() => handleOpenAdjust()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Adjust Stock
          </button>
        </div>
      </div>

      {/* Warehouse Locations Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {locations.map(loc => {
          const locQty = stockBatches
            .filter(b => b.location === loc)
            .reduce((sum, b) => sum + b.qty, 0);
          const locVal = stockBatches
            .filter(b => b.location === loc)
            .reduce((sum, b) => sum + b.qty * b.costPerUnit, 0);

          return (
            <div
              key={loc}
              onClick={() => setSelectedLocation(selectedLocation === loc ? 'ALL' : loc)}
              className={`p-4 border cursor-pointer transition-colors ${
                selectedLocation === loc
                  ? 'border-black dark:border-white bg-neutral-100 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {loc} Godown
                </span>
                <Warehouse className="w-4 h-4 text-neutral-400" />
              </div>
              <div className="text-2xl font-bold font-mono mt-1">{locQty} units</div>
              <span className="text-[11px] font-mono text-neutral-500 block mt-0.5">
                {formatINR(locVal)} tied
              </span>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold gap-1">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          Inventory Levels
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'batches'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          FIFO Cost Batches ({stockBatches.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
          Stock Audit Mode {currentAudit && '🔴'}
        </button>

        <button
          onClick={() => setActiveTab('reorder')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'reorder'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          Reorder Suggestions ({reorderSuggestions.length})
        </button>

        <button
          onClick={() => setActiveTab('aging')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'aging'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          Aging & Dead Stock
        </button>

        <button
          onClick={() => setActiveTab('bulk_adjust')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'bulk_adjust'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Bulk Stock Adjust
        </button>

        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 border-b-2 flex items-center gap-1.5 ${
            activeTab === 'journal'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Movement Journal ({stockMovements.length})
        </button>
      </div>

      {/* TAB 1: INVENTORY LEVELS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search stock by SKU, name, brand..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black focus:outline-none"
              />
            </div>
            <div className="text-xs font-mono font-bold">
              Total Godown Valuation: {formatINR(totalStockVal)}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                  <th className="p-3">Product / SKU</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Own Godown</th>
                  <th className="p-3 text-right">Amazon FBA</th>
                  <th className="p-3 text-right">Returns</th>
                  <th className="p-3 text-right">Damaged</th>
                  <th className="p-3 text-right">Total Qty</th>
                  <th className="p-3 text-right">Total Value (₹)</th>
                  <th className="p-3 text-center">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
                {filteredProducts.map(prod => {
                  const own = getStockQty(prod.id, undefined, 'Own');
                  const fba = getStockQty(prod.id, undefined, 'Amazon FBA');
                  const returns = getStockQty(prod.id, undefined, 'Returns');
                  const damaged = getStockQty(prod.id, undefined, 'Damaged');
                  const total = own + fba + returns + damaged;
                  const totalVal = total * prod.costPrice;
                  const isLow = own <= prod.lowStockThreshold;

                  return (
                    <tr key={prod.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                      <td className="p-3">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {prod.sku || 'No SKU'} · {prod.brand}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs">{prod.type}</td>
                      <td className="p-3 text-right font-mono">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-xs ${
                            isLow
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {own}
                        </span>
                        {isLow && (
                          <span className="block text-[9px] text-red-600">
                            Low (limit {prod.lowStockThreshold})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {fba}
                      </td>
                      <td className="p-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {returns}
                      </td>
                      <td className="p-3 text-right font-mono text-red-600 dark:text-red-400">
                        {damaged}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{total}</td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {formatINR(totalVal)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenTransfer(prod.id)}
                            className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                            title="Transfer Stock"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenAdjust(prod.id)}
                            className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                            title="Adjust Stock"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FIFO BATCHES */}
      {activeTab === 'batches' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                <th className="p-3">Batch ID</th>
                <th className="p-3">Date Received</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Location</th>
                <th className="p-3 text-right">Batch Qty</th>
                <th className="p-3 text-right">Cost / Unit (₹)</th>
                <th className="p-3 text-right">Batch Value (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {stockBatches.map(batch => {
                const prod = products.find(p => p.id === batch.productId);
                const batchVal = batch.qty * batch.costPerUnit;

                return (
                  <tr key={batch.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="p-3 font-bold">{batch.id}</td>
                    <td className="p-3 text-neutral-500">{batch.dateReceived}</td>
                    <td className="p-3 font-sans font-semibold text-neutral-900 dark:text-neutral-100">
                      {prod?.name || batch.productId}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 border text-[10px]">
                        {batch.location}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold">{batch.qty}</td>
                    <td className="p-3 text-right">{formatINR(batch.costPerUnit)}</td>
                    <td className="p-3 text-right font-bold text-neutral-800 dark:text-neutral-200">
                      {formatINR(batchVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: STOCK AUDIT MODE */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-600" />
                Physical Stock Audit & Discrepancy Reconciliation
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Freeze current book quantities, input physical count, and reconcile shortages or surplus in 1 click.
              </p>
            </div>

            {!currentAudit ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedAuditLocation}
                  onChange={e => setSelectedAuditLocation(e.target.value as StockLocation)}
                  className="px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs font-semibold"
                >
                  {locations.map(loc => (
                    <option key={loc} value={loc}>
                      Audit Location: {loc}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => startStockAudit(selectedAuditLocation)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start New Audit
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-100 text-amber-900 px-2.5 py-1 rounded font-mono font-bold">
                  Audit Active ({currentAudit.location})
                </span>
                <button
                  onClick={() => reconcileStockAudit(currentAudit.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-xs font-bold hover:bg-green-700"
                >
                  <Check className="w-3.5 h-3.5" />
                  Reconcile Discrepancies & Update Stock
                </button>
              </div>
            )}
          </div>

          {currentAudit ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                    <th className="p-3">Product Name & SKU</th>
                    <th className="p-3 text-right">System Qty (Book)</th>
                    <th className="p-3 text-right">Counted Qty (Physical)</th>
                    <th className="p-3 text-right">Discrepancy</th>
                    <th className="p-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {currentAudit.items.map((item, idx) => {
                    const isDiff = item.discrepancy !== 0;

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
                          isDiff ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="p-3">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                            {item.productName}
                          </span>
                          <span className="text-[11px] text-neutral-500">{item.sku}</span>
                        </td>
                        <td className="p-3 text-right font-bold">{item.systemQty}</td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.countedQty}
                            onChange={e =>
                              updateStockAuditItem(currentAudit.id, idx, parseInt(e.target.value || '0', 10))
                            }
                            className="w-20 p-1 text-right font-mono border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-bold text-xs"
                          />
                        </td>
                        <td className="p-3 text-right font-bold">
                          <span
                            className={
                              item.discrepancy > 0
                                ? 'text-green-600'
                                : item.discrepancy < 0
                                ? 'text-red-600'
                                : 'text-neutral-400'
                            }
                          >
                            {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                          </span>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            placeholder="Reason for difference..."
                            value={item.note || ''}
                            onChange={e => updateStockAuditItem(currentAudit.id, idx, item.countedQty, e.target.value)}
                            className="w-full p-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-neutral-300 text-neutral-500 text-xs">
              No audit currently in progress. Select a godown location above and click "Start New Audit" to freeze and verify stock counts.
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REORDER SUGGESTIONS & VELOCITY */}
      {activeTab === 'reorder' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Dynamic Reorder Suggestions (30-Day Sales Velocity)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Calculated using actual units dispatched over the last 30 days and 7-day supplier lead time buffer.
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                  <th className="p-3">Product Name & SKU</th>
                  <th className="p-3 text-right">30-Day Sales</th>
                  <th className="p-3 text-right">Daily Velocity</th>
                  <th className="p-3 text-right">Own Godown</th>
                  <th className="p-3 text-right">Days Cover Left</th>
                  <th className="p-3 text-right">Recommended Min</th>
                  <th className="p-3 text-right">Suggested Reorder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {reorderSuggestions.map((item, i) => (
                  <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="p-3 font-sans">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                        {item.product.name}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {item.product.sku} · {item.product.brand}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold">{item.unitsSold30Days} units</td>
                    <td className="p-3 text-right">{item.dailyVelocity} / day</td>
                    <td className="p-3 text-right font-bold text-red-600">{item.currentStock}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`font-bold px-2 py-0.5 rounded ${
                          item.daysOfCover <= 7
                            ? 'bg-red-100 text-red-800 dark:bg-red-950'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950'
                        }`}
                      >
                        {item.daysOfCover} days
                      </span>
                    </td>
                    <td className="p-3 text-right text-neutral-600">{item.recommendedMinStock}</td>
                    <td className="p-3 text-right font-bold text-blue-600 text-sm">
                      +{item.shortage} units
                    </td>
                  </tr>
                ))}
                {reorderSuggestions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-400 italic">
                      All products have healthy inventory velocity! No urgent restock required.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: AGING & DEAD STOCK */}
      {activeTab === 'aging' && (
        <div className="space-y-6">
          {/* Stock Aging Breakdown */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Stock Aging Buckets (Capital Tied in Batches)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {Object.entries(stockAgingBuckets).map(([k, bucket]) => (
                <div key={k} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-mono font-bold uppercase text-neutral-500 block">
                    {bucket.label}
                  </span>
                  <div className="text-xl font-bold font-mono mt-1">{formatINR(bucket.capital)}</div>
                  <span className="text-xs text-neutral-500 font-mono mt-0.5 block">
                    {bucket.qty} units across {bucket.batches.length} batches
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dead Stock Report */}
          <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  Dead Stock Analysis (Zero Dispatches)
                </h3>
                <p className="text-xs text-neutral-500">
                  Items holding cash that haven't sold in the selected period.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span>Inactivity Window:</span>
                {[60, 90, 120].map(d => (
                  <button
                    key={d}
                    onClick={() => setDeadStockDays(d as any)}
                    className={`px-2.5 py-1 border ${
                      deadStockDays === d
                        ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                    <th className="p-3">Product Name & SKU</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Cost / Unit</th>
                    <th className="p-3 text-right">Stuck Godown Stock</th>
                    <th className="p-3 text-right">Capital Tied Up (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {deadStockItems.map((item, i) => (
                    <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                      <td className="p-3 font-sans font-semibold">
                        {item.product.name}
                        <span className="block text-[11px] text-neutral-500 font-mono">
                          {item.product.sku}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-neutral-600">{item.product.category}</td>
                      <td className="p-3 text-right font-mono">{formatINR(item.product.costPrice)}</td>
                      <td className="p-3 text-right font-mono font-bold text-red-600">{item.stockOwn}</td>
                      <td className="p-3 text-right font-mono font-bold text-red-600 text-sm">
                        {formatINR(item.tiedCapital)}
                      </td>
                    </tr>
                  ))}
                  {deadStockItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-neutral-400 italic">
                        No dead stock detected! All products have seen movement within {deadStockDays} days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: BULK STOCK ADJUST */}
      {activeTab === 'bulk_adjust' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                Multi-Item Bulk Stock Adjustment
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Adjust stock quantities across multiple products in a single screen without multiple modals.
              </p>
            </div>
            <button
              onClick={() =>
                setBulkRows([
                  ...bulkRows,
                  {
                    productId: products[0]?.id || '',
                    location: 'Own',
                    qtyDelta: 1,
                    type: 'COUNT_CORRECTION',
                    reason: 'Bulk adjustment',
                  },
                ])
              }
              className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            {bulkRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-5">
                  <select
                    value={row.productId}
                    onChange={e => {
                      const updated = [...bulkRows];
                      updated[idx].productId = e.target.value;
                      setBulkRows(updated);
                    }}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold text-xs"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <select
                    value={row.location}
                    onChange={e => {
                      const updated = [...bulkRows];
                      updated[idx].location = e.target.value as StockLocation;
                      setBulkRows(updated);
                    }}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    placeholder="Qty Delta (+ or -)"
                    value={row.qtyDelta}
                    onChange={e => {
                      const updated = [...bulkRows];
                      updated[idx].qtyDelta = parseInt(e.target.value || '0', 10);
                      setBulkRows(updated);
                    }}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Reason..."
                    value={row.reason}
                    onChange={e => {
                      const updated = [...bulkRows];
                      updated[idx].reason = e.target.value;
                      setBulkRows(updated);
                    }}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs"
                  />
                </div>

                <div className="col-span-1 text-center">
                  <button
                    onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                    className="p-1 text-neutral-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => {
                  bulkAdjustStock(bulkRows);
                  setBulkRows([
                    {
                      productId: products[0]?.id || '',
                      location: 'Own',
                      qtyDelta: 1,
                      type: 'COUNT_CORRECTION',
                      reason: 'Bulk adjustment',
                    },
                  ]);
                }}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
              >
                Apply All Adjustments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: MOVEMENT JOURNAL */}
      {activeTab === 'journal' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Product Name & SKU</th>
                <th className="p-3">Type</th>
                <th className="p-3">From Location</th>
                <th className="p-3">To Location</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredMovements.map(m => (
                <tr key={m.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 text-neutral-500 whitespace-nowrap">
                    {new Date(m.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-sans font-semibold">
                    {m.productName}
                    <span className="block text-[10px] text-neutral-400 font-mono">{m.sku}</span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 border text-[10px]">
                      {m.type}
                    </span>
                  </td>
                  <td className="p-3 text-neutral-500">{m.fromLocation || '—'}</td>
                  <td className="p-3 text-neutral-500">{m.toLocation || '—'}</td>
                  <td className="p-3 text-right font-bold">{m.qty}</td>
                  <td className="p-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                    {m.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                Adjust Stock Quantity
              </h2>
              <button onClick={() => setIsAdjustModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Product *</label>
                <select
                  value={adjustProductId}
                  onChange={e => setAdjustProductId(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku || p.barcode || 'Single'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Location *</label>
                  <select
                    value={adjustLocation}
                    onChange={e => setAdjustLocation(e.target.value as StockLocation)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Adjustment Type *</label>
                  <select
                    value={adjustType}
                    onChange={e => setAdjustType(e.target.value as StockMovementType)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  >
                    <option value="COUNT_CORRECTION">Count Correction</option>
                    <option value="ADJUST_IN">Manual Inward (+)</option>
                    <option value="ADJUST_OUT">Manual Outward (-)</option>
                    <option value="DAMAGE">Mark Damaged (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">
                  Quantity Delta (Positive to add, Negative to deduct) *
                </label>
                <input
                  type="number"
                  required
                  value={adjustQtyDelta}
                  onChange={e => setAdjustQtyDelta(parseInt(e.target.value || '0', 10))}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physical count reconciliation"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                Inter-Godown Stock Transfer
              </h2>
              <button onClick={() => setIsTransferModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Product *</label>
                <select
                  value={transferProductId}
                  onChange={e => setTransferProductId(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">From Location *</label>
                  <select
                    value={transferFrom}
                    onChange={e => setTransferFrom(e.target.value as StockLocation)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">To Location *</label>
                  <select
                    value={transferTo}
                    onChange={e => setTransferTo(e.target.value as StockLocation)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Quantity to Move *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={e => setTransferQty(parseInt(e.target.value || '1', 10))}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Transfer Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. FBA replenishment dispatch"
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        mode="count"
        onClose={() => setIsScannerOpen(false)}
        onScanResult={(barcode: string) => {
          setIsScannerOpen(false);
          const found = products.find(p => p.barcode === barcode || p.sku === barcode);
          if (found) {
            handleOpenAdjust(found.id);
          }
        }}
      />
    </div>
  );
};

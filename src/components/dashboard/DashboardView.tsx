import React, { useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatINR } from '../../utils/gst';
import {
  ShoppingBag,
  IndianRupee,
  Clock,
  Truck,
  AlertTriangle,
  Plus,
  Scan,
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { openWhatsAppLink, generatePaymentReminderMessage } from '../../utils/whatsapp';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
  onOpenOrderModal: () => void;
  onOpenScanner: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenOrderModal,
  onOpenScanner,
}) => {
  const { orders, products, customers, settings, getStockQty } = useStore();

  const todayStr = new Date().toISOString().split('T')[0];

  // Today's metrics
  const todayOrders = useMemo(() => {
    return orders.filter(o => o.orderDate === todayStr);
  }, [orders, todayStr]);

  // Overall metrics & Today metrics
  const todayRevenue = todayOrders.reduce((s, o) => s + o.grandTotal, 0);
  const totalUnpaid = orders
    .filter(o => o.paymentStatus !== 'Paid')
    .reduce((s, o) => s + (o.grandTotal - o.amountPaid), 0);
  const codPending = orders
    .filter(o => o.paymentStatus === 'COD' && o.deliveryStatus !== 'Delivered')
    .reduce((s, o) => s + o.grandTotal, 0);

  // Low stock top 10
  const lowStockTop10 = useMemo(() => {
    return products
      .map(p => ({
        product: p,
        stock: getStockQty(p.id),
      }))
      .filter(item => item.stock <= item.product.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);
  }, [products, getStockQty]);

  // B2B overdue list (orders past due date)
  const b2bOverdueList = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return orders
      .filter(o => {
        const isB2B = o.customerType === 'B2B';
        const unpaid = o.grandTotal - o.amountPaid > 0;
        const pastDue = new Date(o.dueDate).getTime() < today;
        return isB2B && unpaid && pastDue;
      })
      .map(o => ({
        order: o,
        balance: o.grandTotal - o.amountPaid,
        daysOverdue: Math.floor((today - new Date(o.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {settings.businessName}
          </h1>
          <p className="text-xs text-neutral-500 font-mono mt-0.5">
            Surat, Gujarat · State Code 24 · GSTIN: {settings.gstin}
          </p>
        </div>

        {/* 4 Core Quick Buttons (Locked spec: New Order · New Purchase · Scan · Adjust Stock) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenOrderModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
          <button
            type="button"
            onClick={() => onNavigate('purchases')}
            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            New Purchase
          </button>
          <button
            type="button"
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold"
          >
            <Scan className="w-4 h-4" />
            Barcode Scan
          </button>
          <button
            type="button"
            onClick={() => onNavigate('stock')}
            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Adjust Stock
          </button>
        </div>
      </div>

      {/* Today Key Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today Orders */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-neutral-900 dark:border-l-neutral-100 flex flex-col justify-between shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase">
            <span>Today's Orders</span>
            <ShoppingBag className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100 tabular-nums">
              {todayOrders.length}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Total lifetime: {orders.length} orders
            </div>
          </div>
        </div>

        {/* Metric 2: Today Revenue */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-emerald-600 flex flex-col justify-between shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase">
            <span>Today's Revenue</span>
            <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100 tabular-nums">
              {formatINR(todayRevenue)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Gujarat & Inter-state</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Total Unpaid Credit */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-amber-500 flex flex-col justify-between shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase">
            <span>Unpaid Receivables</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums">
              {formatINR(totalUnpaid)}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
              B2B 30-day & B2C same-day dues
            </div>
          </div>
        </div>

        {/* Metric 4: COD Pending Remittance */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 border-l-4 border-l-blue-600 flex flex-col justify-between shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 text-xs font-mono uppercase">
            <span>COD In-Transit</span>
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-neutral-100 tabular-nums">
              {formatINR(codPending)}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
              Full order COD amount with courier
            </div>
          </div>
        </div>
      </div>

      {/* Dual Section Grid: Low Stock Top 10 + B2B Overdue List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Low Stock Top 10 */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-bold uppercase text-neutral-900 dark:text-neutral-100 font-mono">
                Low-Stock Top 10 Alert
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1"
            >
              <span>Manage Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {lowStockTop10.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                All inventory levels are healthy and above minimum thresholds.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-500">
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Current Stock</th>
                    <th className="py-2 text-center">Threshold</th>
                    <th className="py-2 text-right">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
                  {lowStockTop10.map(({ product, stock }) => (
                    <tr key={product.id}>
                      <td className="py-2 font-sans font-medium text-neutral-900 dark:text-neutral-100">
                        {product.name}
                        {product.hasBattery && (
                          <span className="ml-1.5 text-[9px] font-mono text-amber-700">
                            [BATTERY]
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-center font-bold text-red-600 tabular-nums">
                        {stock}
                      </td>
                      <td className="py-2 text-center text-neutral-400 tabular-nums">
                        {product.lowStockThreshold}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatINR(product.costPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: B2B Overdue Accounts */}
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-bold uppercase text-neutral-900 dark:text-neutral-100 font-mono">
                B2B Overdue Invoices
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('credit')}
              className="text-xs font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1"
            >
              <span>View Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {b2bOverdueList.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500">
                No B2B accounts are currently overdue. All invoices within 30-day window!
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 font-mono text-[11px] text-neutral-500">
                    <th className="py-2">Order # & Customer</th>
                    <th className="py-2">Due Date</th>
                    <th className="py-2 text-right">Balance</th>
                    <th className="py-2 text-right">WhatsApp Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
                  {b2bOverdueList.map(({ order, balance, daysOverdue }) => (
                    <tr key={order.id}>
                      <td className="py-2 font-sans font-medium text-neutral-900 dark:text-neutral-100">
                        <div>{order.orderNo}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {order.customerName}
                        </div>
                      </td>
                      <td className="py-2 font-mono">
                        <div>{order.dueDate}</div>
                        <div className="text-[10px] text-red-600 font-bold">
                          +{daysOverdue} days past
                        </div>
                      </td>
                      <td className="py-2 text-right font-bold tabular-nums text-sm text-neutral-900 dark:text-neutral-100">
                        {formatINR(balance)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            openWhatsAppLink(
                              order.customerPhone,
                              generatePaymentReminderMessage(order, settings, balance)
                            )
                          }
                          className="px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 font-semibold"
                        >
                          <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                          Remind
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

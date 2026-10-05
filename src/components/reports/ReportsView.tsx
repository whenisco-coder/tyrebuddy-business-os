import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { formatINR } from '../../utils/gst';
import { openWhatsAppLink } from '../../utils/whatsapp';
import {
  BarChart3,
  Calendar,
  Printer,
  Share2,
  TrendingUp,
  PieChart,
  FileText,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Building,
  Receipt,
  Download,
} from 'lucide-react';
import { exportToCsv } from '../../utils/export';

export const ReportsView: React.FC = () => {
  const {
    orders,
    products,
    customers,
    settings,
    expenses,
    purchases,
    payments,
    getStockQty,
    getStockValue,
  } = useStore();

  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'pnl' | 'cashflow' | 'gst' | 'closing'>('sales');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  // Filter orders by period
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'daily') {
      return orders.filter(o => o.orderDate === todayStr && o.deliveryStatus !== 'Cancelled');
    } else if (period === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      return orders.filter(o => o.orderDate >= oneWeekAgo && o.deliveryStatus !== 'Cancelled');
    } else {
      const oneMonthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      return orders.filter(o => o.orderDate >= oneMonthAgo && o.deliveryStatus !== 'Cancelled');
    }
  }, [orders, period]);

  // Filter expenses by period
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'daily') {
      return expenses.filter(e => e.date === todayStr);
    } else if (period === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      return expenses.filter(e => e.date >= oneWeekAgo);
    } else {
      const oneMonthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      return expenses.filter(e => e.date >= oneMonthAgo);
    }
  }, [expenses, period]);

  // Filter purchases by period
  const filteredPurchases = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'daily') {
      return purchases.filter(p => p.billDate === todayStr);
    } else if (period === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      return purchases.filter(p => p.billDate >= oneWeekAgo);
    } else {
      const oneMonthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      return purchases.filter(p => p.billDate >= oneMonthAgo);
    }
  }, [purchases, period]);

  // Filter payments by period
  const filteredPayments = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (period === 'daily') {
      return payments.filter(p => p.date === todayStr);
    } else if (period === 'weekly') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      return payments.filter(p => p.date >= oneWeekAgo);
    } else {
      const oneMonthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      return payments.filter(p => p.date >= oneMonthAgo);
    }
  }, [payments, period]);

  // Aggregate Sales stats
  const totalRev = filteredOrders.reduce((s, o) => s + o.grandTotal, 0);
  const totalTaxableSales = filteredOrders.reduce((s, o) => s + o.subtotal, 0);
  const totalB2bRev = filteredOrders
    .filter(o => o.customerType === 'B2B')
    .reduce((s, o) => s + o.grandTotal, 0);
  const totalB2cRev = filteredOrders
    .filter(o => o.customerType === 'B2C')
    .reduce((s, o) => s + o.grandTotal, 0);
  const totalUnpaidInPeriod = filteredOrders
    .filter(o => o.paymentStatus !== 'Paid')
    .reduce((s, o) => s + (o.grandTotal - o.amountPaid), 0);

  // Top products sold
  const productSalesMap = new Map<string, { name: string; qty: number; total: number }>();
  filteredOrders.forEach(o => {
    o.items.forEach(it => {
      const ex = productSalesMap.get(it.productId) || { name: it.name, qty: 0, total: 0 };
      ex.qty += it.qty;
      ex.total += it.totalAmount;
      productSalesMap.set(it.productId, ex);
    });
  });

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // COGS Calculation (Cost of Goods Sold from product base cost or estimated batch cost)
  const totalCOGS = useMemo(() => {
    let cost = 0;
    filteredOrders.forEach(o => {
      o.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        const unitCost = prod?.costPrice || (it.unitPrice * 0.7);
        cost += unitCost * it.qty;
      });
    });
    return Math.round(cost);
  }, [filteredOrders, products]);

  // Total Expenses
  const totalExpensesAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  // Simple P&L metrics: Revenue minus COGS minus Expenses = Net Profit
  const grossProfit = Math.round(totalRev - totalCOGS);
  const grossMargin = totalRev > 0 ? Math.round((grossProfit / totalRev) * 100) : 0;
  const netProfit = Math.round(grossProfit - totalExpensesAmount);
  const netMargin = totalRev > 0 ? Math.round((netProfit / totalRev) * 100) : 0;

  // Expenses breakdown by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const curr = map.get(e.category) || 0;
      map.set(e.category, curr + e.amount);
    });
    return Array.from(map.entries())
      .map(([cat, amt]) => ({ category: cat, amount: amt }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);

  // Cash Flow Metrics: Cash In vs Cash Out
  const cashInCollections = useMemo(() => {
    // Orders paid during period
    return filteredOrders.reduce((s, o) => s + o.amountPaid, 0);
  }, [filteredOrders]);

  const cashOutPurchases = useMemo(() => {
    // Vendor payments made during period
    const paymentsOut = filteredPayments.filter(p => p.type === 'OUT').reduce((s, p) => s + p.amount, 0);
    return paymentsOut > 0 ? paymentsOut : filteredPurchases.reduce((s, p) => s + p.grandTotal, 0);
  }, [filteredPayments, filteredPurchases]);

  const netCashFlow = cashInCollections - (cashOutPurchases + totalExpensesAmount);

  // GST Liability Calculation
  // Output GST (from sales orders)
  const outputCGST = filteredOrders.reduce((s, o) => s + o.cgstTotal, 0);
  const outputSGST = filteredOrders.reduce((s, o) => s + o.sgstTotal, 0);
  const outputIGST = filteredOrders.reduce((s, o) => s + o.igstTotal, 0);
  const totalOutputGST = filteredOrders.reduce((s, o) => s + o.taxTotal, 0);

  // Input GST (ITC from purchases)
  const totalInputGST = filteredPurchases.reduce((s, p) => s + p.taxTotal, 0);
  const estimatedInputCGST = Math.round(totalInputGST * 0.45);
  const estimatedInputSGST = Math.round(totalInputGST * 0.45);
  const estimatedInputIGST = Math.round(totalInputGST * 0.1);

  // Net GST Payable = Output GST minus Input GST
  const netGstPayable = Math.max(0, totalOutputGST - totalInputGST);
  const netItcCarryForward = Math.max(0, totalInputGST - totalOutputGST);

  // 9pm Daily Closing Summary Text
  const dailySummaryText = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = orders.filter(o => o.orderDate === todayStr && o.deliveryStatus !== 'Cancelled');
    const rev = todayOrders.reduce((s, o) => s + o.grandTotal, 0);
    const paid = todayOrders.reduce((s, o) => s + o.amountPaid, 0);
    const unpaid = rev - paid;
    const stockVal = getStockValue();
    const todayExpenses = expenses.filter(e => e.date === todayStr).reduce((s, e) => s + e.amount, 0);

    return `*${settings.businessName}*
9:00 PM Daily Business Closing Summary
Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}

*Operations & Sales:*
• Total Orders Today: ${todayOrders.length}
• Total Billed Revenue: ${formatINR(rev)}
• Collections Received: ${formatINR(paid)}
• Outstanding Due Today: ${formatINR(unpaid)}

*Cash Outflow & Overhead:*
• Operating Expenses Logged: ${formatINR(todayExpenses)}

*Inventory Snapshot:*
• Total Stock Valuation (FIFO): ${formatINR(stockVal)}
• Active Catalog Items: ${products.length}

_Auto-generated by Tyrebuddy Business OS (Offline Secure App)_`;
  }, [orders, settings, products, expenses, getStockValue]);

  const handleShareClosingWhatsApp = () => {
    openWhatsAppLink(settings.phone, dailySummaryText);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
            Financial & Business Intelligence Reports
          </h1>
          <p className="text-xs text-neutral-500 font-mono">
            P&L Statement · Cash Flow · GST Output/Input · Audited Sales & 9PM Closing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center border border-neutral-300 dark:border-neutral-700 text-xs">
            {(['daily', 'weekly', 'monthly'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 font-mono uppercase font-semibold ${
                  period === p
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {p === 'daily' ? 'Today' : p === 'weekly' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleShareClosingWhatsApp}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp Daily Summary
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="no-print flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 pt-2 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveReportTab('sales')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors ${
            activeReportTab === 'sales'
              ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          Overview & Sales
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('pnl')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors ${
            activeReportTab === 'pnl'
              ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          Simple P&L Statement
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('cashflow')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors ${
            activeReportTab === 'cashflow'
              ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          Cash Flow Summary
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('gst')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors ${
            activeReportTab === 'gst'
              ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          GST Liability Preview
        </button>
        <button
          type="button"
          onClick={() => setActiveReportTab('closing')}
          className={`px-4 py-2 border-b-2 font-bold transition-colors ${
            activeReportTab === 'closing'
              ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          9PM WhatsApp Closing
        </button>
      </div>

      {/* TAB 1: Sales & Operational Overview */}
      {activeReportTab === 'sales' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
                {period === 'daily' && "Today's Operational & Sales Summary"}
                {period === 'weekly' && 'Last 7 Days Operational & Sales Summary'}
                {period === 'monthly' && 'Last 30 Days Operational & Sales Summary'}
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                {settings.businessName} · GSTIN: {settings.gstin} · Gujarat (State 24)
              </p>
            </div>
            <div className="text-right font-mono text-xs text-neutral-500">
              <div>As of: {new Date().toLocaleString()}</div>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">Total Period Orders</span>
              <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {filteredOrders.length}
              </span>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">Gross Billed Revenue</span>
              <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatINR(totalRev)}
              </span>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">B2B Wholesale Share</span>
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                {formatINR(totalB2bRev)}{' '}
                <span className="text-xs font-normal">
                  ({totalRev > 0 ? Math.round((totalB2bRev / totalRev) * 100) : 0}%)
                </span>
              </span>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">B2C Retail Share</span>
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatINR(totalB2cRev)}{' '}
                <span className="text-xs font-normal">
                  ({totalRev > 0 ? Math.round((totalB2cRev / totalRev) * 100) : 0}%)
                </span>
              </span>
            </div>
          </div>

          {/* Top Selling Products */}
          <div>
            <h3 className="text-xs font-bold uppercase font-mono text-neutral-700 dark:text-neutral-300 mb-2">
              Top Selling Tyres, Tubes & Batteries ({period})
            </h3>
            <table className="w-full text-left text-xs border border-neutral-200 dark:border-neutral-800">
              <thead className="bg-neutral-50 dark:bg-neutral-800 font-mono text-[11px]">
                <tr>
                  <th className="p-2 border-r border-neutral-200 dark:border-neutral-700">Product</th>
                  <th className="p-2 border-r border-neutral-200 dark:border-neutral-700 text-center">Units Sold</th>
                  <th className="p-2 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-neutral-400 font-sans">
                      No sales recorded in this timeframe.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p, i) => (
                    <tr key={i}>
                      <td className="p-2 border-r border-neutral-200 dark:border-neutral-700 font-sans font-medium text-neutral-900 dark:text-neutral-100">
                        {p.name}
                      </td>
                      <td className="p-2 border-r border-neutral-200 dark:border-neutral-700 text-center font-bold tabular-nums">
                        {p.qty}
                      </td>
                      <td className="p-2 text-right font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {formatINR(p.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Simple P&L Statement */}
      {activeReportTab === 'pnl' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold uppercase font-mono text-neutral-900 dark:text-neutral-100">
                Profit & Loss Statement ({period})
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Revenue − Cost of Goods Sold (COGS) − Operating Expenses = Net Profit
              </p>
            </div>
            <div className="text-right">
              <span className={`text-base font-bold font-mono px-3 py-1 ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800'}`}>
                Net Margin: {netMargin}%
              </span>
            </div>
          </div>

          {/* P&L Key Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">1. Gross Revenue</span>
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatINR(totalRev)}
              </span>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">2. Cost of Goods (COGS)</span>
              <span className="text-xl font-bold text-red-700 dark:text-red-400 tabular-nums">
                {formatINR(totalCOGS)}
              </span>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">3. Operating Expenses</span>
              <span className="text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatINR(totalExpensesAmount)}
              </span>
            </div>

            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <span className="text-neutral-500 block uppercase">4. Net Profit</span>
              <span className={`text-xl font-bold tabular-nums ${netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700'}`}>
                {formatINR(netProfit)}
              </span>
            </div>
          </div>

          {/* Detailed P&L Breakdown Table */}
          <div className="border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-xs font-mono">
              <thead className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="p-2.5 text-left">P&L Financial Line Item</th>
                  <th className="p-2.5 text-right w-40">Amount (₹)</th>
                  <th className="p-2.5 text-right w-28">% of Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                <tr className="font-bold bg-neutral-50/50 dark:bg-neutral-900/50">
                  <td className="p-2.5">Operating Sales Revenue</td>
                  <td className="p-2.5 text-right text-emerald-700 dark:text-emerald-400">{formatINR(totalRev)}</td>
                  <td className="p-2.5 text-right">100%</td>
                </tr>
                <tr>
                  <td className="p-2.5 pl-6 text-neutral-600 dark:text-neutral-400">
                    Less: Cost of Goods Sold (Tyre procurement & batch cost)
                  </td>
                  <td className="p-2.5 text-right text-red-600 dark:text-red-400">-{formatINR(totalCOGS)}</td>
                  <td className="p-2.5 text-right">{totalRev > 0 ? Math.round((totalCOGS / totalRev) * 100) : 0}%</td>
                </tr>
                <tr className="font-bold bg-neutral-100 dark:bg-neutral-800">
                  <td className="p-2.5">Gross Profit</td>
                  <td className="p-2.5 text-right text-neutral-900 dark:text-neutral-100">{formatINR(grossProfit)}</td>
                  <td className="p-2.5 text-right">{grossMargin}%</td>
                </tr>
                {expenseByCategory.map((exp, idx) => (
                  <tr key={idx}>
                    <td className="p-2 pl-6 text-neutral-600 dark:text-neutral-400">
                      Less Operating Expense: {exp.category}
                    </td>
                    <td className="p-2 text-right text-amber-700 dark:text-amber-400">-{formatINR(exp.amount)}</td>
                    <td className="p-2 text-right">{totalRev > 0 ? ((exp.amount / totalRev) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
                <tr className="font-bold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 text-sm">
                  <td className="p-3">Net Operating Profit</td>
                  <td className="p-3 text-right">{formatINR(netProfit)}</td>
                  <td className="p-3 text-right">{netMargin}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Cash Flow Summary */}
      {activeReportTab === 'cashflow' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold uppercase font-mono text-neutral-900 dark:text-neutral-100">
                Operating Cash Flow Summary ({period})
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Cash Collections Inflow vs Vendor Payments & Expense Outflow
              </p>
            </div>
            <div className="text-right">
              <span className={`text-base font-bold font-mono px-3 py-1 ${netCashFlow >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                Net Cash Flow: {formatINR(netCashFlow)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold uppercase mb-1">
                <ArrowDownRight className="w-4 h-4" />
                <span>Cash Inflow (Collections)</span>
              </div>
              <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 tabular-nums">
                {formatINR(cashInCollections)}
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-sans">
                Realized collections from B2C orders and B2B invoice settlements.
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold uppercase mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span>Cash Outflow (Disbursements)</span>
              </div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                {formatINR(cashOutPurchases + totalExpensesAmount)}
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-sans">
                Vendor purchase payments ({formatINR(cashOutPurchases)}) + Operating expenses ({formatINR(totalExpensesAmount)}).
              </p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-bold uppercase mb-1">
                <Scale className="w-4 h-4" />
                <span>Net Cash Position</span>
              </div>
              <div className={`text-2xl font-bold tabular-nums ${netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatINR(netCashFlow)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-sans">
                Net operational cash balance retained during this timeframe.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GST Liability Preview */}
      {activeReportTab === 'gst' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold uppercase font-mono text-neutral-900 dark:text-neutral-100">
                GST Liability & ITC Preview ({period})
              </h2>
              <p className="text-xs text-neutral-500 font-mono">
                Output GST collected on Sales minus Input Tax Credit (ITC) on Purchases = Net Tax Payable to Govt
              </p>
            </div>
            <div className="text-right font-mono text-xs text-neutral-500">
              GSTIN: {settings.gstin} · Gujarat (24)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
              <span className="text-neutral-500 uppercase block font-bold">1. Output GST (Sales)</span>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatINR(totalOutputGST)}
              </div>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-400 divide-y divide-neutral-200 dark:divide-neutral-700 pt-1">
                <div className="flex justify-between py-0.5">
                  <span>Intra-state CGST (Gujarat):</span>
                  <span className="font-bold">{formatINR(outputCGST)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Intra-state SGST (Gujarat):</span>
                  <span className="font-bold">{formatINR(outputSGST)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Inter-state IGST:</span>
                  <span className="font-bold">{formatINR(outputIGST)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
              <span className="text-neutral-500 uppercase block font-bold">2. Input Tax Credit (Purchases)</span>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                {formatINR(totalInputGST)}
              </div>
              <div className="text-[11px] text-neutral-600 dark:text-neutral-400 divide-y divide-neutral-200 dark:divide-neutral-700 pt-1">
                <div className="flex justify-between py-0.5">
                  <span>Eligible Input CGST:</span>
                  <span className="font-bold">{formatINR(estimatedInputCGST)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Eligible Input SGST:</span>
                  <span className="font-bold">{formatINR(estimatedInputSGST)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span>Eligible Input IGST:</span>
                  <span className="font-bold">{formatINR(estimatedInputIGST)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950 space-y-2">
              <span className="uppercase block font-bold text-xs opacity-75">
                3. Estimated Net GST Payable
              </span>
              <div className="text-2xl font-bold tabular-nums">
                {netGstPayable > 0 ? formatINR(netGstPayable) : '₹0.00 (Nil)'}
              </div>
              {netItcCarryForward > 0 && (
                <div className="text-[11px] text-emerald-300 dark:text-emerald-700 font-sans">
                  ITC Credit Balance to carry forward: {formatINR(netItcCarryForward)}
                </div>
              )}
              <p className="text-[10px] opacity-75 font-sans leading-tight pt-1">
                Subject to GSTR-3B monthly reconciliation and vendor invoice filing on GST portal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: 9PM WhatsApp Daily Closing */}
      {activeReportTab === 'closing' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-base font-bold uppercase font-mono text-neutral-900 dark:text-neutral-100">
                  9:00 PM Daily Business Closing Summary
                </h2>
                <p className="text-xs text-neutral-500 font-mono">
                  Clean WhatsApp message format for owner / partner daily dispatch
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleShareClosingWhatsApp}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-mono"
            >
              <Share2 className="w-4 h-4" />
              Send to WhatsApp ({settings.phone})
            </button>
          </div>

          <pre className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono text-xs whitespace-pre-wrap leading-relaxed text-neutral-800 dark:text-neutral-200">
            {dailySummaryText}
          </pre>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Customer, Order, PaymentRecord } from '../../types';
import { formatINR } from '../../utils/gst';
import {
  openWhatsAppLink,
  generatePaymentReminderMessage,
} from '../../utils/whatsapp';
import { buildUpiPayUri, generateQrDataUrl } from '../../utils/barcode';
import {
  CreditCard,
  AlertCircle,
  Plus,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Calendar,
  Wallet,
  CheckCircle2,
  FileText,
  Printer,
  X,
  Share2,
  Send,
  Users,
  Clock,
} from 'lucide-react';

export const CreditLedgerView: React.FC = () => {
  const { customers, orders, payments, settings, recordPayment } = useStore();
  const [activeTab, setActiveTab] = useState<'b2b' | 'b2c' | 'cashbook'>('b2b');
  const [searchTerm, setSearchTerm] = useState('');

  // Payment Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payOrderId, setPayOrderId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState<'UPI' | 'Bank' | 'Cash' | 'COD'>('UPI');
  const [payType, setPayType] = useState<'IN' | 'OUT'>('IN');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  // Customer Statement Modal
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementUpiQr, setStatementUpiQr] = useState<string>('');

  // Bulk Payment Reminder Modal
  const [isBulkReminderOpen, setIsBulkReminderOpen] = useState(false);

  // Calculate B2B aging and balance per customer
  const b2bLedger = useMemo(() => {
    const now = Date.now();

    return customers
      .filter(c => c.type === 'B2B')
      .map(cust => {
        const custOrders = orders.filter(o => o.customerId === cust.id && o.deliveryStatus !== 'Cancelled');
        const custPayments = payments.filter(p => p.customerId === cust.id && p.type === 'IN');

        const totalBilled = custOrders.reduce((s, o) => s + o.grandTotal, 0);
        const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);
        const outstanding = totalBilled - totalPaid;

        // Aging breakdown for unpaid/partial orders
        let bucket0_30 = 0;
        let bucket31_60 = 0;
        let bucket61_90 = 0;
        let bucket90Plus = 0;

        custOrders.forEach(o => {
          const unpaidOnOrder = o.grandTotal - o.amountPaid;
          if (unpaidOnOrder > 0) {
            const orderTimestamp = new Date(o.orderDate).getTime();
            const daysPast = Math.floor((now - orderTimestamp) / (1000 * 60 * 60 * 24));

            if (daysPast <= 30) bucket0_30 += unpaidOnOrder;
            else if (daysPast <= 60) bucket31_60 += unpaidOnOrder;
            else if (daysPast <= 90) bucket61_90 += unpaidOnOrder;
            else bucket90Plus += unpaidOnOrder;
          }
        });

        const isOverCreditLimit =
          cust.creditLimit && outstanding > cust.creditLimit;

        return {
          customer: cust,
          totalBilled,
          totalPaid,
          outstanding,
          bucket0_30,
          bucket31_60,
          bucket61_90,
          bucket90Plus,
          isOverCreditLimit,
          orders: custOrders,
          payments: custPayments,
        };
      })
      .filter(entry =>
        entry.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.customer.phone.includes(searchTerm)
      );
  }, [customers, orders, payments, searchTerm]);

  // B2C Same-Day Due List
  const b2cDueList = useMemo(() => {
    return orders
      .filter(o => o.customerType === 'B2C' && o.paymentStatus !== 'Paid' && o.deliveryStatus !== 'Cancelled')
      .map(o => {
        const balance = o.grandTotal - o.amountPaid;
        const isOverdue = new Date(o.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
        return {
          order: o,
          balance,
          isOverdue,
        };
      })
      .filter(entry =>
        entry.order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.order.customerPhone.includes(searchTerm) ||
        entry.order.orderNo.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [orders, searchTerm]);

  // Overdue customers for bulk reminders
  const overdueCustomers = useMemo(() => {
    return b2bLedger.filter(b => b.outstanding > 0);
  }, [b2bLedger]);

  // Open statement for customer
  const handleOpenStatement = async (cust: Customer) => {
    setStatementCustomer(cust);
    const entry = b2bLedger.find(b => b.customer.id === cust.id);
    const outstanding = entry?.outstanding || 0;

    const upiUri = buildUpiPayUri(
      settings.upiId,
      settings.businessName,
      outstanding > 0 ? outstanding : 1,
      `Statement Balance ${cust.name}`
    );
    const qrUrl = await generateQrDataUrl(upiUri, 140);
    setStatementUpiQr(qrUrl);
  };

  const handleOpenPaymentModal = (customerId?: string, orderId?: string, defaultAmount?: number) => {
    setPayCustomerId(customerId || (customers[0]?.id || ''));
    setPayOrderId(orderId || '');
    setPayAmount(defaultAmount || 0);
    setPayMode('UPI');
    setPayType('IN');
    setPayRef('');
    setPayNote('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) return;

    const cust = customers.find(c => c.id === payCustomerId);

    recordPayment({
      customerId: payCustomerId,
      customerName: cust?.name,
      orderId: payOrderId || undefined,
      amount: payAmount,
      mode: payMode,
      type: payType,
      referenceNumber: payRef || undefined,
      note: payNote || undefined,
      date: new Date().toISOString().split('T')[0],
    });

    setIsPaymentModalOpen(false);
  };

  // WhatsApp Single Reminder
  const handleSendReminder = (order: Order) => {
    const msg = generatePaymentReminderMessage(order, settings);
    openWhatsAppLink(order.customerPhone, msg);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-500" />
            Credit Ledger, Aging & Cash Book
          </h1>
          <p className="text-xs text-neutral-500">
            B2B 30–90+ day aging buckets, customer statements, credit limits, and WhatsApp reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {overdueCustomers.length > 0 && (
            <button
              onClick={() => setIsBulkReminderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100"
            >
              <Send className="w-3.5 h-3.5" />
              Bulk Reminder ({overdueCustomers.length} Overdue)
            </button>
          )}

          <button
            onClick={() => handleOpenPaymentModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('b2b')}
          className={`px-4 py-2 border-b-2 flex items-center gap-2 ${
            activeTab === 'b2b'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <span>B2B Credit Ledger & Aging ({b2bLedger.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('b2c')}
          className={`px-4 py-2 border-b-2 flex items-center gap-2 ${
            activeTab === 'b2c'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <span>B2C Due Today / Unpaid ({b2cDueList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cashbook')}
          className={`px-4 py-2 border-b-2 flex items-center gap-2 ${
            activeTab === 'cashbook'
              ? 'border-black dark:border-white font-bold'
              : 'border-transparent text-neutral-500 hover:text-black dark:hover:text-white'
          }`}
        >
          <span>Cash & Bank Book ({payments.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone, order no..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black focus:outline-none"
          />
        </div>
      </div>

      {/* TAB 1: B2B CREDIT LEDGER & AGING */}
      {activeTab === 'b2b' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                <th className="p-3">Customer / Firm</th>
                <th className="p-3 text-right">Total Billed</th>
                <th className="p-3 text-right">Total Paid</th>
                <th className="p-3 text-right">Outstanding (₹)</th>
                <th className="p-3 text-right text-emerald-700 dark:text-emerald-400">0–30 Days</th>
                <th className="p-3 text-right text-blue-700 dark:text-blue-400">31–60 Days</th>
                <th className="p-3 text-right text-amber-700 dark:text-amber-400">61–90 Days</th>
                <th className="p-3 text-right text-red-700 dark:text-red-400">90+ Days</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {b2bLedger.map(entry => (
                <tr
                  key={entry.customer.id}
                  className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
                    entry.isOverCreditLimit ? 'bg-red-50/40 dark:bg-red-950/20' : ''
                  }`}
                >
                  <td className="p-3">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                      {entry.customer.name}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {entry.customer.phone} · {entry.customer.creditDays}d terms
                    </span>
                    {entry.isOverCreditLimit && (
                      <span className="text-[10px] text-red-600 font-mono font-bold block mt-0.5">
                        ⚠ Exceeds Approved Limit ({formatINR(entry.customer.creditLimit || 0)})
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-right font-mono text-neutral-600">
                    {formatINR(entry.totalBilled)}
                  </td>

                  <td className="p-3 text-right font-mono text-neutral-600">
                    {formatINR(entry.totalPaid)}
                  </td>

                  {/* Outstanding */}
                  <td className="p-3 text-right font-mono font-bold text-sm">
                    <span className={entry.outstanding > 0 ? 'text-red-600' : 'text-green-600'}>
                      {formatINR(entry.outstanding)}
                    </span>
                  </td>

                  {/* 0-30 Days */}
                  <td className="p-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {entry.bucket0_30 > 0 ? formatINR(entry.bucket0_30) : '—'}
                  </td>

                  {/* 31-60 Days */}
                  <td className="p-3 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                    {entry.bucket31_60 > 0 ? formatINR(entry.bucket31_60) : '—'}
                  </td>

                  {/* 61-90 Days */}
                  <td className="p-3 text-right font-mono font-bold text-amber-600">
                    {entry.bucket61_90 > 0 ? formatINR(entry.bucket61_90) : '—'}
                  </td>

                  {/* 90+ Days */}
                  <td className="p-3 text-right font-mono font-bold text-red-600">
                    {entry.bucket90Plus > 0 ? formatINR(entry.bucket90Plus) : '—'}
                  </td>

                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenStatement(entry.customer)}
                        className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                        title="View Customer Statement"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      {entry.outstanding > 0 && (
                        <button
                          onClick={() => {
                            const lastOrder = entry.orders.find(o => o.grandTotal > o.amountPaid);
                            if (lastOrder) handleSendReminder(lastOrder);
                          }}
                          className="p-1 text-neutral-500 hover:text-green-600"
                          title="Send WhatsApp Payment Reminder"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenPaymentModal(entry.customer.id, undefined, entry.outstanding)}
                        className="px-2 py-0.5 border text-[11px] font-semibold bg-white dark:bg-black hover:bg-neutral-100"
                      >
                        + Pay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: B2C SAME-DAY DUE LIST */}
      {activeTab === 'b2c' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">Order No</th>
                <th className="p-3">Customer</th>
                <th className="p-3 text-right">Order Total</th>
                <th className="p-3 text-right">Amount Paid</th>
                <th className="p-3 text-right">Balance Due (₹)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {b2cDueList.map(({ order, balance, isOverdue }) => (
                <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 font-mono font-bold">{order.orderNo}</td>
                  <td className="p-3">
                    <span className="font-semibold block">{order.customerName}</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{order.customerPhone}</span>
                  </td>
                  <td className="p-3 text-right font-mono">{formatINR(order.grandTotal)}</td>
                  <td className="p-3 text-right font-mono text-green-600">{formatINR(order.amountPaid)}</td>
                  <td className="p-3 text-right font-mono font-bold text-red-600 text-sm">
                    {formatINR(balance)}
                  </td>
                  <td className="p-3 text-center font-mono">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isOverdue
                          ? 'bg-red-100 text-red-800 dark:bg-red-950'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950'
                      }`}
                    >
                      {isOverdue ? 'Overdue Today' : 'Due Today'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleSendReminder(order)}
                        className="p-1 text-neutral-500 hover:text-green-600"
                        title="Send WhatsApp Reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenPaymentModal(order.customerId, order.id, balance)}
                        className="px-2 py-0.5 border text-[11px] font-semibold bg-white dark:bg-black"
                      >
                        + Pay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {b2cDueList.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-400 italic font-mono">
                    All B2C orders are fully settled! Zero outstanding balances.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: CASH & BANK BOOK */}
      {activeTab === 'cashbook' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-3">Date</th>
                <th className="p-3">Customer / Party</th>
                <th className="p-3">Payment Mode</th>
                <th className="p-3">Ref / Transaction #</th>
                <th className="p-3 text-right">Inward (+)</th>
                <th className="p-3 text-right">Outward (-)</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
              {payments.map(pay => (
                <tr key={pay.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3 font-mono text-neutral-500">{pay.date}</td>
                  <td className="p-3 font-semibold">{pay.customerName || 'General Cash'}</td>
                  <td className="p-3 font-mono">
                    <span className="px-1.5 py-0.5 border bg-neutral-100 dark:bg-neutral-800 text-[10px]">
                      {pay.mode}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-neutral-500">{pay.referenceNumber || '—'}</td>
                  <td className="p-3 text-right font-mono font-bold text-green-600">
                    {pay.type === 'IN' ? `+${formatINR(pay.amount)}` : '—'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-red-600">
                    {pay.type === 'OUT' ? `-${formatINR(pay.amount)}` : '—'}
                  </td>
                  <td className="p-3 text-neutral-500 text-xs">{pay.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Statement Modal (Printable + WhatsApp) */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-neutral-500">Account Statement</span>
                <h2 className="font-bold text-base">{statementCustomer.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1 border text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Statement
                </button>
                <button onClick={() => setStatementCustomer(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Statement Header */}
            <div className="grid grid-cols-2 text-xs font-mono border p-3 bg-neutral-50 dark:bg-neutral-800/40">
              <div>
                <div><strong>Business:</strong> {settings.businessName}</div>
                <div><strong>GSTIN:</strong> {settings.gstin}</div>
                <div><strong>Phone:</strong> {settings.phone}</div>
              </div>
              <div className="text-right">
                <div><strong>Customer GSTIN:</strong> {statementCustomer.gstin || 'Unregistered'}</div>
                <div><strong>Customer Phone:</strong> {statementCustomer.phone}</div>
                <div><strong>Statement Date:</strong> {new Date().toLocaleDateString('en-IN')}</div>
              </div>
            </div>

            {/* Invoices & Payments Table */}
            <div className="border overflow-x-auto text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-neutral-100 dark:bg-neutral-800 border-b">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Particulars</th>
                    <th className="p-2 text-right">Debit / Billed (₹)</th>
                    <th className="p-2 text-right">Credit / Paid (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(o => o.customerId === statementCustomer.id)
                    .map(o => (
                      <tr key={o.id} className="border-t">
                        <td className="p-2">{o.orderDate}</td>
                        <td className="p-2">Invoice {o.invoiceNo || o.orderNo}</td>
                        <td className="p-2 text-right font-bold">{formatINR(o.grandTotal)}</td>
                        <td className="p-2 text-right text-neutral-400">—</td>
                      </tr>
                    ))}
                  {payments
                    .filter(p => p.customerId === statementCustomer.id)
                    .map(p => (
                      <tr key={p.id} className="border-t bg-green-50/20">
                        <td className="p-2">{p.date}</td>
                        <td className="p-2">Payment Received ({p.mode})</td>
                        <td className="p-2 text-right text-neutral-400">—</td>
                        <td className="p-2 text-right font-bold text-green-600">{formatINR(p.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Balance & UPI QR Footer */}
            {(() => {
              const entry = b2bLedger.find(b => b.customer.id === statementCustomer.id);
              const balance = entry?.outstanding || 0;

              return (
                <div className="flex items-center justify-between border-t pt-3">
                  <div>
                    <span className="text-xs text-neutral-500 font-mono block">CURRENT OUTSTANDING BALANCE:</span>
                    <span className="text-xl font-bold font-mono text-red-600">{formatINR(balance)}</span>
                    <span className="text-[11px] text-neutral-500 font-mono block mt-0.5">
                      Bank: {settings.bankName} · A/C: {settings.accountNumber} · IFSC: {settings.ifscCode}
                    </span>
                  </div>

                  {statementUpiQr && (
                    <div className="text-center">
                      <img src={statementUpiQr} alt="UPI QR" className="w-20 h-20 border p-1 mx-auto" />
                      <span className="text-[9px] font-mono text-neutral-500">Scan to Pay via UPI</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => {
                  const entry = b2bLedger.find(b => b.customer.id === statementCustomer.id);
                  const balance = entry?.outstanding || 0;
                  const text = `Namaste ${statementCustomer.name}, your current outstanding statement with Tyrebuddy is ₹${balance}. Kindly settle via UPI ${settings.upiId} or Bank A/C ${settings.accountNumber} (${settings.ifscCode}).`;
                  openWhatsAppLink(statementCustomer.phone, text);
                }}
                className="px-4 py-2 bg-green-600 text-white font-bold text-xs hover:bg-green-700 flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Share Statement via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Payment Reminders Modal */}
      {isBulkReminderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2 text-amber-600">
                <Send className="w-4 h-4" />
                Bulk WhatsApp Payment Reminders ({overdueCustomers.length} Overdue)
              </h2>
              <button onClick={() => setIsBulkReminderOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              One-click access to dispatch personalised payment reminders with bank & UPI payment links to each overdue client.
            </p>

            <div className="space-y-2 text-xs font-mono">
              {overdueCustomers.map(entry => (
                <div
                  key={entry.customer.id}
                  className="p-3 border flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/40"
                >
                  <div>
                    <span className="font-bold block font-sans">{entry.customer.name}</span>
                    <span className="text-[11px] text-neutral-500">{entry.customer.phone} · Outstanding: {formatINR(entry.outstanding)}</span>
                  </div>
                  <button
                    onClick={() => {
                      const text = `Dear ${entry.customer.name}, friendly reminder regarding outstanding balance of ₹${entry.outstanding} with Tyrebuddy. Settle via UPI: ${settings.upiId} or A/C ${settings.accountNumber} IFSC ${settings.ifscCode}. Thank you!`;
                      openWhatsAppLink(entry.customer.phone, text);
                    }}
                    className="px-3 py-1 bg-green-600 text-white font-bold text-xs flex items-center gap-1 hover:bg-green-700"
                  >
                    <Send className="w-3 h-3" />
                    Send
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setIsBulkReminderOpen(false)} className="px-3 py-1.5 border text-xs">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Record Cash / Bank / UPI Transaction
              </h2>
              <button onClick={() => setIsPaymentModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Customer / Party *</label>
                <select
                  value={payCustomerId}
                  onChange={e => setPayCustomerId(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type} · {c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(parseFloat(e.target.value || '0'))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={e => setPayMode(e.target.value as any)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="UPI">UPI (QR / Google Pay)</option>
                    <option value="Bank">Bank (RTGS / NEFT / IMPS)</option>
                    <option value="Cash">Cash in Hand</option>
                    <option value="COD">COD Cash Remittance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Transaction / Bank Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. UTR / NEFT / Cheque no"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Note / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Part payment against March deliveries"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
                >
                  Save Payment Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Expense, ExpenseCategory } from '../../types';
import { formatINR } from '../../utils/gst';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  Image as ImageIcon,
  Trash2,
  TrendingDown,
  Repeat,
  DollarSign,
  Download,
  X,
  Eye,
} from 'lucide-react';
import { exportToCsv } from '../../utils/export';

const CATEGORIES: ExpenseCategory[] = [
  'Packaging',
  'Courier',
  'Ads & Marketing',
  'Salary',
  'Rent',
  'Electricity & Utility',
  'Stationery',
  'Travel',
  'Misc',
];

export const ExpensesView: React.FC = () => {
  const { expenses, createExpense, deleteExpense } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  // New Expense form state
  const [category, setCategory] = useState<ExpenseCategory>('Packaging');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'UPI'>('UPI');
  const [note, setNote] = useState<string>('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'Monthly' | 'Weekly'>('Monthly');

  // Month list for filter
  const months = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => {
      if (e.date) {
        set.add(e.date.substring(0, 7)); // 'YYYY-MM'
      }
    });
    return Array.from(set).sort().reverse();
  }, [expenses]);

  // Current month string 'YYYY-MM'
  const currentMonthStr = new Date().toISOString().substring(0, 7);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch =
        e.expenseNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.note && e.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = selectedCategory === 'All' || e.category === selectedCategory;
      const matchMonth = selectedMonth === 'All' || e.date.startsWith(selectedMonth);

      return matchSearch && matchCategory && matchMonth;
    });
  }, [expenses, searchTerm, selectedCategory, selectedMonth]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalAll = 0;
    let totalThisMonth = 0;
    let totalToday = 0;

    expenses.forEach(e => {
      totalAll += e.amount;
      if (e.date?.startsWith(currentMonthStr)) {
        totalThisMonth += e.amount;
      }
      if (e.date === todayStr) {
        totalToday += e.amount;
      }
    });

    // Group by category for current month
    const categoryTotals: Record<string, number> = {};
    expenses
      .filter(e => selectedMonth === 'All' ? e.date?.startsWith(currentMonthStr) : e.date?.startsWith(selectedMonth))
      .forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      });

    return { totalAll, totalThisMonth, totalToday, categoryTotals };
  }, [expenses, currentMonthStr, selectedMonth]);

  // Handle receipt image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        setReceiptImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    createExpense({
      date,
      category,
      amount: parsedAmount,
      paymentMode,
      note: note.trim() || undefined,
      receiptImageUrl: receiptImage || undefined,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
    });

    // Reset form
    setAmount('');
    setNote('');
    setReceiptImage('');
    setIsRecurring(false);
    setShowAddModal(false);
  };

  const handleExportCsv = () => {
    exportToCsv(
      'tyrebuddy-expenses',
      filteredExpenses.map(e => ({
        Expense_No: e.expenseNo,
        Date: e.date,
        Category: e.category,
        Amount: e.amount,
        Payment_Mode: e.paymentMode,
        Note: e.note || '',
        Is_Recurring: e.isRecurring ? 'Yes' : 'No',
        Has_Receipt: e.receiptImageUrl ? 'Yes' : 'No',
      }))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            Expense Tracking & Receipts
          </h1>
          <p className="text-xs text-neutral-500">
            Log shop overheads, freight, packaging, rent, and wages with receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] font-mono font-bold uppercase text-neutral-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Today's Outflow
          </span>
          <div className="text-2xl font-bold font-mono mt-1 text-red-600 dark:text-red-400">
            {formatINR(metrics.totalToday)}
          </div>
          <span className="text-[11px] text-neutral-500">Cash, UPI & Bank today</span>
        </div>

        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] font-mono font-bold uppercase text-neutral-500 flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
            This Month Total
          </span>
          <div className="text-2xl font-bold font-mono mt-1">
            {formatINR(metrics.totalThisMonth)}
          </div>
          <span className="text-[11px] text-neutral-500">Month to date overheads</span>
        </div>

        <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
          <span className="text-[11px] font-mono font-bold uppercase text-neutral-500 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            All-Time Logged
          </span>
          <div className="text-2xl font-bold font-mono mt-1 text-neutral-700 dark:text-neutral-300">
            {formatINR(metrics.totalAll)}
          </div>
          <span className="text-[11px] text-neutral-500">{expenses.length} expense entries</span>
        </div>
      </div>

      {/* Category Breakdown Bar / Tags */}
      <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
        <span className="text-xs font-mono font-bold uppercase text-neutral-500 block">
          Category Outflow ({selectedMonth === 'All' ? 'Current Month' : selectedMonth}):
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(metrics.categoryTotals).map(([cat, amt]) => (
            <div
              key={cat}
              className="px-2.5 py-1 text-xs border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/60"
            >
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{cat}</span>
              <span className="font-mono font-bold text-black dark:text-white">{formatINR(amt)}</span>
            </div>
          ))}
          {Object.keys(metrics.categoryTotals).length === 0 && (
            <span className="text-xs text-neutral-400 italic">No expenses logged in this period.</span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search expenses, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
            >
              <option value="All">All Months</option>
              {months.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="text-xs font-mono text-neutral-500">
          Showing {filteredExpenses.length} of {expenses.length}
        </span>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
              <th className="p-3">Expense #</th>
              <th className="p-3">Date</th>
              <th className="p-3">Category</th>
              <th className="p-3">Description / Note</th>
              <th className="p-3">Mode</th>
              <th className="p-3 text-right">Amount (₹)</th>
              <th className="p-3 text-center">Receipt</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
            {filteredExpenses.map(exp => (
              <tr key={exp.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                <td className="p-3 font-mono font-bold">{exp.expenseNo}</td>
                <td className="p-3 font-mono text-neutral-500 whitespace-nowrap">{exp.date}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                    {exp.category}
                  </span>
                  {exp.isRecurring && (
                    <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-400 font-mono inline-flex items-center gap-0.5">
                      <Repeat className="w-2.5 h-2.5" />
                      {exp.recurringFrequency}
                    </span>
                  )}
                </td>
                <td className="p-3 text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                  {exp.note || '—'}
                </td>
                <td className="p-3 font-mono text-xs font-semibold">{exp.paymentMode}</td>
                <td className="p-3 text-right font-mono font-bold text-sm text-red-600 dark:text-red-400">
                  {formatINR(exp.amount)}
                </td>
                <td className="p-3 text-center">
                  {exp.receiptImageUrl ? (
                    <button
                      onClick={() => setViewReceiptUrl(exp.receiptImageUrl || null)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  ) : (
                    <span className="text-neutral-400 text-xs">—</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="p-1 text-neutral-400 hover:text-red-600"
                    title="Delete Expense"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-neutral-400 italic">
                  No expenses match your search or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 border-neutral-200 dark:border-neutral-800">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-500" />
                Record New Expense
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 2400"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as 'Cash' | 'Bank' | 'UPI')}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="Bank">Bank Transfer / NEFT / RTGS</option>
                    <option value="Cash">Cash in Hand</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Description / Note</label>
                <textarea
                  placeholder="e.g. 50 rolls packaging tape and bubble sheets"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                />
              </div>

              {/* Receipt Image Upload */}
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Attach Receipt Photo</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 border border-dashed border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-semibold">
                    <ImageIcon className="w-4 h-4 text-neutral-500" />
                    <span>Upload Receipt (PNG/JPG)</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {receiptImage && (
                    <div className="relative group">
                      <img
                        src={receiptImage}
                        alt="Receipt preview"
                        className="w-12 h-12 object-cover border border-neutral-300 dark:border-neutral-700"
                      />
                      <button
                        type="button"
                        onClick={() => setReceiptImage('')}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 text-[9px]"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recurring Setting */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={e => setIsRecurring(e.target.checked)}
                    className="accent-black"
                  />
                  <span>Mark as Recurring Expense (e.g. Rent, Wages)</span>
                </label>
                {isRecurring && (
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-neutral-500">Frequency:</span>
                    <select
                      value={recurringFrequency}
                      onChange={e => setRecurringFrequency(e.target.value as 'Monthly' | 'Weekly')}
                      className="p-1 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Receipt Photo Modal */}
      {viewReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 max-w-lg w-full p-4 border border-neutral-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase">Receipt Document:</span>
              <button
                onClick={() => setViewReceiptUrl(null)}
                className="p-1 text-neutral-400 hover:text-black dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex justify-center bg-neutral-100 dark:bg-neutral-950 p-2">
              <img src={viewReceiptUrl} alt="Receipt preview" className="max-w-full h-auto object-contain" />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setViewReceiptUrl(null)}
                className="px-4 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

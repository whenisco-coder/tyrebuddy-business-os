import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Customer, CustomerType, Address, CustomerSegment } from '../../types';
import { formatINR } from '../../utils/gst';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit,
  Trash2,
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  GitMerge,
  Crown,
  Repeat,
  ShoppingBag,
  TrendingUp,
  Clock,
  ExternalLink,
  Database,
} from 'lucide-react';

interface CustomersViewProps {
  onNavigate?: (module: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ onNavigate }) => {
  const {
    customers,
    orders,
    settings,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    mergeDuplicateCustomers,
    checkPincodeServiceability,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CustomerType>('ALL');
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | CustomerSegment>('ALL');

  // Customer Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);

  // Merge Modal
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [primaryMergeId, setPrimaryMergeId] = useState<string>('');
  const [duplicateMergeId, setDuplicateMergeId] = useState<string>('');

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<CustomerType>('B2C');
  const [gstin, setGstin] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [creditDays, setCreditDays] = useState<number>(30);
  const [creditLimit, setCreditLimit] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: 'addr-new-1',
      label: 'Home',
      addressLine: '',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      isDefault: true,
    },
  ]);

  // Selected Customer Detail Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Helper to compute Customer Stats & Segment
  const customerStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalSpent: number;
        orderCount: number;
        aov: number;
        outstanding: number;
        lastOrderDate?: string;
        segment: CustomerSegment;
      }
    >();

    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    customers.forEach(c => {
      const custOrders = orders.filter(o => o.customerId === c.id && o.deliveryStatus !== 'Cancelled');
      const totalSpent = custOrders.reduce((sum, o) => sum + o.grandTotal, 0);
      const totalPaid = custOrders.reduce((sum, o) => sum + o.amountPaid, 0);
      const outstanding = Math.max(0, totalSpent - totalPaid);
      const orderCount = custOrders.length;
      const aov = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0;

      let lastOrderDate: string | undefined;
      if (custOrders.length > 0) {
        lastOrderDate = custOrders.map(o => o.orderDate).sort().reverse()[0];
      }

      // Compute Segment
      let segment: CustomerSegment = 'One-Time';
      if (totalSpent >= 50000 || orderCount >= 5) {
        segment = 'VIP';
      } else if (orderCount >= 2) {
        if (lastOrderDate && new Date(lastOrderDate) < sixtyDaysAgo) {
          segment = 'Lapsed';
        } else {
          segment = 'Repeat';
        }
      } else if (orderCount === 1) {
        if (lastOrderDate && new Date(lastOrderDate) < sixtyDaysAgo) {
          segment = 'Lapsed';
        } else {
          segment = 'One-Time';
        }
      } else {
        segment = 'One-Time';
      }

      map.set(c.id, { totalSpent, orderCount, aov, outstanding, lastOrderDate, segment });
    });

    return map;
  }, [customers, orders]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;

      const stats = customerStatsMap.get(c.id);
      if (segmentFilter !== 'ALL' && stats?.segment !== segmentFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.gstin && c.gstin.toLowerCase().includes(term))
      );
    });
  }, [customers, typeFilter, segmentFilter, searchTerm, customerStatsMap]);

  const handleOpenNew = () => {
    setEditingCustId(null);
    setName('');
    setPhone('');
    setEmail('');
    setType('B2C');
    setGstin('');
    setDiscountPercent(0);
    setCreditDays(0);
    setCreditLimit('');
    setNotes('');
    setAddresses([
      {
        id: 'addr-new-1',
        label: 'Home',
        addressLine: '',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        isDefault: true,
      },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setType(c.type);
    setGstin(c.gstin || '');
    setDiscountPercent(c.discountPercent);
    setCreditDays(c.creditDays);
    setCreditLimit(c.creditLimit ? c.creditLimit.toString() : '');
    setNotes(c.notes || '');
    setAddresses(
      c.addresses && c.addresses.length > 0
        ? c.addresses
        : [
            {
              id: 'addr-1',
              label: 'Home',
              addressLine: '',
              city: 'Surat',
              state: 'Gujarat',
              pincode: '395002',
              isDefault: true,
            },
          ]
    );
    setIsModalOpen(true);
  };

  const handleAddAddress = () => {
    setAddresses([
      ...addresses,
      {
        id: 'addr-' + Date.now(),
        label: 'Godown',
        addressLine: '',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395002',
        isDefault: false,
      },
    ]);
  };

  const handleRemoveAddress = (idx: number) => {
    if (addresses.length <= 1) return;
    setAddresses(addresses.filter((_, i) => i !== idx));
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const parsedLimit = creditLimit ? parseFloat(creditLimit) : undefined;

    if (editingCustId) {
      updateCustomer(editingCustId, {
        name,
        phone,
        email: email || undefined,
        type,
        gstin: gstin || undefined,
        discountPercent,
        creditDays,
        creditLimit: parsedLimit,
        notes: notes || undefined,
        addresses,
      });
    } else {
      addCustomer({
        name,
        phone,
        email: email || undefined,
        type,
        gstin: gstin || undefined,
        discountPercent,
        creditDays: type === 'B2B' ? (creditDays || 30) : 0,
        creditLimit: parsedLimit,
        notes: notes || undefined,
        addresses,
      });
    }

    setIsModalOpen(false);
  };

  const handleExecuteMerge = () => {
    if (!primaryMergeId || !duplicateMergeId || primaryMergeId === duplicateMergeId) return;
    mergeDuplicateCustomers(primaryMergeId, duplicateMergeId);
    setIsMergeModalOpen(false);
    setPrimaryMergeId('');
    setDuplicateMergeId('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Customer 360 & Directory
          </h1>
          <p className="text-xs text-neutral-500">
            Segments (VIP, Repeat, Lapsed), lifetime value (LTV), multiple addresses, and merge duplicates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('tally')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              Import Tally Debtors
            </button>
          )}

          <button
            onClick={() => {
              setPrimaryMergeId(customers[0]?.id || '');
              setDuplicateMergeId(customers[1]?.id || '');
              setIsMergeModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <GitMerge className="w-3.5 h-3.5 text-blue-600" />
            Merge Duplicates
          </button>

          <button
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, phone, GSTIN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
          >
            <option value="ALL">All Types (B2B & B2C)</option>
            <option value="B2B">B2B Wholesale</option>
            <option value="B2C">B2C Retail</option>
          </select>

          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value as any)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
          >
            <option value="ALL">All Segments</option>
            <option value="VIP">👑 VIP Clients</option>
            <option value="Repeat">🔁 Repeat Buyers</option>
            <option value="One-Time">👤 One-Time</option>
            <option value="Lapsed">⏳ Lapsed (60+ Days Inactive)</option>
          </select>
        </div>

        <span className="text-xs font-mono text-neutral-500">
          Showing {filteredCustomers.length} of {customers.length} customers
        </span>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
              <th className="p-3">Customer / Entity</th>
              <th className="p-3">Segment</th>
              <th className="p-3">Type</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Addresses</th>
              <th className="p-3 text-right">Orders</th>
              <th className="p-3 text-right">Total Spent (LTV)</th>
              <th className="p-3 text-right">Outstanding (₹)</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
            {filteredCustomers.map(cust => {
              const stats = customerStatsMap.get(cust.id) || {
                totalSpent: 0,
                orderCount: 0,
                aov: 0,
                outstanding: 0,
                segment: 'One-Time' as CustomerSegment,
              };

              const isOverCreditLimit =
                cust.creditLimit && stats.outstanding > cust.creditLimit;

              return (
                <tr key={cust.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="p-3">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <span>{cust.name}</span>
                      {stats.segment === 'VIP' && (
                        <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    {cust.gstin && (
                      <span className="text-[11px] text-neutral-500 font-mono block">
                        GSTIN: {cust.gstin}
                      </span>
                    )}
                    {cust.notes && (
                      <span className="text-[10px] text-neutral-400 italic block truncate max-w-xs mt-0.5">
                        "{cust.notes}"
                      </span>
                    )}
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        stats.segment === 'VIP'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : stats.segment === 'Repeat'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : stats.segment === 'Lapsed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800'
                      }`}
                    >
                      {stats.segment}
                    </span>
                  </td>

                  <td className="p-3 font-mono text-xs">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] border ${
                        cust.type === 'B2B'
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                      }`}
                    >
                      {cust.type}
                    </span>
                    {cust.type === 'B2B' && cust.discountPercent > 0 && (
                      <span className="block text-[10px] text-neutral-500 mt-0.5">
                        {cust.discountPercent}% auto-disc
                      </span>
                    )}
                  </td>

                  <td className="p-3 font-mono text-xs">
                    <div>{cust.phone}</div>
                    {cust.email && <div className="text-[11px] text-neutral-500">{cust.email}</div>}
                  </td>

                  {/* Multiple Addresses Preview */}
                  <td className="p-3 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {cust.addresses.map(a => {
                        const serviceCheck = checkPincodeServiceability(a.pincode);
                        return (
                          <span
                            key={a.id}
                            className={`px-1.5 py-0.5 text-[10px] border flex items-center gap-1 ${
                              serviceCheck.serviceable
                                ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                            }`}
                            title={`${a.addressLine}, ${a.city} ${a.pincode} (${serviceCheck.serviceable ? 'Serviceable' : 'Out of Area'})`}
                          >
                            <span>{a.label}</span>
                            <span className="font-mono text-[9px]">({a.pincode})</span>
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  <td className="p-3 text-right font-mono font-bold">{stats.orderCount}</td>

                  {/* LTV & AOV */}
                  <td className="p-3 text-right font-mono font-bold">
                    <div>{formatINR(stats.totalSpent)}</div>
                    <div className="text-[10px] text-neutral-400 font-normal">
                      AOV: {formatINR(stats.aov)}
                    </div>
                  </td>

                  {/* Outstanding */}
                  <td className="p-3 text-right font-mono">
                    <span
                      className={`font-bold ${
                        stats.outstanding > 0 ? 'text-red-600' : 'text-neutral-500'
                      }`}
                    >
                      {formatINR(stats.outstanding)}
                    </span>
                    {isOverCreditLimit && (
                      <span className="block text-[9px] text-red-600 font-bold uppercase mt-0.5">
                        ⚠ Exceeds Limit ({formatINR(cust.creditLimit || 0)})
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setSelectedCustomer(cust)}
                        className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                        title="Customer 360 View"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(cust)}
                        className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                        title="Edit Customer Profile"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => deleteCustomer(cust.id)}
                        className="p-1 text-neutral-400 hover:text-red-600"
                        title="Delete Customer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Customer Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                {editingCustId ? 'Edit Customer Profile' : 'New Customer'}
              </h2>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Name / Entity *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Auto Works"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Unique Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="10-digit number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Customer Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as CustomerType)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="B2C">B2C Retail Customer</option>
                    <option value="B2B">B2B Wholesale / Fleet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="orders@customer.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">GSTIN</label>
                  <input
                    type="text"
                    placeholder="15-character GSTIN"
                    value={gstin}
                    onChange={e => setGstin(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono uppercase"
                  />
                </div>

                {type === 'B2B' && (
                  <>
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Auto-Discount (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={discountPercent}
                        onChange={e => setDiscountPercent(parseFloat(e.target.value || '0'))}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Approved Credit Limit (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 150000"
                        value={creditLimit}
                        onChange={e => setCreditLimit(e.target.value)}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1 font-semibold">Credit Days</label>
                      <input
                        type="number"
                        value={creditDays}
                        onChange={e => setCreditDays(parseInt(e.target.value || '30', 10))}
                        className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Private Notes</label>
                <textarea
                  placeholder="e.g. Prefers WhatsApp invoices, ships to depot only"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                />
              </div>

              {/* Multiple Addresses Management */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wide">Saved Delivery Addresses</span>
                  <button
                    type="button"
                    onClick={handleAddAddress}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    + Add Another Address
                  </button>
                </div>

                {addresses.map((addr, idx) => {
                  const check = checkPincodeServiceability(addr.pincode);
                  return (
                    <div
                      key={addr.id}
                      className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <select
                            value={addr.label}
                            onChange={e => {
                              const updated = [...addresses];
                              updated[idx].label = e.target.value;
                              setAddresses(updated);
                            }}
                            className="p-1 border text-xs font-semibold bg-white dark:bg-black"
                          >
                            <option value="Home">Home</option>
                            <option value="Office">Office</option>
                            <option value="Godown">Godown</option>
                            <option value="Warehouse">Warehouse</option>
                          </select>
                          <label className="flex items-center gap-1 cursor-pointer text-[11px]">
                            <input
                              type="radio"
                              name="defaultAddrRadio"
                              checked={addr.isDefault}
                              onChange={() => {
                                const updated = addresses.map((a, i) => ({
                                  ...a,
                                  isDefault: i === idx,
                                }));
                                setAddresses(updated);
                              }}
                            />
                            <span>Default</span>
                          </label>
                        </div>
                        {addresses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAddress(idx)}
                            className="text-neutral-400 hover:text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Address Line (Building, Street, Area)"
                        value={addr.addressLine}
                        onChange={e => {
                          const updated = [...addresses];
                          updated[idx].addressLine = e.target.value;
                          setAddresses(updated);
                        }}
                        className="w-full p-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="City"
                          value={addr.city}
                          onChange={e => {
                            const updated = [...addresses];
                            updated[idx].city = e.target.value;
                            setAddresses(updated);
                          }}
                          className="p-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs"
                        />
                        <input
                          type="text"
                          placeholder="State"
                          value={addr.state}
                          onChange={e => {
                            const updated = [...addresses];
                            updated[idx].state = e.target.value;
                            setAddresses(updated);
                          }}
                          className="p-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs"
                        />
                        <div>
                          <input
                            type="text"
                            placeholder="Pincode"
                            value={addr.pincode}
                            onChange={e => {
                              const updated = [...addresses];
                              updated[idx].pincode = e.target.value;
                              setAddresses(updated);
                            }}
                            className="w-full p-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs font-mono"
                          />
                          <span
                            className={`text-[9px] block mt-0.5 font-mono ${
                              check.serviceable ? 'text-green-600' : 'text-neutral-400'
                            }`}
                          >
                            {check.serviceable ? '✓ Serviceable Pincode' : 'Out-of-network area'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360 Detail View Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-end">
          <div className="bg-white dark:bg-neutral-900 border-l border-neutral-300 dark:border-neutral-700 w-full max-w-md h-full p-6 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-neutral-500">Customer 360 Profile</span>
                <h3 className="font-bold text-base">{selectedCustomer.name}</h3>
              </div>
              <button onClick={() => setSelectedCustomer(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics */}
            {(() => {
              const stats = customerStatsMap.get(selectedCustomer.id);
              return (
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 border bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-neutral-500 block text-[10px]">TOTAL SPENT (LTV)</span>
                    <span className="text-base font-bold">{formatINR(stats?.totalSpent || 0)}</span>
                  </div>
                  <div className="p-3 border bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-neutral-500 block text-[10px]">TOTAL ORDERS</span>
                    <span className="text-base font-bold">{stats?.orderCount || 0}</span>
                  </div>
                  <div className="p-3 border bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-neutral-500 block text-[10px]">AVG ORDER VALUE</span>
                    <span className="text-base font-bold">{formatINR(stats?.aov || 0)}</span>
                  </div>
                  <div className="p-3 border bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-neutral-500 block text-[10px]">CURRENT OUTSTANDING</span>
                    <span className="text-base font-bold text-red-600">{formatINR(stats?.outstanding || 0)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Contact Details */}
            <div className="space-y-1 text-xs">
              <span className="font-bold block uppercase tracking-wide">Contact Details</span>
              <div>Phone: {selectedCustomer.phone}</div>
              <div>Email: {selectedCustomer.email || 'None'}</div>
              <div>GSTIN: {selectedCustomer.gstin || 'None'}</div>
              <div>Credit Terms: {selectedCustomer.creditDays} days</div>
            </div>

            {/* Order History */}
            <div className="space-y-2 pt-3 border-t">
              <span className="font-bold text-xs uppercase tracking-wide block">Order History</span>
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs font-mono">
                {orders
                  .filter(o => o.customerId === selectedCustomer.id)
                  .map(o => (
                    <div key={o.id} className="p-2 border flex justify-between items-center">
                      <div>
                        <span className="font-bold block">{o.orderNo}</span>
                        <span className="text-[10px] text-neutral-500">{o.orderDate} · {o.deliveryStatus}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{formatINR(o.grandTotal)}</span>
                        <span className="block text-[10px] text-neutral-400">{o.paymentStatus}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Duplicate Customers Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-blue-600" />
                Merge Duplicate Customer Profiles
              </h2>
              <button onClick={() => setIsMergeModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Transfer all orders, invoices, payments, and delivery addresses from the duplicate profile into the primary profile, and remove the duplicate.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">
                  Primary Profile (Keep this profile) *
                </label>
                <select
                  value={primaryMergeId}
                  onChange={e => setPrimaryMergeId(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">
                  Duplicate Profile to Merge & Delete *
                </label>
                <select
                  value={duplicateMergeId}
                  onChange={e => setDuplicateMergeId(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  {customers
                    .filter(c => c.id !== primaryMergeId)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setIsMergeModalOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleExecuteMerge}
                  disabled={!primaryMergeId || !duplicateMergeId || primaryMergeId === duplicateMergeId}
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs disabled:opacity-40"
                >
                  Confirm Merge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

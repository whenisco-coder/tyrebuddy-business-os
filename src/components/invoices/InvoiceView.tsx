/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, CreditNote } from '../../types';
import { formatINR, HsnSummaryRow } from '../../utils/gst';
import { numberToIndianWords } from '../../utils/numberToWords';
import { generateQrDataUrl, buildUpiPayUri } from '../../utils/barcode';
import {
  Printer,
  FileText,
  ArrowLeft,
  RotateCcw,
  Check,
  Truck,
  CheckCircle2,
  Receipt,
  Sparkles,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

interface InvoiceViewProps {
  order: Order;
  onBack?: () => void;
  onViewLabel?: (order: Order) => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({ order, onBack, onViewLabel }) => {
  const { settings, products, updateOrder, createCreditNote } = useStore();
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');
  const [isProforma, setIsProforma] = useState<boolean>(order.isProforma || false);
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');
  const [showCreditNoteModal, setShowCreditNoteModal] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('Customer return / Defective replacement');
  const [createdCn, setCreatedCn] = useState<CreditNote | null>(null);

  // User requirement: B2C GST not required; B2B requires full GST breakdown.
  // Defaults to false for B2C (clean retail memo), true for B2B (tax invoice).
  const isB2B = order.customerType === 'B2B';
  const [showGstBreakdown, setShowGstBreakdown] = useState<boolean>(isB2B);

  // Generate UPI QR Code URL for balance due or total
  useEffect(() => {
    const balance =
      order.grandTotal - order.amountPaid > 0
        ? order.grandTotal - order.amountPaid
        : order.grandTotal;

    const upiUri = buildUpiPayUri(
      settings.upiId,
      settings.businessName,
      balance,
      `Inv ${order.invoiceNo || order.orderNo}`
    );

    generateQrDataUrl(upiUri, 150).then(url => {
      setUpiQrUrl(url);
    });
  }, [order, settings]);

  const handleToggleProforma = (checked: boolean) => {
    setIsProforma(checked);
    updateOrder(order.id, { isProforma: checked });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCreateCreditNote = () => {
    const itemsToReturn = order.items.map(it => ({
      name: it.name,
      qty: it.qty,
      hsn: it.hsn,
      unitPrice: it.unitPrice,
      taxableAmount: it.taxableAmount,
      cgstAmount: it.cgstAmount,
      sgstAmount: it.sgstAmount,
      igstAmount: it.igstAmount,
      totalAmount: it.totalAmount,
    }));

    const cn = createCreditNote({
      orderId: order.id,
      reason: returnReason,
      itemsToReturn,
    });
    setCreatedCn(cn);
  };

  // Calculate HSN summary table (used only in B2B Tax Invoice mode)
  const hsnSummaryMap = new Map<string, HsnSummaryRow>();
  order.items.forEach(it => {
    const key = `${it.hsn}-${it.gstPercent}`;
    const existing = hsnSummaryMap.get(key) || {
      hsn: it.hsn,
      taxableValue: 0,
      gstRate: it.gstPercent,
      cgstRate: order.isGujarat ? it.gstPercent / 2 : 0,
      cgstAmount: 0,
      sgstRate: order.isGujarat ? it.gstPercent / 2 : 0,
      sgstAmount: 0,
      igstRate: order.isGujarat ? 0 : it.gstPercent,
      igstAmount: 0,
      totalTax: 0,
    };

    existing.taxableValue += it.taxableAmount;
    existing.cgstAmount += it.cgstAmount;
    existing.sgstAmount += it.sgstAmount;
    existing.igstAmount += it.igstAmount;
    existing.totalTax += it.cgstAmount + it.sgstAmount + it.igstAmount;
    hsnSummaryMap.set(key, existing);
  });
  const hsnSummaryList = Array.from(hsnSummaryMap.values());

  const formatDateDDMonYYYY = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  // Calculations
  const roundedGrandTotal = Math.round(order.grandTotal);
  const roundOffValue = Math.round((roundedGrandTotal - order.grandTotal) * 100) / 100;
  const balanceDue = Math.max(0, roundedGrandTotal - order.amountPaid);

  // Check if Ship To is identical to Bill To
  const isShipToSame =
    !order.billingAddress ||
    (order.billingAddress.addressLine === order.shippingAddress.addressLine &&
      order.billingAddress.pincode === order.shippingAddress.pincode);

  return (
    <div className="space-y-4">
      {/* Top Toolbar (No-Print) */}
      <div className="no-print p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              title="Back to Orders"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono font-bold">
                1. Invoice
              </span>
              <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                {isProforma
                  ? 'Proforma Invoice'
                  : showGstBreakdown
                  ? 'B2B Tax Invoice'
                  : 'B2C Retail Bill / Cash Memo'}{' '}
                · {order.invoiceNo || order.orderNo}
              </h1>
            </div>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              Customer: {order.customerName} ({order.customerType}) · {order.orderDate} ·{' '}
              {showGstBreakdown ? 'Full GST Tax Invoicing (Input Tax Credit)' : 'Clean Retail Bill (No GST columns)'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Format Toggle: B2C Clean vs B2B Full Tax */}
          <div className="flex items-center border border-neutral-300 dark:border-neutral-700 text-xs font-mono">
            <button
              type="button"
              onClick={() => setShowGstBreakdown(false)}
              className={`px-3 py-1 font-bold transition ${
                !showGstBreakdown
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              title="Clean retail invoice without GST columns (Standard for B2C consumer sales)"
            >
              Clean Retail (B2C)
            </button>
            <button
              type="button"
              onClick={() => setShowGstBreakdown(true)}
              className={`px-3 py-1 font-bold transition ${
                showGstBreakdown
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              title="Full GST Tax Breakdown with CGST/SGST/IGST and HSN table (for B2B ITC claim)"
            >
              Full GST Tax (B2B)
            </button>
          </div>

          {/* Paper Size Toggle */}
          <div className="flex items-center border border-neutral-300 dark:border-neutral-700 text-xs font-mono">
            <button
              type="button"
              onClick={() => setPageSize('A4')}
              className={`px-2.5 py-1 ${
                pageSize === 'A4'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              A4
            </button>
            <button
              type="button"
              onClick={() => setPageSize('A5')}
              className={`px-2.5 py-1 ${
                pageSize === 'A5'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              A5
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono font-bold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Invoice</span>
          </button>

          {/* Step 2: Next Courier Label Button (Fulfills "Invoice 1st afterwards labale") */}
          {onViewLabel && (
            <button
              type="button"
              onClick={() => onViewLabel(order)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-mono font-bold transition shadow-xs"
              title="Proceed to Step 2: Generate & Print Courier Shipping Label"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Next: Courier Label (2nd) &rarr;</span>
            </button>
          )}

          {/* Credit note button */}
          <button
            type="button"
            onClick={() => setShowCreditNoteModal(true)}
            className="p-1.5 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100"
            title="Generate Credit Note"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Credit Note Alert if present */}
      {order.creditNoteRef && (
        <div className="no-print p-3 bg-neutral-100 dark:bg-neutral-800 border-l-4 border-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 font-mono">
          Credit note <strong>{order.creditNoteRef}</strong> has been issued for this invoice.
        </div>
      )}

      {/* =========================================================================
          Clean, Authentic, Compliant Invoice Canvas (A4 / A5)
          ========================================================================= */}
      <div
        data-page-size={pageSize}
        className={`mx-auto bg-white text-black font-sans shadow-sm border border-neutral-300 print:border-0 print:shadow-none invoice-document-canvas ${
          pageSize === 'A4'
            ? 'max-w-[210mm] min-h-[297mm] p-6 invoice-a4'
            : 'max-w-[148mm] min-h-[210mm] p-3 text-[11px] invoice-a5 flex flex-col justify-between'
        }`}
      >
        <div className="border-2 border-black invoice-border-wrapper flex flex-col flex-1 justify-between min-h-full">
          {/* 1. Header Title Banner */}
          <div className="border-b-2 border-black py-2 px-3 text-center bg-neutral-50 print:bg-transparent">
            <h2 className="text-base font-bold tracking-wider uppercase font-mono">
              {isProforma
                ? 'PROFORMA INVOICE'
                : showGstBreakdown
                ? 'TAX INVOICE'
                : 'RETAIL INVOICE / CASH MEMO'}
            </h2>
            <p className="text-[10px] text-neutral-600 font-mono">
              {isProforma
                ? '(Price Quotation Only · Not a GST Tax Invoice)'
                : showGstBreakdown
                ? '(Under Section 31 of CGST Act, 2017 · Eligible for Input Tax Credit)'
                : '(Original for Recipient · Retail Cash Sale)'}
            </p>
          </div>

          {/* 2. Business (Seller) & Invoice Details Matrix */}
          <div className="grid grid-cols-2 border-b border-black">
            {/* Seller Info (Left) */}
            <div className="p-3 border-r border-black space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-neutral-500 font-mono tracking-wider">
                  ISSUED BY (SELLER)
                </span>
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    referrerPolicy="no-referrer"
                    className="h-7 max-w-[90px] object-contain"
                  />
                )}
              </div>
              <h3 className="text-sm font-bold uppercase tracking-tight">{settings.businessName}</h3>
              <p className="text-[11px] text-neutral-700 leading-snug">{settings.address}</p>
              <div className="text-[11px] font-mono pt-1 space-y-0.5">
                <div>
                  <strong>GSTIN:</strong> {settings.gstin}
                </div>
                <div>
                  <strong>State:</strong> {settings.state} (Code {settings.stateCode}) · <strong>Phone:</strong> {settings.phone}
                </div>
              </div>
            </div>

            {/* Invoice Meta Numbers (Right) */}
            <div className="p-3 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between border-b border-neutral-300 pb-1">
                <span className="text-neutral-600 font-semibold">Invoice No:</span>
                <span className="font-bold text-xs text-black">{order.invoiceNo || order.orderNo}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-300 pb-1">
                <span className="text-neutral-600 font-semibold">Dated:</span>
                <span className="font-bold">{formatDateDDMonYYYY(order.orderDate)}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-300 pb-1">
                <span className="text-neutral-600 font-semibold">Order Ref:</span>
                <span>{order.orderNo}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-300 pb-1">
                <span className="text-neutral-600 font-semibold">Place of Supply:</span>
                <span className="font-bold">
                  {order.shippingAddress.state} ({order.isGujarat ? 'State Code 24' : 'Inter-State'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 font-semibold">Customer Type:</span>
                <span className="font-bold">{order.customerType} ({showGstBreakdown ? 'B2B Registered' : 'B2C Consumer'})</span>
              </div>
            </div>
          </div>

          {/* 3. Customer (Buyer & Consignee) Details */}
          <div className="border-b-2 border-black p-3 text-[11px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Buyer Information */}
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-neutral-500 font-mono tracking-wider block">
                  BILLED TO (BUYER)
                </span>
                <h4 className="font-bold text-xs uppercase">{order.customerName}</h4>
                <p className="text-neutral-700 leading-snug">
                  {order.billingAddress?.addressLine || order.shippingAddress.addressLine}
                </p>
                <p className="text-neutral-700 font-mono text-[10px]">
                  {order.billingAddress?.city || order.shippingAddress.city},{' '}
                  {order.billingAddress?.state || order.shippingAddress.state} -{' '}
                  {order.billingAddress?.pincode || order.shippingAddress.pincode}
                </p>
                <div className="pt-0.5 font-mono text-[10px] space-y-0.5">
                  <div>
                    <strong>Phone:</strong> {order.customerPhone}
                  </div>
                  {order.customerGstin && (
                    <div>
                      <strong>GSTIN / UIN:</strong> {order.customerGstin}
                    </div>
                  )}
                </div>
              </div>

              {/* Consignee (Ship To) - Shown if different or if tracking exists */}
              {!isShipToSame ? (
                <div className="space-y-0.5 border-t md:border-t-0 md:border-l border-neutral-300 md:pl-3">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 font-mono tracking-wider block">
                    SHIPPED TO (CONSIGNEE)
                  </span>
                  <h4 className="font-bold text-xs uppercase">{order.customerName}</h4>
                  <p className="text-neutral-700 leading-snug">{order.shippingAddress.addressLine}</p>
                  <p className="text-neutral-700 font-mono text-[10px]">
                    {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
                  </p>
                  <div className="pt-0.5 font-mono text-[10px]">
                    <strong>Dispatch via:</strong> {order.courierName || 'Local'} {order.awbNumber ? `(AWB: ${order.awbNumber})` : ''}
                  </div>
                </div>
              ) : (
                <div className="hidden md:flex flex-col justify-end text-right font-mono text-[10px] text-neutral-500">
                  <div>Shipment Address: Same as Billing Address</div>
                  {order.courierName && (
                    <div>Courier: {order.courierName} {order.awbNumber ? `· AWB ${order.awbNumber}` : ''}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 4. Itemized Table (Dynamic: Clean Retail B2C vs Detailed B2B Tax) */}
          <div className="overflow-x-auto invoice-items-wrapper flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-neutral-100 font-mono font-bold text-[10px]">
                  <th className="p-1.5 border-r border-black w-8 text-center">S.No</th>
                  <th className="p-1.5 border-r border-black">Description of Goods</th>
                  <th className="p-1.5 border-r border-black w-20 text-center">HSN</th>
                  <th className="p-1.5 border-r border-black w-12 text-center">Qty</th>
                  
                  {/* In B2C Mode: Rate & Amount only (No GST columns) */}
                  {!showGstBreakdown ? (
                    <>
                      <th className="p-1.5 border-r border-black w-24 text-right">Rate (₹)</th>
                      <th className="p-1.5 text-right w-28">Amount (₹)</th>
                    </>
                  ) : (
                    /* In B2B Mode: Full Indian Tax Invoicing Columns */
                    <>
                      <th className="p-1.5 border-r border-black w-20 text-right">Rate (₹)</th>
                      <th className="p-1.5 border-r border-black w-24 text-right">Taxable (₹)</th>
                      <th className="p-1.5 border-r border-black w-12 text-center">GST%</th>
                      {order.isGujarat ? (
                        <>
                          <th className="p-1.5 border-r border-black w-16 text-right">CGST (₹)</th>
                          <th className="p-1.5 border-r border-black w-16 text-right">SGST (₹)</th>
                        </>
                      ) : (
                        <th className="p-1.5 border-r border-black w-20 text-right">IGST (₹)</th>
                      )}
                      <th className="p-1.5 text-right w-24">Total (₹)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => {
                  const prodObj = products.find(p => p.id === item.productId);
                  const itemRate = !showGstBreakdown
                    ? (item.totalAmount / item.qty) // All-inclusive rate for retail
                    : item.unitPrice;

                  return (
                    <tr key={item.id || idx} className="border-b border-neutral-300 font-mono text-[10px] align-top">
                      <td className="p-1.5 border-r border-black text-center">{idx + 1}</td>
                      <td className="p-1.5 border-r border-black font-sans">
                        <div className="font-semibold text-black leading-tight">{item.name}</div>
                        <div className="text-[9px] text-neutral-500 font-mono mt-0.5 flex items-center gap-1.5">
                          {prodObj?.brand && <span className="font-bold text-neutral-700">{prodObj.brand}</span>}
                          <span>SKU: {item.sku}</span>
                          {prodObj?.warrantyMonths && <span>· {prodObj.warrantyMonths}M Warranty</span>}
                        </div>
                      </td>
                      <td className="p-1.5 border-r border-black text-center">{item.hsn}</td>
                      <td className="p-1.5 border-r border-black text-center font-bold">{item.qty}</td>

                      {/* Clean Retail Mode (B2C) */}
                      {!showGstBreakdown ? (
                        <>
                          <td className="p-1.5 border-r border-black text-right tabular-nums">
                            {itemRate.toFixed(2)}
                          </td>
                          <td className="p-1.5 text-right tabular-nums font-bold">
                            {item.totalAmount.toFixed(2)}
                          </td>
                        </>
                      ) : (
                        /* Full B2B Tax Invoice Mode */
                        <>
                          <td className="p-1.5 border-r border-black text-right tabular-nums">
                            {item.unitPrice.toFixed(2)}
                          </td>
                          <td className="p-1.5 border-r border-black text-right tabular-nums font-semibold">
                            {item.taxableAmount.toFixed(2)}
                          </td>
                          <td className="p-1.5 border-r border-black text-center font-bold">
                            {item.gstPercent}%
                          </td>
                          {order.isGujarat ? (
                            <>
                              <td className="p-1.5 border-r border-black text-right tabular-nums">
                                {item.cgstAmount.toFixed(2)}
                              </td>
                              <td className="p-1.5 border-r border-black text-right tabular-nums">
                                {item.sgstAmount.toFixed(2)}
                              </td>
                            </>
                          ) : (
                            <td className="p-1.5 border-r border-black text-right tabular-nums">
                              {item.igstAmount.toFixed(2)}
                            </td>
                          )}
                          <td className="p-1.5 text-right tabular-nums font-bold">
                            {item.totalAmount.toFixed(2)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. Bottom Section: Totals, Payment & Signature (Pinned to bottom on A5 print) */}
          <div className="invoice-bottom-section mt-auto flex flex-col">
            {/* Totals & Calculations Row */}
            <div className="grid grid-cols-12 border-t-2 border-black text-xs font-mono">
              {/* Left Column: Amount in Words + Terms */}
              <div className="col-span-7 p-3 border-r border-black flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 block">
                    AMOUNT IN WORDS (INR):
                  </span>
                  <p className="font-bold text-xs capitalize text-black leading-snug">
                    {numberToIndianWords(roundedGrandTotal)}
                  </p>
                  {order.notes && (
                    <p className="mt-1 text-[10px] text-neutral-600 font-sans italic">
                      <strong>Remarks:</strong> {order.notes}
                    </p>
                  )}
                </div>

                {/* Concise, Compliant Terms */}
                <div className="pt-2 border-t border-neutral-300 text-[9px] text-neutral-600 font-sans space-y-1">
                  {!showGstBreakdown ? (
                    <div className="font-mono text-emerald-800 font-semibold">
                      * All prices shown are inclusive of applicable GST taxes.
                    </div>
                  ) : (
                    <div>
                      * Certified that the particulars given above are true and correct. Input Tax Credit is admissible to registered recipient.
                    </div>
                  )}
                  <div>
                    1. Tyres and batteries carry standard manufacturer warranty as per company guidelines.
                  </div>
                  <div className="text-neutral-400 font-mono text-[8px]">
                    Subject to Surat jurisdiction · This is a computer generated invoice.
                  </div>
                </div>
              </div>

              {/* Right Column: Numbers Breakdown */}
              <div className="col-span-5 p-2.5 space-y-1 text-[11px]">
                {/* For B2C: Clean total breakdown */}
                {!showGstBreakdown ? (
                  <>
                    <div className="flex justify-between py-0.5 border-b border-neutral-200">
                      <span className="text-neutral-600">Total Items Value:</span>
                      <span className="font-semibold tabular-nums">{formatINR(order.grandTotal)}</span>
                    </div>

                    {order.discountAmount > 0 && (
                      <div className="flex justify-between py-0.5 border-b border-neutral-200 text-emerald-700">
                        <span>Discount Savings:</span>
                        <span className="tabular-nums">- {formatINR(order.discountAmount)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* For B2B: Taxable + CGST + SGST / IGST */
                  <>
                    <div className="flex justify-between py-0.5 border-b border-neutral-200">
                      <span className="text-neutral-600">Taxable Subtotal:</span>
                      <span className="font-semibold tabular-nums">{formatINR(order.subtotal)}</span>
                    </div>

                    {order.discountAmount > 0 && (
                      <div className="flex justify-between py-0.5 border-b border-neutral-200 text-neutral-600">
                        <span>Discount ({order.discountPercent}%):</span>
                        <span className="tabular-nums">- {formatINR(order.discountAmount)}</span>
                      </div>
                    )}

                    {order.isGujarat ? (
                      <>
                        <div className="flex justify-between py-0.5 border-b border-neutral-200">
                          <span className="text-neutral-600">CGST (Central Tax):</span>
                          <span className="font-semibold tabular-nums">{formatINR(order.cgstTotal)}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-neutral-200">
                          <span className="text-neutral-600">SGST (State Tax):</span>
                          <span className="font-semibold tabular-nums">{formatINR(order.sgstTotal)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-0.5 border-b border-neutral-200">
                        <span className="text-neutral-600">IGST (Integrated Tax):</span>
                        <span className="font-semibold tabular-nums">{formatINR(order.igstTotal)}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Round Off */}
                <div className="flex justify-between py-0.5 border-b border-neutral-200 text-neutral-500 text-[10px]">
                  <span>Round-off:</span>
                  <span className="tabular-nums">
                    {roundOffValue >= 0 ? `+ ${formatINR(roundOffValue)}` : `- ${formatINR(Math.abs(roundOffValue))}`}
                  </span>
                </div>

                {/* Grand Total */}
                <div className="flex justify-between py-1.5 border-t-2 border-black font-bold text-sm bg-neutral-100 print:bg-transparent">
                  <span>NET PAYABLE:</span>
                  <span className="tabular-nums">{formatINR(roundedGrandTotal)}</span>
                </div>

                <div className="flex justify-between py-0.5 text-[10px] text-neutral-600">
                  <span>Payment Mode:</span>
                  <span className="font-bold">{order.paymentStatus}</span>
                </div>
                {balanceDue > 0 && (
                  <div className="flex justify-between py-0.5 text-[10px] text-red-600 font-bold">
                    <span>Balance Due:</span>
                    <span className="tabular-nums">{formatINR(balanceDue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 6. HSN / SAC Summary Table (Rendered ONLY in B2B Mode; OMITTED in B2C Mode) */}
            {showGstBreakdown && (
              <div className="border-t border-black p-2 bg-neutral-50 print:bg-transparent">
                <span className="text-[9px] font-mono font-bold uppercase text-neutral-700 block mb-1">
                  HSN / SAC Tax Analysis:
                </span>
                <table className="w-full text-left font-mono text-[9px] border border-neutral-400 border-collapse">
                  <thead>
                    <tr className="bg-neutral-200 print:bg-transparent border-b border-neutral-400">
                      <th className="p-1 border-r border-neutral-400">HSN</th>
                      <th className="p-1 border-r border-neutral-400 text-right">Taxable (₹)</th>
                      {order.isGujarat ? (
                        <>
                          <th className="p-1 border-r border-neutral-400 text-right">CGST Rate</th>
                          <th className="p-1 border-r border-neutral-400 text-right">CGST Amt (₹)</th>
                          <th className="p-1 border-r border-neutral-400 text-right">SGST Rate</th>
                          <th className="p-1 border-r border-neutral-400 text-right">SGST Amt (₹)</th>
                        </>
                      ) : (
                        <>
                          <th className="p-1 border-r border-neutral-400 text-right">IGST Rate</th>
                          <th className="p-1 border-r border-neutral-400 text-right">IGST Amt (₹)</th>
                        </>
                      )}
                      <th className="p-1 text-right">Total Tax (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnSummaryList.map((row, idx) => (
                      <tr key={idx} className="border-b border-neutral-300">
                        <td className="p-1 border-r border-neutral-400 font-semibold">{row.hsn}</td>
                        <td className="p-1 border-r border-neutral-400 text-right tabular-nums">{row.taxableValue.toFixed(2)}</td>
                        {order.isGujarat ? (
                          <>
                            <td className="p-1 border-r border-neutral-400 text-right">{row.cgstRate}%</td>
                            <td className="p-1 border-r border-neutral-400 text-right tabular-nums">{row.cgstAmount.toFixed(2)}</td>
                            <td className="p-1 border-r border-neutral-400 text-right">{row.sgstRate}%</td>
                            <td className="p-1 border-r border-neutral-400 text-right tabular-nums">{row.sgstAmount.toFixed(2)}</td>
                          </>
                        ) : (
                          <>
                            <td className="p-1 border-r border-neutral-400 text-right">{row.igstRate}%</td>
                            <td className="p-1 border-r border-neutral-400 text-right tabular-nums">{row.igstAmount.toFixed(2)}</td>
                          </>
                        )}
                        <td className="p-1 text-right tabular-nums font-bold">{row.totalTax.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 7. Payment UPI & Authorized Signature Block */}
            <div className="grid grid-cols-12 border-t-2 border-black text-xs font-mono invoice-footer-signature-block invoice-signature-block">
              {/* Payment Details (Col 8) */}
              <div className="col-span-8 p-2.5 border-r border-black flex items-center gap-3">
                {upiQrUrl && (
                  <div className="flex flex-col items-center shrink-0">
                    <img
                      src={upiQrUrl}
                      alt="UPI QR"
                      className="w-20 h-20 border border-black p-0.5 bg-white"
                    />
                    <span className="text-[8px] font-bold text-neutral-600 mt-0.5">Scan to Pay UPI</span>
                  </div>
                )}

                <div className="space-y-0.5 text-[10px]">
                  {showGstBreakdown ? (
                    // B2B: Bank Transfer Details
                    <>
                      <div className="font-bold text-black uppercase tracking-wider text-[10px]">
                        Bank &amp; Settlement:
                      </div>
                      <div><strong>Bank:</strong> {settings.bankName} · <strong>IFSC:</strong> {settings.ifscCode}</div>
                      <div><strong>A/C No:</strong> {settings.accountNumber} ({settings.accountName})</div>
                      <div><strong>UPI ID:</strong> {settings.upiId}</div>
                    </>
                  ) : (
                    // B2C: Instant UPI
                    <>
                      <div className="font-bold text-black uppercase tracking-wider text-[10px]">
                        Instant Digital Settlement:
                      </div>
                      <p className="text-neutral-600 text-[10px] leading-tight">
                        Scan with GPay, PhonePe, Paytm or BHIM for instant verified receipt.
                      </p>
                      <div><strong>UPI ID:</strong> {settings.upiId}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Authorized Signatory (Col 4) */}
              <div className="col-span-4 p-2 flex flex-col justify-between items-center text-center">
                <span className="text-[9px] font-bold uppercase text-neutral-700">
                  For {settings.businessName}
                </span>

                <div className="h-12 flex items-center justify-center invoice-signature-box">
                  {settings.signatureUrl ? (
                    <img
                      src={settings.signatureUrl}
                      alt="Signature"
                      className="max-h-11 max-w-full object-contain"
                    />
                  ) : (
                    <div className="border border-dashed border-neutral-300 px-2 py-0.5 text-[8px] text-neutral-400 font-sans">
                      [Authorized Stamp &amp; Sign]
                    </div>
                  )}
                </div>

                <span className="text-[9px] text-neutral-600 uppercase border-t border-black w-full pt-0.5 font-bold">
                  Authorized Signatory
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Note Generation Modal */}
      {showCreditNoteModal && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Generate Credit Note for {order.invoiceNo || order.orderNo}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Reason for Return / Adjustment:
              </label>
              <textarea
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                rows={3}
                className="w-full text-xs p-2 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
              />
            </div>

            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 text-xs font-mono">
              Total Credit Refund Amount: <strong>{formatINR(order.grandTotal)}</strong>
            </div>

            {createdCn && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-mono flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Issued: <strong>{createdCn.creditNoteNo}</strong></span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setShowCreditNoteModal(false);
                  setCreatedCn(null);
                }}
                className="px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 font-mono"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCreateCreditNote}
                className="px-3 py-1.5 text-xs bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold font-mono"
              >
                Confirm &amp; Issue Credit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

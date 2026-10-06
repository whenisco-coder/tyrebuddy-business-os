/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, CreditNote } from '../../types';
import { HsnSummaryRow } from '../../utils/gst';   // <-- formatINR removed
import { numberToIndianWords } from '../../utils/numberToWords';
import { generateQrDataUrl, buildUpiPayUri } from '../../utils/barcode';
import { Capacitor } from '@capacitor/core';
// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.min.js';
import { saveAndShareFile } from '../../utils/export';
import {
  Printer,
  ArrowLeft,
  RotateCcw,
  Truck,
  CheckCircle2,
  X,
} from 'lucide-react';

interface InvoiceViewProps {
  order: Order;
  onBack?: () => void;
  onViewLabel?: (order: Order) => void;
}

export const InvoiceView: React.FC<InvoiceViewProps> = ({ order, onBack, onViewLabel }) => {
  const { settings, createCreditNote } = useStore();
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');
  const [isProforma, setIsProforma] = useState<boolean>(order.isProforma || false);
  const [upiQrUrl, setUpiQrUrl] = useState<string>('');
  const [showCreditNoteModal, setShowCreditNoteModal] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('Customer return / Defective replacement');
  const [createdCn, setCreatedCn] = useState<CreditNote | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const isB2B = order.customerType === 'B2B';
  const [showGstBreakdown, setShowGstBreakdown] = useState<boolean>(isB2B);

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

  const handlePrint = async () => {
    if (!invoiceRef.current) {
      alert('Invoice content not found');
      return;
    }

    if (Capacitor.isNativePlatform()) {
      setIsGenerating(true);

      const opt = {
        margin: 0.3,
        filename: `Invoice-${order.invoiceNo || order.orderNo}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: pageSize.toLowerCase(), orientation: 'portrait' as const },
      };

      try {
        const pdfDataUri = await html2pdf()
          .from(invoiceRef.current)
          .set(opt)
          .outputPdf('datauristring');

        await saveAndShareFile(
          `Invoice-${order.invoiceNo || order.orderNo}.pdf`,
          pdfDataUri,
          'application/pdf'
        );
      } catch (error) {
        console.error('PDF generation failed', error);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    } else {
      window.print();
    }
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

  const roundedGrandTotal = Math.round(order.grandTotal);
  const roundOffValue = Math.round((roundedGrandTotal - order.grandTotal) * 100) / 100;
  const balanceDue = Math.max(0, roundedGrandTotal - order.amountPaid);

  const isShipToSame =
    !order.billingAddress ||
    (order.billingAddress.addressLine === order.shippingAddress.addressLine &&
      order.billingAddress.pincode === order.shippingAddress.pincode);
  return (
  <div className="space-y-4">
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
        <div className="flex items-center border border-neutral-300 dark:border-neutral-700 text-xs font-mono">
          <button
            type="button"
            onClick={() => setShowGstBreakdown(false)}
            className={`px-3 py-1 font-bold transition ${
              !showGstBreakdown
                ? 'bg-amber-500 text-neutral-950 font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
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
          >
            Full GST Tax (B2B)
          </button>
        </div>

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

        <button
          type="button"
          onClick={handlePrint}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono font-bold shadow-xs ${
            isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-800'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{isGenerating ? 'Generating PDF...' : 'Print / Save PDF'}</span>
        </button>

        {onViewLabel && (
          <button
            type="button"
            onClick={() => onViewLabel(order)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-mono font-bold transition shadow-xs"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Next: Courier Label (2nd) &rarr;</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowCreditNoteModal(true)}
          className="p-1.5 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>

    {order.creditNoteRef && (
      <div className="no-print p-3 bg-neutral-100 dark:bg-neutral-800 border-l-4 border-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 font-mono">
        Credit note <strong>{order.creditNoteRef}</strong> has been issued for this invoice.
      </div>
    )}

    <div
      ref={invoiceRef}
      data-page-size={pageSize}
      className={`mx-auto bg-white text-black font-sans shadow-sm border border-neutral-300 print:border-0 print:shadow-none invoice-document-canvas ${
        pageSize === 'A4'
          ? 'max-w-[210mm] min-h-[297mm] p-6 invoice-a4'
          : 'max-w-[148mm] min-h-[210mm] p-3 text-[11px] invoice-a5 flex flex-col justify-between'
      }`}
    >
      <div className="border-2 border-black invoice-border-wrapper flex flex-col flex-1 justify-between min-h-full">
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

        <div className="grid grid-cols-2 border-b border-black">
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

        <div className="border-b-2 border-black p-3 text-[11px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="overflow-x-auto invoice-items-wrapper flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black bg-neutral-100 font-mono font-bold text-[10px]">
                  <th className="p-1.5 border-r border-black w-8 text-center">S.No</th>
                  <th className="p-1.5 border-r border-black">Description of Goods</th>
                  <th className="p-1.5 border-r border-black w-20 text-center">HSN</th>
                  <th className="p-1.5 border-r border-black w-12 text-center">Qty</th>

                  {!showGstBreakdown ? (
                    <>
                      <th className="p-1.5 border-r border-black w-24 text-right">Rate (₹)</th>
                      <th className="p-1.5 text-right w-28">Amount (₹)</th>
                    </>
                  ) : (
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
              <tbody className="font-mono text-[10px]">
                {order.items.map((item, index) => (
                  <tr key={index} className="border-b border-neutral-300">
                    <td className="p-1.5 border-r border-black text-center">{index + 1}</td>
                    <td className="p-1.5 border-r border-black">{item.name}</td>
                    <td className="p-1.5 border-r border-black text-center">{item.hsn}</td>
                    <td className="p-1.5 border-r border-black text-center">{item.qty}</td>

                    {!showGstBreakdown ? (
                      <>
                        <td className="p-1.5 border-r border-black text-right">{item.unitPrice.toFixed(2)}</td>
                        <td className="p-1.5 text-right">{item.totalAmount.toFixed(2)}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-1.5 border-r border-black text-right">{item.unitPrice.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-black text-right">{item.taxableAmount.toFixed(2)}</td>
                        <td className="p-1.5 border-r border-black text-center">{item.gstPercent}%</td>
                        {order.isGujarat ? (
                          <>
                            <td className="p-1.5 border-r border-black text-right">{item.cgstAmount.toFixed(2)}</td>
                            <td className="p-1.5 border-r border-black text-right">{item.sgstAmount.toFixed(2)}</td>
                          </>
                        ) : (
                          <td className="p-1.5 border-r border-black text-right">{item.igstAmount.toFixed(2)}</td>
                        )}
                        <td className="p-1.5 text-right">{item.totalAmount.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t-2 border-black grid grid-cols-2">
            <div className="border-r border-black p-3 space-y-2">
              <div className="text-[10px] font-mono">
                <span className="font-bold block mb-1">Amount Chargeable (in words):</span>
                <span className="italic">{numberToIndianWords(roundedGrandTotal)}</span>
              </div>

              {showGstBreakdown && hsnSummaryList.length > 0 && (
                <div className="mt-4">
                  <table className="w-full border-collapse text-[9px] font-mono">
                    <thead>
                      <tr className="border border-black bg-neutral-100">
                        <th className="border border-black p-1">HSN/SAC</th>
                        <th className="border border-black p-1">Taxable Value</th>
                        <th className="border border-black p-1">IGST Rate</th>
                        <th className="border border-black p-1">IGST Amount</th>
                        <th className="border border-black p-1">Total Tax Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hsnSummaryList.map((row, idx) => (
                        <tr key={idx}>
                          <td className="border border-black p-1 text-center">{row.hsn}</td>
                          <td className="border border-black p-1 text-right">{row.taxableValue.toFixed(2)}</td>
                          <td className="border border-black p-1 text-center">{row.igstRate}%</td>
                          <td className="border border-black p-1 text-right">{row.igstAmount.toFixed(2)}</td>
                          <td className="border border-black p-1 text-right">{row.totalTax.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 flex flex-col justify-end text-[11px] font-mono space-y-1">
              {showGstBreakdown && (
                <>
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Total Taxable Value:</span>
                    <span>{order.taxableAmount.toFixed(2)}</span>
                  </div>
                  {order.isGujarat ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Total CGST:</span>
                        <span>{order.cgstAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Total SGST:</span>
                        <span>{order.sgstAmount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Total IGST:</span>
                      <span>{order.igstAmount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between border-t border-black pt-1">
                <span className="font-bold">Subtotal:</span>
                <span className="font-bold">{order.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Round Off:</span>
                <span>{roundOffValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-black pt-1 text-sm">
                <span className="font-bold">Grand Total:</span>
                <span className="font-bold">₹{roundedGrandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-neutral-600">Amount Paid:</span>
                <span>₹{order.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-300 pt-1">
                <span className="font-bold text-red-600">Balance Due:</span>
                <span className="font-bold text-red-600">₹{balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-black grid grid-cols-2 text-[10px]">
            <div className="p-3 border-r border-black">
              <span className="font-bold block mb-1">Declaration:</span>
              <p className="text-neutral-600 leading-tight">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
              {isProforma && (
                <p className="mt-2 text-red-600 font-bold">
                  * This is a Proforma Invoice and not a valid tax document for Input Tax Credit.
                </p>
              )}
            </div>
            <div className="p-3 flex flex-col items-end justify-between text-right">
              <div>
                <p className="font-bold">For {settings.businessName}</p>
                {upiQrUrl && (
                  <div className="mt-1 flex flex-col items-center">
                    <img src={upiQrUrl} alt="UPI QR" className="w-16 h-16 border border-black" />
                    <span className="text-[8px] mt-0.5">Scan to Pay</span>
                  </div>
                )}
              </div>
              <p className="mt-4 font-bold">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>

      {showCreditNoteModal && (
        <div className="no-print fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-bold mb-4 text-neutral-900 dark:text-neutral-100">
              Generate Credit Note
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              This will create a full credit note for Order #{order.orderNo} and reverse the entire invoice value.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold mb-1 text-neutral-700 dark:text-neutral-300">
                Reason for Return
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full border border-neutral-300 dark:border-neutral-700 p-2 text-sm bg-transparent text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreditNoteModal(false)}
                className="px-4 py-2 text-sm font-bold border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCreditNote}
                className="px-4 py-2 text-sm font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 hover:bg-neutral-800"
              >
                Confirm & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {createdCn && (
        <div className="no-print fixed bottom-4 right-4 bg-green-600 text-white p-4 shadow-lg flex items-center gap-3 z-50">
          <CheckCircle2 className="w-6 h-6" />
          <div>
            <p className="font-bold text-sm">Credit Note Created</p>
            <p className="text-xs">CN #{createdCn.creditNoteNo} has been generated successfully.</p>
          </div>
          <button onClick={() => setCreatedCn(null)} className="ml-4 hover:text-green-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

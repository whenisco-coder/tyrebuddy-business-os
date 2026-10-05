import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order } from '../../types';
import { formatINR } from '../../utils/gst';
import { generateCode128Svg } from '../../utils/barcode';
import { Printer, AlertTriangle, ArrowLeft, Layers, Edit2, Check, FileText } from 'lucide-react';
import { InvoiceView } from '../invoices/InvoiceView';

interface CourierLabelViewProps {
  order: Order;
  onBack?: () => void;
  onViewInvoice?: (order: Order) => void;
}

export const CourierLabelView: React.FC<CourierLabelViewProps> = ({ order, onBack, onViewInvoice }) => {
  const { settings, updateOrder } = useStore();
  const [labelSize, setLabelSize] = useState<'A5' | 'A4' | 'A6' | '4x6'>('4x6');
  const [isCombinedMode, setIsCombinedMode] = useState(false);
  const [courierName, setCourierName] = useState(order.courierName || 'Delhivery Surface');
  const [awbNumber, setAwbNumber] = useState(order.awbNumber || `AWB${order.orderNo.replace(/\D/g, '')}IN`);
  const [isEditingAwb, setIsEditingAwb] = useState(false);

  // Check if any line item in the order has battery
  const hasBatteryItem = order.items.some(it => it.hasBattery);
  const batteryTypes = order.items
    .filter(it => it.hasBattery)
    .map(it => it.batteryType || 'Battery')
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  const handleSaveAwb = () => {
    updateOrder(order.id, { courierName, awbNumber });
    setIsEditingAwb(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate SVG Code128 string for AWB
  const barcodeSvg = generateCode128Svg(awbNumber, 260, 60, true);

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500 text-neutral-950 text-xs font-mono font-bold">
                2. Shipping Label
              </span>
              <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 font-mono">
                Shipping & Courier Label · {order.orderNo}
              </h1>
            </div>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              AWB: {awbNumber} · Courier: {courierName} · {order.customerName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onViewInvoice && (
            <button
              type="button"
              onClick={() => onViewInvoice(order)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-xs font-mono font-bold"
              title="Go back to Step 1: Invoice"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>&larr; View Invoice (1st)</span>
            </button>
          )}

          {/* Combined Invoice + Label on same A5 sheet toggle */}
          <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isCombinedMode}
              onChange={e => setIsCombinedMode(e.target.checked)}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
            />
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Invoice + Label Combined (A5)
            </span>
          </label>

          {/* Size Selector */}
          {!isCombinedMode && (
            <div className="flex items-center border border-neutral-300 dark:border-neutral-700 text-xs">
              {(['4x6', 'A6', 'A5', 'A4'] as const).map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setLabelSize(sz)}
                  className={`px-2.5 py-1 font-mono font-medium ${
                    labelSize === sz
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                  }`}
                >
                  {sz === '4x6' ? '4×6 Thermal' : sz}
                </button>
              ))}
            </div>
          )}

          {/* Manual AWB Edit */}
          <button
            type="button"
            onClick={() => setIsEditingAwb(!isEditingAwb)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit AWB
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold"
          >
            <Printer className="w-4 h-4" />
            Print Label
          </button>
        </div>
      </div>

      {/* Manual AWB input drawer */}
      {isEditingAwb && (
        <div className="no-print p-4 bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 uppercase mb-0.5">
              Courier Partner:
            </label>
            <input
              type="text"
              value={courierName}
              onChange={e => setCourierName(e.target.value)}
              placeholder="e.g. Delhivery, Bluedart, VRL Logistics"
              className="px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 uppercase mb-0.5">
              AWB / Tracking Number:
            </label>
            <input
              type="text"
              value={awbNumber}
              onChange={e => setAwbNumber(e.target.value)}
              placeholder="e.g. DLHV-10293847"
              className="px-3 py-1.5 text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveAwb}
            className="mt-4 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            Update AWB
          </button>
        </div>
      )}

      {/* Combined View Mode: Label on Top, Invoice Below on same sheet */}
      {isCombinedMode ? (
        <div className="mx-auto max-w-[148mm] bg-white text-black p-4 space-y-4 print:p-0 print:m-0 print:border-0">
          <div className="border-2 border-black p-3 space-y-2">
            <div className="flex justify-between items-center border-b border-black pb-2">
              <span className="font-bold text-sm tracking-wider uppercase font-mono">{courierName}</span>
              <span className="text-xs font-mono font-bold">AIR / SURFACE CARGO</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-neutral-500">SHIP TO:</div>
                <div className="text-sm font-bold">{order.customerName}</div>
                <div className="text-xs">{order.shippingAddress.addressLine}, {order.shippingAddress.city}</div>
                <div className="text-xs font-bold">{order.shippingAddress.state} - {order.shippingAddress.pincode}</div>
                <div className="text-xs font-mono">PH: {order.customerPhone}</div>
              </div>
              <div className="text-right">
                <div className={`px-3 py-1 text-xs font-bold font-mono border-2 border-black ${order.paymentStatus === 'COD' ? 'bg-black text-white' : ''}`}>
                  {order.paymentStatus === 'COD' ? `COD: ${formatINR(order.grandTotal)}` : 'PREPAID'}
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-center">
              <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
            </div>
          </div>

          {/* Compact invoice below on the same sheet */}
          <div className="border-t-2 border-dashed border-black pt-2">
            <InvoiceView order={order} />
          </div>
        </div>
      ) : (
        /* Standalone Courier Label View */
        <div className="flex justify-center p-4">
          <div
            className={`bg-white text-black border-2 border-black p-4 font-sans shadow-md print:border-2 print:shadow-none ${
              labelSize === '4x6'
                ? 'w-[100mm] min-h-[150mm]'
                : labelSize === 'A6'
                ? 'w-[105mm] min-h-[148mm]'
                : labelSize === 'A5'
                ? 'w-[148mm] min-h-[210mm]'
                : 'w-[210mm] min-h-[297mm]'
            }`}
          >
            {/* Courier Header Bar */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <div>
                <span className="text-xs font-mono uppercase text-neutral-500 block">CARRIER</span>
                <h2 className="text-base font-bold tracking-tight uppercase font-mono">{courierName}</h2>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs uppercase text-neutral-500 block">ROUTING</span>
                <span className="text-sm font-bold">{order.shippingAddress.pincode}</span>
              </div>
            </div>

            {/* Payment Badge Bar */}
            {/* Requirement: COD includes shipping line, full order total */}
            <div className="flex items-center justify-between border-2 border-black p-2 mb-3 bg-neutral-50 print:bg-transparent">
              <div className="font-mono">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">PAYMENT MODE</span>
                <span className="text-base font-extrabold uppercase">
                  {order.paymentStatus === 'COD' ? 'CASH ON DELIVERY (COD)' : 'PREPAID ORDER'}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] uppercase font-bold text-neutral-500 block">COLLECTIBLE AMOUNT</span>
                <span className="text-lg font-black tabular-nums">
                  {order.paymentStatus === 'COD' ? formatINR(order.grandTotal) : '₹0.00'}
                </span>
              </div>
            </div>

            {/* Barcode Area */}
            <div className="flex flex-col items-center justify-center p-3 border-b-2 border-black mb-3">
              <div className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
              <div className="text-xs font-mono font-bold tracking-widest mt-1">
                AWB: {awbNumber}
              </div>
            </div>

            {/* Recipient Address (SHIP TO) */}
            <div className="border-b-2 border-black pb-3 mb-3">
              <div className="text-[10px] uppercase font-bold text-neutral-500 font-mono mb-1">
                SHIP TO (CONSIGNEE):
              </div>
              <h3 className="text-base font-bold uppercase text-black">{order.customerName}</h3>
              <p className="text-sm text-neutral-800 leading-snug">{order.shippingAddress.addressLine}</p>
              <p className="text-sm text-neutral-800 font-semibold">
                {order.shippingAddress.city}, {order.shippingAddress.state} - PIN: {order.shippingAddress.pincode}
              </p>
              <div className="mt-2 text-sm font-mono font-bold text-black flex items-center gap-2">
                <span>TEL: {order.customerPhone}</span>
              </div>
            </div>

            {/* Battery Warning Banner (Mandatory if order has battery) */}
            {hasBatteryItem && (
              <div className="border-2 border-black p-2 mb-3 bg-neutral-100 print:bg-transparent flex items-start gap-2.5">
                <AlertTriangle className="w-6 h-6 text-black shrink-0 mt-0.5" />
                <div className="font-mono text-xs">
                  <div className="font-bold uppercase tracking-wider text-black">
                    ⚠ BATTERY HAZARD WARNING: {batteryTypes}
                  </div>
                  <p className="text-[10px] text-neutral-800 uppercase font-medium leading-tight">
                    Package contains chemical power cells. Handle with care. Do not drop, puncture or expose to excessive heat.
                  </p>
                </div>
              </div>
            )}

            {/* Order Items Summary */}
            <div className="border-b-2 border-black pb-2 mb-3 font-mono text-xs">
              <div className="text-[10px] uppercase font-bold text-neutral-500 mb-1">
                CONTENTS / ORDER {order.orderNo}:
              </div>
              <div className="space-y-0.5">
                {order.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[200px]">{it.qty}x {it.name}</span>
                    <span className="tabular-nums">SKU: {it.sku}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipper Return Address (RETURN TO) */}
            <div className="text-xs font-mono text-neutral-700">
              <div className="text-[9px] uppercase font-bold text-neutral-500">
                RETURN TO (IF UNDELIVERED):
              </div>
              <div className="font-bold text-black uppercase">{settings.businessName}</div>
              <div className="text-[11px] leading-tight">{settings.address}</div>
              <div className="text-[11px]">Contact: {settings.phone} · GSTIN: {settings.gstin}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

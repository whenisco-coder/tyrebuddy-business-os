/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Shell } from './components/layout/Shell';
import { DashboardView } from './components/dashboard/DashboardView';
import { OrdersView } from './components/orders/OrdersView';
import { InvoiceView } from './components/invoices/InvoiceView';
import { CourierLabelView } from './components/shipping/CourierLabelView';
import { ProductsView } from './components/products/ProductsView';
import { StockView } from './components/stock/StockView';
import { CreditLedgerView } from './components/ledger/CreditLedgerView';
import { CustomersView } from './components/customers/CustomersView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { TasksView } from './components/tasks/TasksView';
import { ReportsView } from './components/reports/ReportsView';
import { AuditLogView } from './components/audit/AuditLogView';
import { SettingsView } from './components/settings/SettingsView';
import { TallyImportView } from './components/tally/TallyImportView';
import { BarcodeScannerModal } from './components/scanner/BarcodeScannerModal';
import { Order } from './types';

const MainContent: React.FC = () => {
  const { orders } = useStore();
  const [currentModule, setCurrentModule] = useState<string>('dashboard');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<Order | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  const handleNavigate = (module: string) => {
    setCurrentModule(module);
    setSelectedOrderForInvoice(null);
    setSelectedOrderForLabel(null);
  };

  const handleViewInvoice = (order: Order) => {
    setSelectedOrderForInvoice(order);
    setCurrentModule('invoices');
  };

  const handleViewLabel = (order: Order) => {
    setSelectedOrderForLabel(order);
    setCurrentModule('shipping');
  };

  return (
    <Shell currentModule={currentModule} onNavigate={handleNavigate}>
      {/* 1. Dashboard View */}
      {currentModule === 'dashboard' && (
        <DashboardView
          onNavigate={handleNavigate}
          onOpenOrderModal={() => handleNavigate('orders')}
          onOpenScanner={() => setIsScannerOpen(true)}
        />
      )}

      {/* 2. Orders View (Priority #1) */}
      {currentModule === 'orders' && (
        <OrdersView
          onViewInvoice={handleViewInvoice}
          onViewLabel={handleViewLabel}
        />
      )}

      {/* 3. Invoices & Credit Notes View (Priority #2) */}
      {currentModule === 'invoices' && (
        selectedOrderForInvoice ? (
          <InvoiceView
            order={selectedOrderForInvoice}
            onBack={() => setSelectedOrderForInvoice(null)}
            onViewLabel={handleViewLabel}
          />
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <div>
                <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
                  Tally-Style Tax Invoices & Credit Notes
                </h1>
                <p className="text-xs text-neutral-500 font-mono">
                  Dense monochrome layout · HSN lines · Gujarat Intra-state (CGST+SGST) vs Inter-state (IGST)
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {orders.map(order => (
                <div
                  key={order.id}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-neutral-900 dark:text-neutral-100">
                      {order.invoiceNo || order.orderNo}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-sans">
                      {order.customerName} ({order.customerType}) · {order.orderDate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 tabular-nums">
                      {order.grandTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForInvoice(order)}
                      className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold hover:bg-neutral-800"
                    >
                      1. Open Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewLabel(order)}
                      className="px-2.5 py-1.5 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-100"
                    >
                      2. Label
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* 4. Courier Shipping Labels */}
      {currentModule === 'shipping' && (
        selectedOrderForLabel ? (
          <CourierLabelView
            order={selectedOrderForLabel}
            onBack={() => setSelectedOrderForLabel(null)}
            onViewInvoice={handleViewInvoice}
          />
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
                Courier Shipping Labels
              </h1>
              <p className="text-xs text-neutral-500 font-mono">
                Thermal 4×6, A6, A5, A4 · Full COD Amounts · Battery Hazard Warnings
              </p>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
              {orders.map(order => (
                <div
                  key={order.id}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-neutral-900 dark:text-neutral-100">
                      {order.orderNo} · {order.courierName || 'Pending Courier'}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-sans">
                      Ship to: {order.customerName} ({order.shippingAddress.city}, {order.shippingAddress.state})
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewInvoice(order)}
                      className="px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-bold hover:bg-neutral-100"
                    >
                      1. Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForLabel(order)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
                    >
                      2. Generate Label
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* 5. Products & Variants */}
      {currentModule === 'products' && <ProductsView onNavigate={handleNavigate} />}

      {/* 6. Stock & Batches */}
      {currentModule === 'stock' && <StockView />}

      {/* 7. Payments & Credit Ledger (Priority #4) */}
      {currentModule === 'credit' && <CreditLedgerView />}

      {/* 8. Customers */}
      {currentModule === 'customers' && <CustomersView onNavigate={handleNavigate} />}

      {/* 9. Purchases & Vendors */}
      {currentModule === 'purchases' && <PurchasesView />}

      {/* 9b. Expenses & Overhead */}
      {currentModule === 'expenses' && <ExpensesView />}

      {/* 10. Tasks */}
      {currentModule === 'tasks' && <TasksView />}

      {/* 11. Reports (Priority #5) */}
      {currentModule === 'reports' && <ReportsView />}

      {/* 12. Barcode & Scanner */}
      {currentModule === 'scanner' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-4 max-w-lg mx-auto">
          <h2 className="text-base font-bold uppercase font-mono">Hardware & Camera Barcode Scanner</h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Supports camera scanning, Code128 USB wedge scanners, and manual SKU lookups for picking and auditing.
          </p>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-6 py-2.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold text-xs"
          >
            Launch Barcode Scanner
          </button>
        </div>
      )}

      {/* 13. Audit Log */}
      {currentModule === 'audit' && <AuditLogView />}

      {/* 14. Settings */}
      {currentModule === 'settings' && <SettingsView onNavigate={handleNavigate} />}

      {/* 15. Tally Software Import & Sync */}
      {currentModule === 'tally' && <TallyImportView onNavigate={handleNavigate} />}

      {/* Barcode Scanner Modal Global Hook */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        mode="lookup"
      />
    </Shell>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainContent />
    </StoreProvider>
  );
}

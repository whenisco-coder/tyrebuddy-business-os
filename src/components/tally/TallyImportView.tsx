/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  parseTallyData,
  decodeTallyBuffer,
  getSampleTallyXml,
  generateTallyVouchersXml,
  TallyStockItem,
  TallyLedger,
  TallyParseResult,
} from '../../utils/tallyParser';
import { downloadFile } from '../../utils/export';
import { formatINR } from '../../utils/gst';
import { StockLocation } from '../../types';
import {
  Database,
  Upload,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  BookOpen,
  Boxes,
  Users,
  Building,
  ShieldCheck,
  Search,
  Sparkles,
  HelpCircle,
  Clock,
  Layers,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

interface TallyImportViewProps {
  onNavigate?: (module: string) => void;
}

export const TallyImportView: React.FC<TallyImportViewProps> = ({ onNavigate }) => {
  const {
    products,
    customers,
    suppliers,
    orders,
    settings,
    importTallyData,
    showToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'IMPORT' | 'GUIDE' | 'EXPORT_TALLY' | 'MAPPING'>('IMPORT');
  
  // Parser input state
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<TallyParseResult | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [previewSubTab, setPreviewSubTab] = useState<'STOCK' | 'DEBTORS' | 'CREDITORS'>('STOCK');

  // Import options
  const [optImportStock, setOptImportStock] = useState(true);
  const [optCreateOpeningBatches, setOptCreateOpeningBatches] = useState(true);
  const [optImportDebtors, setOptImportDebtors] = useState(true);
  const [optImportCreditors, setOptImportCreditors] = useState(true);
  const [optSkipDuplicates, setOptSkipDuplicates] = useState(true);
  const [optDefaultLocation, setOptDefaultLocation] = useState<StockLocation>('Own');
  const [optDefaultGst, setOptDefaultGst] = useState<number>(28);

  // Export to Tally state
  const [exportDateRange, setExportDateRange] = useState<'ALL' | 'TODAY' | 'MONTH'>('ALL');
  const [copiedXml, setCopiedXml] = useState(false);

  // Handle file drop / upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = decodeTallyBuffer(ev.target?.result as ArrayBuffer);
      setInputText(text);
      runParse(text);
    };
    // Read raw bytes: Tally exports are UTF-16, which readAsText() would mis-decode as UTF-8
    reader.readAsArrayBuffer(file);
  };

  const runParse = (text: string) => {
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const result = parseTallyData(text);
    setParseResult(result);
    if (result.stockItems.length > 0) {
      setPreviewSubTab('STOCK');
    } else if (result.summary.totalDebtors > 0) {
      setPreviewSubTab('DEBTORS');
    } else if (result.summary.totalCreditors > 0) {
      setPreviewSubTab('CREDITORS');
    }
  };

  const handleLoadSample = () => {
    const sample = getSampleTallyXml();
    setInputText(sample);
    setFileName('Sample-Tally-Tyre-Masters.xml');
    runParse(sample);
    showToast('Loaded sample Tally XML (Tyre & Battery Masters + Debtors)', 'info');
  };

  const handleExecuteImport = () => {
    if (!parseResult) return;

    const res = importTallyData(
      parseResult.stockItems,
      parseResult.ledgers,
      {
        importStock: optImportStock,
        importDebtors: optImportDebtors,
        importCreditors: optImportCreditors,
        createOpeningBatches: optCreateOpeningBatches,
        defaultLocation: optDefaultLocation,
        defaultGst: optDefaultGst,
        skipDuplicates: optSkipDuplicates,
      }
    );

    // If imported products, give option to view catalog
    if (res.importedProducts > 0 && onNavigate) {
      setTimeout(() => {
        onNavigate('products');
      }, 1600);
    }
  };

  // Filtered preview data
  const filteredStock = useMemo(() => {
    if (!parseResult) return [];
    const q = searchFilter.toLowerCase();
    return parseResult.stockItems.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.hsnCode.includes(q) ||
        item.parentGroup.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q)
    );
  }, [parseResult, searchFilter]);

  const filteredDebtors = useMemo(() => {
    if (!parseResult) return [];
    const q = searchFilter.toLowerCase();
    return parseResult.ledgers
      .filter(l => l.ledgerType === 'SUNDRY_DEBTOR')
      .filter(
        l =>
          l.name.toLowerCase().includes(q) ||
          (l.gstin && l.gstin.toLowerCase().includes(q)) ||
          l.phone.includes(q)
      );
  }, [parseResult, searchFilter]);

  const filteredCreditors = useMemo(() => {
    if (!parseResult) return [];
    const q = searchFilter.toLowerCase();
    return parseResult.ledgers
      .filter(l => l.ledgerType === 'SUNDRY_CREDITOR')
      .filter(
        l =>
          l.name.toLowerCase().includes(q) ||
          (l.gstin && l.gstin.toLowerCase().includes(q)) ||
          l.phone.includes(q)
      );
  }, [parseResult, searchFilter]);

  // Export to Tally calculation
  const exportOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    if (exportDateRange === 'TODAY') {
      return orders.filter(o => o.orderDate === today);
    }
    if (exportDateRange === 'MONTH') {
      return orders.filter(o => o.orderDate >= firstOfMonth);
    }
    return orders;
  }, [orders, exportDateRange]);

  const exportXmlContent = useMemo(() => {
    return generateTallyVouchersXml(exportOrders, {
      businessName: settings.businessName,
      gstin: settings.gstin,
    });
  }, [exportOrders, settings]);

  const handleDownloadTallyXml = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(`tyrebuddy-tally-vouchers-${dateStr}.xml`, exportXmlContent, 'application/xml');
    showToast(`Downloaded Tally XML with ${exportOrders.length} sales vouchers!`, 'success');
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(exportXmlContent);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
    showToast('Tally XML copied to clipboard!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Database className="w-5 h-5" />
            </span>
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight font-mono">
              Tally Software Migration & Two-Way Sync Center
            </h1>
          </div>
          <p className="text-xs text-neutral-500 font-mono mt-1">
            Native import for TallyPrime & Tally ERP 9 Masters · Stock Items, Sundry Debtors & Creditors · Two-way XML voucher sync
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-xs font-mono font-bold hover:bg-amber-100"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Try Sample Tally XML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GUIDE')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 text-xs font-mono font-bold hover:bg-neutral-200"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>How to Export from Tally</span>
          </button>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-mono font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('IMPORT')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'IMPORT'
              ? 'border-amber-500 text-neutral-900 dark:text-white bg-white dark:bg-neutral-900 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Upload className="w-4 h-4 text-amber-500" />
          <span>Import Tally Data (XML / CSV)</span>
          {parseResult && (
            <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 text-[10px] rounded">
              {parseResult.stockItems.length + parseResult.ledgers.length} items detected
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EXPORT_TALLY')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'EXPORT_TALLY'
              ? 'border-amber-500 text-neutral-900 dark:text-white bg-white dark:bg-neutral-900 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Download className="w-4 h-4 text-blue-500" />
          <span>Export Sales to Tally XML (Two-Way)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GUIDE')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === 'GUIDE'
              ? 'border-amber-500 text-neutral-900 dark:text-white bg-white dark:bg-neutral-900 font-bold'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-emerald-500" />
          <span>Tally Export Guide & Shortcuts</span>
        </button>
      </div>

      {/* Tab 1: IMPORT TALLY DATA */}
      {activeTab === 'IMPORT' && (
        <div className="space-y-6">
          {/* Upload / Paste Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File Dropzone Card */}
            <div className="lg:col-span-1 p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
              <h2 className="text-xs font-mono font-bold uppercase text-neutral-800 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800 pb-2 flex items-center justify-between">
                <span>1. Select Tally File</span>
                <span className="text-[10px] text-neutral-400 font-normal">.xml, .csv, .txt</span>
              </h2>

              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition text-center space-y-2">
                <FileCode className="w-8 h-8 text-amber-500" />
                <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  {fileName ? fileName : 'Click to Upload Tally XML or CSV'}
                </span>
                <span className="text-[11px] text-neutral-500 font-sans">
                  Exported from TallyPrime or Tally ERP 9
                </span>
                <input
                  type="file"
                  accept=".xml,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="text-[11px] text-neutral-500 space-y-1 font-mono">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Supports Tally XML (&lt;STOCKITEM&gt; &amp; &lt;LEDGER&gt;)</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Supports Tally Stock Summary CSV &amp; Excel exports</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Auto-detects Tyre Brands (MRF, Apollo, CEAT, etc.)</span>
                </div>
              </div>

              {/* Or button to load sample */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="w-full py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-mono font-bold flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Load Sample Indian Tyre Data
                </button>
              </div>
            </div>

            {/* Paste Code / Options Card */}
            <div className="lg:col-span-2 p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <h2 className="text-xs font-mono font-bold uppercase text-neutral-800 dark:text-neutral-200">
                  2. Paste Raw Content or Review Code
                </h2>
                {inputText && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('');
                      setFileName(null);
                      setParseResult(null);
                    }}
                    className="text-[11px] text-red-500 hover:underline font-mono"
                  >
                    Clear Text
                  </button>
                )}
              </div>

              <textarea
                value={inputText}
                onChange={e => {
                  setInputText(e.target.value);
                  runParse(e.target.value);
                }}
                placeholder="Or paste Tally XML or CSV content directly here..."
                rows={7}
                className="w-full p-2.5 bg-neutral-50 dark:bg-neutral-950 font-mono text-[11px] border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
              />

              {/* Migration Import Configuration Options */}
              <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 space-y-3 text-xs font-mono">
                <span className="text-[11px] font-bold uppercase tracking-wider block text-neutral-700 dark:text-neutral-300">
                  Migration Rules &amp; Defaults:
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optImportStock}
                      onChange={e => setOptImportStock(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Import Stock Items</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optCreateOpeningBatches}
                      onChange={e => setOptCreateOpeningBatches(e.target.checked)}
                      disabled={!optImportStock}
                      className="accent-amber-500"
                    />
                    <span>Create Opening FIFO Batches</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optImportDebtors}
                      onChange={e => setOptImportDebtors(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Import Sundry Debtors (Customers)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optImportCreditors}
                      onChange={e => setOptImportCreditors(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Import Sundry Creditors (Vendors)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optSkipDuplicates}
                      onChange={e => setOptSkipDuplicates(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Skip Existing Duplicates</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 text-[11px]">Warehouse:</span>
                    <select
                      value={optDefaultLocation}
                      onChange={e => setOptDefaultLocation(e.target.value as StockLocation)}
                      className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-xs font-mono"
                    >
                      <option value="Own">Own Godown</option>
                      <option value="Amazon FBA">Amazon FBA</option>
                      <option value="Damaged">Damaged</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parse Results Preview & Execution */}
          {parseResult && (
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5 animate-in fade-in">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[10px] uppercase text-neutral-500 block">Stock Items</span>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-amber-500" />
                    <span>{parseResult.stockItems.length} Items</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {parseResult.stockItems.reduce((s, i) => s + i.openingQty, 0)} Total Units
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[10px] uppercase text-neutral-500 block">Opening Inventory Value</span>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {formatINR(parseResult.stockItems.reduce((s, i) => s + i.openingValue, 0))}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    FIFO Landed Cost
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[10px] uppercase text-neutral-500 block">Sundry Debtors</span>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>{parseResult.summary.totalDebtors} Customers</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    B2B credit terms attached
                  </span>
                </div>

                <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700">
                  <span className="text-[10px] uppercase text-neutral-500 block">Sundry Creditors</span>
                  <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-purple-500" />
                    <span>{parseResult.summary.totalCreditors} Vendors</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Suppliers &amp; manufacturers
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-900 text-white shadow-xs">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="font-bold text-amber-400">
                    Ready to Migrate:
                  </span>
                  <span>
                    {(optImportStock ? parseResult.stockItems.length : 0)} Products ·{' '}
                    {(optImportDebtors ? parseResult.summary.totalDebtors : 0)} Customers ·{' '}
                    {(optImportCreditors ? parseResult.summary.totalCreditors : 0)} Suppliers
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs font-mono shadow-xs transition"
                >
                  <Database className="w-4 h-4" />
                  <span>Execute Migration into Tyrebuddy</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Warnings & Notices */}
              {parseResult.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-mono text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Auto-Normalization Notices ({parseResult.warnings.length}):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {parseResult.warnings.slice(0, 3).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                    {parseResult.warnings.length > 3 && (
                      <li>...and {parseResult.warnings.length - 3} more minor notices resolved automatically.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Sub-Tab Navigation for Preview Tables */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setPreviewSubTab('STOCK')}
                      className={`px-3 py-1 font-bold ${
                        previewSubTab === 'STOCK'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      Stock Items ({parseResult.stockItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSubTab('DEBTORS')}
                      className={`px-3 py-1 font-bold ${
                        previewSubTab === 'DEBTORS'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      Sundry Debtors ({parseResult.summary.totalDebtors})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSubTab('CREDITORS')}
                      className={`px-3 py-1 font-bold ${
                        previewSubTab === 'CREDITORS'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      Sundry Creditors ({parseResult.summary.totalCreditors})
                    </button>
                  </div>

                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search preview records..."
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Table: Stock Items */}
                {previewSubTab === 'STOCK' && (
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 max-h-80">
                    <table className="w-full text-left text-xs font-mono divide-y divide-neutral-200 dark:divide-neutral-800">
                      <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0 uppercase text-[10px] text-neutral-500">
                        <tr>
                          <th className="p-2.5">Item Name &amp; Brand</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">HSN Code</th>
                          <th className="p-2.5">GST Rate</th>
                          <th className="p-2.5 text-right">Opening Qty</th>
                          <th className="p-2.5 text-right">Cost Price</th>
                          <th className="p-2.5 text-right">Retail Price</th>
                          <th className="p-2.5 text-right">Opening Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                        {filteredStock.map((item, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <td className="p-2.5">
                              <span className="font-bold block text-neutral-900 dark:text-neutral-100">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                {item.brand} · SKU: {item.sku || 'Auto'}
                              </span>
                            </td>
                            <td className="p-2.5 text-neutral-600 dark:text-neutral-400">
                              {item.category}
                            </td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 font-bold">
                                {item.hsnCode}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                                {item.gstRate}%
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold text-neutral-900 dark:text-neutral-100">
                              {item.openingQty} {item.uom}
                            </td>
                            <td className="p-2.5 text-right tabular-nums">
                              {formatINR(item.costPrice)}
                            </td>
                            <td className="p-2.5 text-right tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                              {formatINR(item.retailPrice)}
                            </td>
                            <td className="p-2.5 text-right tabular-nums text-neutral-500">
                              {formatINR(item.openingValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table: Sundry Debtors (Customers) */}
                {previewSubTab === 'DEBTORS' && (
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 max-h-80">
                    <table className="w-full text-left text-xs font-mono divide-y divide-neutral-200 dark:divide-neutral-800">
                      <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0 uppercase text-[10px] text-neutral-500">
                        <tr>
                          <th className="p-2.5">Customer / Party Name</th>
                          <th className="p-2.5">GSTIN</th>
                          <th className="p-2.5">State &amp; City</th>
                          <th className="p-2.5">Phone / Mobile</th>
                          <th className="p-2.5 text-right">Credit Days</th>
                          <th className="p-2.5 text-right">Credit Limit</th>
                          <th className="p-2.5 text-right">Opening Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                        {filteredDebtors.map((ledger, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <td className="p-2.5">
                              <span className="font-bold block text-neutral-900 dark:text-neutral-100">
                                {ledger.name}
                              </span>
                              <span className="text-[10px] text-neutral-400">
                                Group: {ledger.parentGroup}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {ledger.gstin ? (
                                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                                  {ledger.gstin}
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-[10px]">Unregistered (B2C)</span>
                              )}
                            </td>
                            <td className="p-2.5 text-neutral-600 dark:text-neutral-400">
                              {ledger.stateName} ({ledger.pincode})
                            </td>
                            <td className="p-2.5 font-bold">
                              {ledger.phone}
                            </td>
                            <td className="p-2.5 text-right">
                              {ledger.creditPeriodDays} Days
                            </td>
                            <td className="p-2.5 text-right tabular-nums">
                              {ledger.creditLimit ? formatINR(ledger.creditLimit) : '₹2,00,000'}
                            </td>
                            <td className="p-2.5 text-right tabular-nums font-bold">
                              {formatINR(ledger.openingBalance)} {ledger.balanceType}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table: Sundry Creditors (Suppliers) */}
                {previewSubTab === 'CREDITORS' && (
                  <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 max-h-80">
                    <table className="w-full text-left text-xs font-mono divide-y divide-neutral-200 dark:divide-neutral-800">
                      <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0 uppercase text-[10px] text-neutral-500">
                        <tr>
                          <th className="p-2.5">Supplier Name</th>
                          <th className="p-2.5">GSTIN</th>
                          <th className="p-2.5">State</th>
                          <th className="p-2.5">Phone</th>
                          <th className="p-2.5 text-right">Credit Terms</th>
                          <th className="p-2.5 text-right">Opening Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                        {filteredCreditors.map((ledger, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <td className="p-2.5 font-bold text-neutral-900 dark:text-neutral-100">
                              {ledger.name}
                            </td>
                            <td className="p-2.5">
                              {ledger.gstin ? (
                                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                                  {ledger.gstin}
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-[10px]">Unregistered</span>
                              )}
                            </td>
                            <td className="p-2.5 text-neutral-600 dark:text-neutral-400">
                              {ledger.stateName}
                            </td>
                            <td className="p-2.5 font-bold">
                              {ledger.phone}
                            </td>
                            <td className="p-2.5 text-right">
                              {ledger.creditPeriodDays} Days
                            </td>
                            <td className="p-2.5 text-right tabular-nums font-bold">
                              {formatINR(ledger.openingBalance)} {ledger.balanceType}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: TWO-WAY SYNC (EXPORT SALES TO TALLY XML) */}
      {activeTab === 'EXPORT_TALLY' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <h2 className="text-base font-bold uppercase font-mono text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-500" />
                Export Tyrebuddy Sales Vouchers to Tally XML
              </h2>
              <p className="text-xs text-neutral-500 font-mono mt-1">
                Your accountant or CA can import these sales invoices directly into TallyPrime or Tally ERP 9 via &ldquo;Import Data &rarr; Vouchers&rdquo; with 0 re-typing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyXml}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-mono font-bold"
              >
                {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedXml ? 'Copied XML!' : 'Copy XML'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTallyXml}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono font-bold hover:bg-neutral-800"
              >
                <Download className="w-4 h-4 text-amber-500" />
                <span>Download Tally XML File</span>
              </button>
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 text-xs font-mono">
            <span className="font-bold uppercase text-[11px]">Select Sales Period:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExportDateRange('ALL')}
                className={`px-3 py-1 ${exportDateRange === 'ALL' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold' : 'bg-white dark:bg-neutral-800 border'}`}
              >
                All Orders ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setExportDateRange('TODAY')}
                className={`px-3 py-1 ${exportDateRange === 'TODAY' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold' : 'bg-white dark:bg-neutral-800 border'}`}
              >
                Today Only
              </button>
              <button
                type="button"
                onClick={() => setExportDateRange('MONTH')}
                className={`px-3 py-1 ${exportDateRange === 'MONTH' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold' : 'bg-white dark:bg-neutral-800 border'}`}
              >
                This Month
              </button>
            </div>
            <span className="text-neutral-500">
              {exportOrders.length} Invoices ready for Tally export ({formatINR(exportOrders.reduce((s, o) => s + o.grandTotal, 0))})
            </span>
          </div>

          {/* XML Preview Code Snippet */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-neutral-500 block uppercase font-bold">
              Generated Tally XML Preview (Standard &lt;ENVELOPE&gt;&lt;VOUCHER&gt; Schema):
            </span>
            <pre className="p-4 bg-neutral-950 text-neutral-200 font-mono text-[11px] rounded-none border border-neutral-800 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {exportXmlContent.slice(0, 3000)}
              {exportXmlContent.length > 3000 && '\n\n... [and more vouchers formatted]'}
            </pre>
          </div>

          {/* Steps for Accountant */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs font-mono text-blue-950 dark:text-blue-200 space-y-2">
            <strong className="block uppercase font-bold flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-600" />
              How your Accountant / CA imports this file into Tally:
            </strong>
            <ol className="list-decimal list-inside space-y-1 text-[11px]">
              <li>Open your company in <strong>TallyPrime</strong> or <strong>Tally.ERP 9</strong>.</li>
              <li>Go to <strong>Gateway of Tally &rarr; Import Data &rarr; Vouchers</strong>.</li>
              <li>Select or paste the downloaded <code className="bg-blue-100 dark:bg-blue-900 px-1">tyrebuddy-tally-vouchers-*.xml</code> file.</li>
              <li>Hit <strong>Enter</strong>. Tally automatically enters all sales vouchers with Customer debit, Sales credit, CGST, SGST, IGST output taxes, and inventory allocations!</li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 3: HOW TO EXPORT FROM TALLY GUIDE */}
      {activeTab === 'GUIDE' && (
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-6 text-xs font-mono">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <h2 className="text-base font-bold uppercase text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-500" />
              How to Export your Data from Tally (Step-by-Step Guide)
            </h2>
            <p className="text-neutral-500 mt-1">
              Follow these simple steps in your Tally software to get your Masters XML or Excel/CSV export in under 60 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Method A: TallyPrime XML Export */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
                <span className="font-bold uppercase text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-amber-500" />
                  Method 1: TallyPrime (Native XML Masters)
                </span>
                <span className="px-2 py-0.5 bg-amber-500 text-neutral-950 font-bold text-[10px]">
                  Recommended
                </span>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                <li>
                  From <strong>Gateway of Tally</strong>, press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">Alt + E</kbd> (Export menu).
                </li>
                <li>
                  Select <strong>Masters</strong> (or press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">M</kbd>).
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">C</kbd> (Configure) and set:
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5 text-neutral-600 dark:text-neutral-400">
                    <li>Type of Master: <strong>All Masters</strong> (or <strong>Stock Items</strong> / <strong>Ledgers</strong>)</li>
                    <li>File Format: <strong>XML (Data Interchange)</strong></li>
                    <li>Export Location: Select your preferred folder (e.g. Desktop or Downloads)</li>
                  </ul>
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">Esc</kbd> and then press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">E</kbd> (Send / Export).
                </li>
                <li>
                  Drag and drop the resulting XML file into Tyrebuddy’s <strong>Import Tally Data</strong> tab!
                </li>
              </ol>
            </div>

            {/* Method B: Tally ERP 9 XML Export */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
                <span className="font-bold uppercase text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-emerald-500" />
                  Method 2: Tally.ERP 9 (List of Accounts XML)
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                  Fastest
                </span>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                <li>
                  Go to <strong>Gateway of Tally &rarr; Display &rarr; List of Accounts</strong>.
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">Alt + E</kbd> to open the Export dialog.
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">Backspace</kbd> to edit the Format field.
                </li>
                <li>
                  Choose <strong>XML (Data Interchange)</strong>.
                </li>
                <li>
                  Choose <strong>All Masters</strong> (Stock items + Sundry Debtors + Creditors).
                </li>
                <li>
                  Press <strong>Enter</strong> to accept and export.
                </li>
                <li>
                  Upload the file into Tyrebuddy to review and import immediately!
                </li>
              </ol>
            </div>

            {/* Method C: Stock Summary to Excel / CSV */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
                <span className="font-bold uppercase text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                  Method 3: Stock Summary (CSV / Excel)
                </span>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                <li>
                  From <strong>Gateway of Tally &rarr; Stock Summary</strong>.
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">F12</kbd> (Configure) and enable <strong>Show Opening Balance</strong>, <strong>Show Goods Inwards</strong>, <strong>Show Goods Outwards</strong>, and <strong>Show Closing Balance</strong>.
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">Alt + E</kbd> &rarr; Format: <strong>CSV (Comma Delimited)</strong> or <strong>Excel Spreadsheet</strong>.
                </li>
                <li>
                  Export and upload to Tyrebuddy.
                </li>
              </ol>
            </div>

            {/* Method D: Customer Directory / Sundry Debtors */}
            <div className="p-5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 pb-2">
                <span className="font-bold uppercase text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-500" />
                  Method 4: Customer Directory (Sundry Debtors)
                </span>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-[11px] text-neutral-700 dark:text-neutral-300">
                <li>
                  Go to <strong>Gateway of Tally &rarr; Display More Reports &rarr; Account Books &rarr; Group Summary &rarr; Sundry Debtors</strong>.
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">F12</kbd> &rarr; Show Contact Details &amp; GSTIN = Yes.
                </li>
                <li>
                  Press <kbd className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 border">Alt + E</kbd> &rarr; Export to CSV or XML.
                </li>
                <li>
                  Upload to Tyrebuddy to automatically populate your customer directory with B2B GSTINs and credit terms.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Product, ProductType, ProductVariant, ComboChild } from '../../types';
import { formatINR } from '../../utils/gst';
import { generateCode128Svg, generateQrDataUrl } from '../../utils/barcode';
import { parseCsvToObjects } from '../../utils/export';
import {
  Tag,
  Plus,
  Search,
  Printer,
  Upload,
  Layers,
  Edit,
  Trash2,
  AlertTriangle,
  QrCode,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  X,
  Copy,
  Archive,
  RotateCcw,
  Sliders,
  DollarSign,
  TrendingUp,
  Image as ImageIcon,
  History,
  Check,
  FolderTree,
  Eye,
  ExternalLink,
  Database,
} from 'lucide-react';

interface ProductsViewProps {
  onNavigate?: (module: string) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ onNavigate }) => {
  const {
    products,
    categories,
    getStockQty,
    addProduct,
    updateProduct,
    deleteProduct,
    cloneProduct,
    inlineUpdateProduct,
    bulkUpdateProducts,
    bulkPriceUpdate,
    archiveProduct,
    checkProductDuplicate,
    addCategory,
    updateCategory,
    deleteCategory,
    importProductsCsvAdvanced,
    importCustomersCsv,
    importOpeningStockCsv,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | ProductType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [archiveFilter, setArchiveFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');

  // Multi-Selection for Bulk Actions
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null);

  // Label Printing Modal
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [labelVariant, setLabelVariant] = useState<ProductVariant | null>(null);
  const [labelSheetLayout, setLabelSheetLayout] = useState<'30-up' | '65-up'>('30-up');

  // CSV Import Wizard Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvImportTab, setCsvImportTab] = useState<'PRODUCTS' | 'CUSTOMERS' | 'OPENING_STOCK'>('PRODUCTS');
  const [csvText, setCsvText] = useState('');
  const [skipErrors, setSkipErrors] = useState(true);
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[] | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null);

  // Inline Edit State
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: 'retailPrice' | 'lowStockThreshold' | 'costPrice'; value: string } | null>(null);

  // Product Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ProductType>('Single');
  const [formCategory, setFormCategory] = useState(categories[0]?.name || 'Passenger Car Tyres');
  const [formBrand, setFormBrand] = useState('MRF');
  const [formHsn, setFormHsn] = useState('40111010');
  const [formGst, setFormGst] = useState<number>(28);
  const [formCost, setFormCost] = useState<number>(3500);
  const [formMrp, setFormMrp] = useState<number>(4900);
  const [formRetail, setFormRetail] = useState<number>(4400);
  const [formWarranty, setFormWarranty] = useState<number>(36);
  const [formThreshold, setFormThreshold] = useState<number>(10);
  const [formHasBattery, setFormHasBattery] = useState(false);
  const [formBatteryType, setFormBatteryType] = useState('Lead-Acid');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formTags, setFormTags] = useState<string[]>([]);

  // Variants in Form
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([]);
  const [newVarTitle, setNewVarTitle] = useState('');
  const [newVarSku, setNewVarSku] = useState('');
  const [newVarBarcode, setNewVarBarcode] = useState('');
  const [newVarFnsku, setNewVarFnsku] = useState('');
  const [newVarAttrs, setNewVarAttrs] = useState('{"Size": "16 inch", "Pattern": "Tubeless"}');
  const [newVarDelta, setNewVarDelta] = useState<number>(0);

  // Combo Children in Form
  const [comboChildren, setComboChildren] = useState<ComboChild[]>([]);
  const [comboChildProdId, setComboChildProdId] = useState('');
  const [comboChildQty, setComboChildQty] = useState<number>(1);

  // Category Manager Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Bulk Edit Form State
  const [bulkGst, setBulkGst] = useState<string>('');
  const [bulkThreshold, setBulkThreshold] = useState<string>('');
  const [bulkPriceChangePercent, setBulkPriceChangePercent] = useState<number>(5);
  const [bulkPriceTarget, setBulkPriceTarget] = useState<'retailPrice' | 'mrp' | 'costPrice'>('retailPrice');
  const [bulkPriceCategory, setBulkPriceCategory] = useState<string>('');

  // Duplicate Check during creation
  const duplicateWarning = useMemo(() => {
    if (!formName.trim() || !formHsn.trim()) return null;
    return checkProductDuplicate(formName, formHsn, editingProductId || undefined);
  }, [formName, formHsn, editingProductId, checkProductDuplicate]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Archive filter
      if (archiveFilter === 'ACTIVE' && p.isArchived) return false;
      if (archiveFilter === 'ARCHIVED' && !p.isArchived) return false;

      // Type filter
      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;

      // Tag filter
      if (tagFilter !== 'ALL' && (!p.tags || !p.tags.includes(tagFilter))) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      const nameMatch = p.name.toLowerCase().includes(term);
      const skuMatch = p.sku?.toLowerCase().includes(term);
      const barcodeMatch = p.barcode?.toLowerCase().includes(term);
      const hsnMatch = p.hsn.includes(term);
      const brandMatch = p.brand.toLowerCase().includes(term);

      // Search in variants
      const variantMatch = p.variants?.some(
        v =>
          v.title.toLowerCase().includes(term) ||
          v.sku.toLowerCase().includes(term) ||
          v.barcode.toLowerCase().includes(term) ||
          Object.values(v.attributes).some(attr => attr.toLowerCase().includes(term))
      );

      return nameMatch || skuMatch || barcodeMatch || hsnMatch || brandMatch || variantMatch;
    });
  }, [products, archiveFilter, typeFilter, categoryFilter, tagFilter, searchTerm]);

  // Handle open modal for new product
  const handleOpenNewProduct = () => {
    setEditingProductId(null);
    setFormName('');
    setFormType('Single');
    setFormCategory(categories[0]?.name || 'Passenger Car Tyres');
    setFormBrand('MRF');
    setFormHsn('40111010');
    setFormGst(28);
    setFormCost(3000);
    setFormMrp(4500);
    setFormRetail(4000);
    setFormWarranty(36);
    setFormThreshold(10);
    setFormHasBattery(false);
    setFormBatteryType('Lead-Acid');
    setFormSku('TYRE-' + Date.now().toString().slice(-4));
    setFormBarcode('TYRE' + Date.now().toString().slice(-6));
    setFormImages([]);
    setFormTags(['New Arrival']);
    setFormVariants([]);
    setComboChildren([]);
    setIsProductModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setFormName(prod.name);
    setFormType(prod.type);
    setFormCategory(prod.category);
    setFormBrand(prod.brand);
    setFormHsn(prod.hsn);
    setFormGst(prod.gstPercent);
    setFormCost(prod.costPrice);
    setFormMrp(prod.mrp);
    setFormRetail(prod.retailPrice);
    setFormWarranty(prod.warrantyMonths);
    setFormThreshold(prod.lowStockThreshold);
    setFormHasBattery(prod.hasBattery);
    setFormBatteryType(prod.batteryType || 'Lead-Acid');
    setFormSku(prod.sku || '');
    setFormBarcode(prod.barcode || '');
    setFormImages(prod.images || []);
    setFormTags(prod.tags || []);
    setFormVariants(prod.variants || []);
    setComboChildren(prod.comboChildren || []);
    setIsProductModalOpen(true);
  };

  // Handle multiple product image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          if (ev.target?.result) {
            setFormImages(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Save product (create or update)
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formHsn.trim()) return;

    if (editingProductId) {
      updateProduct(editingProductId, {
        name: formName,
        type: formType,
        category: formCategory,
        brand: formBrand,
        hsn: formHsn,
        gstPercent: formGst,
        costPrice: formCost,
        mrp: formMrp,
        retailPrice: formRetail,
        warrantyMonths: formWarranty,
        lowStockThreshold: formThreshold,
        hasBattery: formHasBattery,
        batteryType: formHasBattery ? formBatteryType : undefined,
        sku: formSku || undefined,
        barcode: formBarcode || undefined,
        images: formImages,
        tags: formTags,
        variants: formType === 'Variant' ? formVariants : undefined,
        comboChildren: formType === 'Combo' ? comboChildren : undefined,
      });
    } else {
      addProduct({
        name: formName,
        type: formType,
        category: formCategory,
        brand: formBrand,
        hsn: formHsn,
        gstPercent: formGst,
        costPrice: formCost,
        mrp: formMrp,
        retailPrice: formRetail,
        warrantyMonths: formWarranty,
        lowStockThreshold: formThreshold,
        hasBattery: formHasBattery,
        batteryType: formHasBattery ? formBatteryType : undefined,
        sku: formSku || undefined,
        barcode: formBarcode || undefined,
        images: formImages,
        tags: formTags,
        variants: formType === 'Variant' ? formVariants : undefined,
        comboChildren: formType === 'Combo' ? comboChildren : undefined,
      });
    }

    setIsProductModalOpen(false);
  };

  // Inline edit save
  const handleSaveInlineEdit = () => {
    if (!inlineEditing) return;
    const num = parseFloat(inlineEditing.value);
    if (!isNaN(num)) {
      inlineUpdateProduct(inlineEditing.id, inlineEditing.field, num);
    }
    setInlineEditing(null);
  };

  // Selection toggles
  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Bulk Edit Submission
  const handleExecuteBulkEdit = () => {
    const updates: Partial<Product> = {};
    if (bulkGst) updates.gstPercent = parseFloat(bulkGst);
    if (bulkThreshold) updates.lowStockThreshold = parseInt(bulkThreshold, 10);

    if (Object.keys(updates).length > 0) {
      bulkUpdateProducts(selectedProductIds, updates);
    }
    setIsBulkEditModalOpen(false);
    setSelectedProductIds([]);
  };

  // Bulk Price % Change
  const handleExecuteBulkPrice = () => {
    bulkPriceUpdate(bulkPriceCategory, bulkPriceChangePercent, bulkPriceTarget);
    setIsBulkPriceModalOpen(false);
  };

  // CSV Dry Run Parser
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target?.result as string;
        setCsvText(text);
        try {
          const rows = parseCsvToObjects(text);
          setCsvPreviewRows(rows.slice(0, 10)); // preview first 10 rows
          setCsvErrors([]);
          setCsvImportSummary(`Detected ${rows.length} rows in CSV.`);
        } catch (err: any) {
          setCsvErrors([`Failed to parse CSV file: ${err.message}`]);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCommitCsvImport = () => {
    if (!csvText.trim()) return;
    const rows = parseCsvToObjects(csvText);

    if (csvImportTab === 'PRODUCTS') {
      const res = importProductsCsvAdvanced(rows, { skipErrors });
      setCsvImportSummary(`Imported ${res.imported} products. Skipped: ${res.skipped}. Errors: ${res.errors.length}`);
      setCsvErrors(res.errors);
      if (res.imported > 0) {
        setTimeout(() => setIsCsvModalOpen(false), 1500);
      }
    } else if (csvImportTab === 'CUSTOMERS') {
      const res = importCustomersCsv(rows, { skipErrors });
      setCsvImportSummary(`Imported ${res.imported} customers. Skipped: ${res.skipped}. Errors: ${res.errors.length}`);
      setCsvErrors(res.errors);
      if (res.imported > 0) {
        setTimeout(() => setIsCsvModalOpen(false), 1500);
      }
    } else if (csvImportTab === 'OPENING_STOCK') {
      const res = importOpeningStockCsv(rows);
      setCsvImportSummary(`Imported ${res.imported} stock batches. Errors: ${res.errors.length}`);
      setCsvErrors(res.errors);
      if (res.imported > 0) {
        setTimeout(() => setIsCsvModalOpen(false), 1500);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-500" />
            Product & Inventory Catalog
          </h1>
          <p className="text-xs text-neutral-500">
            Manage singles, variants, slab-wise combos, tags, and barcode sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <FolderTree className="w-3.5 h-3.5" />
            Categories ({categories.length})
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('tally')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              Import from Tally (XML/CSV)
            </button>
          )}

          <button
            onClick={() => {
              setCsvText('');
              setCsvPreviewRows(null);
              setCsvErrors([]);
              setCsvImportSummary(null);
              setIsCsvModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Upload className="w-3.5 h-3.5" />
            CSV Import Wizard
          </button>

          <button
            onClick={() => setIsBulkPriceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            Bulk % Price Update
          </button>

          <button
            onClick={handleOpenNewProduct}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when products are selected) */}
      {selectedProductIds.length > 0 && (
        <div className="p-3 bg-neutral-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold bg-amber-500 text-black px-2 py-0.5 rounded">
              {selectedProductIds.length} Selected
            </span>
            <span className="text-neutral-300">Apply actions to selected products</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkEditModalOpen(true)}
              className="px-2.5 py-1 bg-white text-black text-xs font-semibold hover:bg-neutral-200"
            >
              Bulk Edit Fields
            </button>

            <button
              onClick={() => {
                selectedProductIds.forEach(id => archiveProduct(id, true));
                setSelectedProductIds([]);
              }}
              className="px-2.5 py-1 bg-neutral-800 text-xs font-semibold hover:bg-neutral-700"
            >
              Archive Selected
            </button>

            <button
              onClick={() => setSelectedProductIds([])}
              className="px-2 py-1 text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, HSN, attribute..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
          >
            <option value="ALL">All Types</option>
            <option value="Single">Single</option>
            <option value="Variant">Variant</option>
            <option value="Combo">Combo</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
          >
            <option value="ALL">All Tags</option>
            <option value="Bestseller">Bestseller</option>
            <option value="New Arrival">New Arrival</option>
            <option value="Clearance">Clearance</option>
            <option value="Discontinued">Discontinued</option>
          </select>

          {/* Archive Filter */}
          <select
            value={archiveFilter}
            onChange={e => setArchiveFilter(e.target.value as any)}
            className="px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
          >
            <option value="ACTIVE">Active Catalog</option>
            <option value="ARCHIVED">Archived Items</option>
            <option value="ALL">Everything (Inc. Archived)</option>
          </select>
        </div>

        <span className="text-xs font-mono text-neutral-500">
          Showing {filteredProducts.length} of {products.length} products
        </span>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
              <th className="p-3 w-8 text-center">
                <input
                  type="checkbox"
                  checked={
                    filteredProducts.length > 0 &&
                    selectedProductIds.length === filteredProducts.length
                  }
                  onChange={handleToggleSelectAll}
                  className="accent-black"
                />
              </th>
              <th className="p-3 w-12 text-center">Image</th>
              <th className="p-3">Product Name & Tags</th>
              <th className="p-3">Type</th>
              <th className="p-3">HSN / GST</th>
              <th className="p-3 text-right">Cost (₹)</th>
              <th className="p-3 text-right">MRP (₹)</th>
              <th className="p-3 text-right">Selling (₹)</th>
              <th className="p-3 text-center">Own Stock</th>
              <th className="p-3 text-center">FBA</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
            {filteredProducts.map(prod => {
              const ownStock = getStockQty(prod.id, undefined, 'Own');
              const fbaStock = getStockQty(prod.id, undefined, 'Amazon FBA');
              const isSelected = selectedProductIds.includes(prod.id);
              const isLowStock = ownStock <= prod.lowStockThreshold;

              return (
                <tr
                  key={prod.id}
                  className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
                    isSelected ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                  } ${prod.isArchived ? 'opacity-60 bg-neutral-100 dark:bg-neutral-900' : ''}`}
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectProduct(prod.id)}
                      className="accent-black"
                    />
                  </td>

                  {/* Thumbnail */}
                  <td className="p-3 text-center">
                    {prod.images && prod.images.length > 0 ? (
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="w-8 h-8 object-cover border border-neutral-200 dark:border-neutral-700 mx-auto"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center mx-auto text-[10px] text-neutral-400">
                        No Img
                      </div>
                    )}
                  </td>

                  {/* Product Details */}
                  <td className="p-3">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <span>{prod.name}</span>
                      {prod.hasBattery && (
                        <span className="text-[10px] font-mono px-1 py-0.5 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300">
                          ⚡ Battery
                        </span>
                      )}
                      {prod.isArchived && (
                        <span className="text-[10px] font-mono px-1 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-600">
                          Archived
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-2 mt-0.5">
                      <span>{prod.brand}</span>
                      <span>·</span>
                      <span>{prod.category}</span>
                      {prod.sku && (
                        <>
                          <span>·</span>
                          <span className="text-neutral-700 dark:text-neutral-300">SKU: {prod.sku}</span>
                        </>
                      )}
                    </div>

                    {/* Tag Badges */}
                    {prod.tags && prod.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {prod.tags.map(t => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="p-3 font-mono text-xs">
                    <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-[11px]">
                      {prod.type}
                    </span>
                    {prod.type === 'Variant' && (
                      <span className="block text-[10px] text-neutral-500 mt-1">
                        {prod.variants?.length || 0} variants
                      </span>
                    )}
                    {prod.type === 'Combo' && (
                      <span className="block text-[10px] text-neutral-500 mt-1">
                        {prod.comboChildren?.length || 0} items
                      </span>
                    )}
                  </td>

                  <td className="p-3 font-mono text-xs">
                    <div>{prod.hsn}</div>
                    <div className="text-[11px] text-neutral-500">{prod.gstPercent}% GST</div>
                  </td>

                  {/* Cost Price */}
                  <td className="p-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                    {formatINR(prod.costPrice)}
                  </td>

                  {/* MRP */}
                  <td className="p-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                    {formatINR(prod.mrp)}
                  </td>

                  {/* Selling Price with Inline Edit */}
                  <td className="p-3 text-right font-mono font-bold">
                    {inlineEditing?.id === prod.id && inlineEditing.field === 'retailPrice' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={inlineEditing.value}
                          onChange={e =>
                            setInlineEditing({ ...inlineEditing, value: e.target.value })
                          }
                          onKeyDown={e => e.key === 'Enter' && handleSaveInlineEdit()}
                          className="w-20 px-1 py-0.5 text-right font-mono border border-black dark:border-white bg-white dark:bg-black text-xs"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveInlineEdit}
                          className="p-1 bg-black text-white dark:bg-white dark:text-black text-[10px]"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() =>
                          setInlineEditing({
                            id: prod.id,
                            field: 'retailPrice',
                            value: prod.retailPrice.toString(),
                          })
                        }
                        className="cursor-pointer group flex items-center justify-end gap-1 hover:text-blue-600"
                        title="Click to inline edit price"
                      >
                        <span>{formatINR(prod.retailPrice)}</span>
                        <Edit className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-neutral-400" />
                      </div>
                    )}
                  </td>

                  {/* Own Godown Stock */}
                  <td className="p-3 text-center font-mono">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-xs ${
                        isLowStock
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                      }`}
                    >
                      {ownStock}
                    </span>
                    {isLowStock && (
                      <span className="block text-[9px] text-red-600 mt-0.5">
                        Low (&le;{prod.lowStockThreshold})
                      </span>
                    )}
                  </td>

                  {/* Amazon FBA Stock */}
                  <td className="p-3 text-center font-mono text-neutral-600 dark:text-neutral-400">
                    {fbaStock}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Price History Button */}
                      <button
                        onClick={() => setPriceHistoryProduct(prod)}
                        className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                        title="Price Change History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>

                      {/* Barcode / QR Print */}
                      <button
                        onClick={() => {
                          setLabelProduct(prod);
                          setLabelVariant(null);
                          setIsLabelModalOpen(true);
                        }}
                        className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                        title="Print Barcode Labels"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {/* Clone */}
                      <button
                        onClick={() => cloneProduct(prod.id)}
                        className="p-1 text-neutral-500 hover:text-blue-600"
                        title="Clone / Duplicate Product"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditProduct(prod)}
                        className="p-1 text-neutral-500 hover:text-black dark:hover:text-white"
                        title="Edit Product Details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Archive / Unarchive */}
                      <button
                        onClick={() => archiveProduct(prod.id, !prod.isArchived)}
                        className="p-1 text-neutral-500 hover:text-amber-600"
                        title={prod.isArchived ? 'Restore Product' : 'Archive Product'}
                      >
                        {prod.isArchived ? (
                          <RotateCcw className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Archive className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteProduct(prod.id)}
                        className="p-1 text-neutral-400 hover:text-red-600"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-neutral-400 italic">
                  No products found matching current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Product Create / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2 border-neutral-200 dark:border-neutral-800">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-500" />
                {editingProductId ? 'Edit Product Details' : 'Add New Product'}
              </h2>
              <button onClick={() => setIsProductModalOpen(false)} className="text-neutral-500 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Duplicate Detection Warning Banner */}
            {duplicateWarning && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Potential Duplicate Product Detected:</strong>
                  <p className="mt-0.5">
                    A product named "{duplicateWarning.name}" with HSN {duplicateWarning.hsn} already exists in your catalog (SKU: {duplicateWarning.sku || 'N/A'}).
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-neutral-500 mb-1 font-semibold">Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MRF ZVTV 185/65 R15 Tubeless Tyre"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Product Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as ProductType)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value="Single">Single Product</option>
                    <option value="Variant">Variant Product (Sizes/Patterns)</option>
                    <option value="Combo">Combo Product (Slab-wise GST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Category</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Brand / Manufacturer</label>
                  <input
                    type="text"
                    placeholder="e.g. MRF, Apollo, Exide"
                    value={formBrand}
                    onChange={e => setFormBrand(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">HSN Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 40111010"
                    value={formHsn}
                    onChange={e => setFormHsn(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">GST Rate (%) *</label>
                  <select
                    value={formGst}
                    onChange={e => setFormGst(parseFloat(e.target.value))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                  >
                    <option value={28}>28% (Automotive Tyres, Batteries)</option>
                    <option value={18}>18% (Tubes, Pressure Gauges, Spares)</option>
                    <option value={12}>12% (Standard Spares)</option>
                    <option value={5}>5% (Concessional)</option>
                    <option value={0}>0% (Exempt)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Warranty (Months)</label>
                  <input
                    type="number"
                    value={formWarranty}
                    onChange={e => setFormWarranty(parseInt(e.target.value, 10))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Cost Price (₹)</label>
                  <input
                    type="number"
                    value={formCost}
                    onChange={e => setFormCost(parseFloat(e.target.value))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">MRP (₹)</label>
                  <input
                    type="number"
                    value={formMrp}
                    onChange={e => setFormMrp(parseFloat(e.target.value))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Selling / Retail (₹) *</label>
                  <input
                    type="number"
                    required
                    value={formRetail}
                    onChange={e => setFormRetail(parseFloat(e.target.value))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {/* SKU & Barcode & Low Stock Threshold */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">SKU Code</label>
                  <input
                    type="text"
                    placeholder="e.g. MRF-ZVTV-185"
                    value={formSku}
                    onChange={e => setFormSku(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Barcode (Code128)</label>
                  <input
                    type="text"
                    placeholder="e.g. MRF1856515"
                    value={formBarcode}
                    onChange={e => setFormBarcode(e.target.value)}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Low-Stock Alert Level</label>
                  <input
                    type="number"
                    value={formThreshold}
                    onChange={e => setFormThreshold(parseInt(e.target.value, 10))}
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                  />
                </div>
              </div>

              {/* Product Tags & Battery Flag */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <label className="block text-neutral-500 mb-1 font-semibold">Catalog Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {['Bestseller', 'New Arrival', 'Clearance', 'Discontinued'].map(tag => (
                      <label key={tag} className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formTags.includes(tag)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormTags([...formTags, tag]);
                            } else {
                              setFormTags(formTags.filter(t => t !== tag));
                            }
                          }}
                          className="accent-black"
                        />
                        <span>{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold mb-1">
                    <input
                      type="checkbox"
                      checked={formHasBattery}
                      onChange={e => setFormHasBattery(e.target.checked)}
                      className="accent-black"
                    />
                    <span>Contains Battery (Hazmat Warning)</span>
                  </label>
                  {formHasBattery && (
                    <input
                      type="text"
                      placeholder="e.g. Lead-Acid Sealed / Lithium-Ion"
                      value={formBatteryType}
                      onChange={e => setFormBatteryType(e.target.value)}
                      className="w-full p-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-xs"
                    />
                  )}
                </div>
              </div>

              {/* Product Images Upload */}
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">
                  Product Images (First image displays on invoice & thumbnails)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 border border-dashed border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-semibold">
                    <ImageIcon className="w-4 h-4 text-neutral-500" />
                    <span>Upload Image(s)</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                  {formImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img}
                        alt={`Preview ${i}`}
                        className="w-12 h-12 object-cover border border-neutral-300 dark:border-neutral-700"
                      />
                      <button
                        type="button"
                        onClick={() => setFormImages(formImages.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 text-[9px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Bulk Edit ({selectedProductIds.length} Products)
              </h2>
              <button onClick={() => setIsBulkEditModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Leave fields empty if you don't want to change them.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Change GST Rate (%)</label>
                <select
                  value={bulkGst}
                  onChange={e => setBulkGst(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  <option value="">(No Change)</option>
                  <option value="28">28%</option>
                  <option value="18">18%</option>
                  <option value="12">12%</option>
                  <option value="5">5%</option>
                  <option value="0">0%</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">
                  Change Low-Stock Threshold
                </label>
                <input
                  type="number"
                  placeholder="e.g. 15"
                  value={bulkThreshold}
                  onChange={e => setBulkThreshold(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="px-3 py-1.5 border text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBulkEdit}
                  className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
                >
                  Apply to {selectedProductIds.length} Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk % Price Update Modal */}
      {isBulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Bulk Price % Update Across Category
              </h2>
              <button onClick={() => setIsBulkPriceModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Target Category</label>
                <select
                  value={bulkPriceCategory}
                  onChange={e => setBulkPriceCategory(e.target.value)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">Price Field to Adjust</label>
                <select
                  value={bulkPriceTarget}
                  onChange={e => setBulkPriceTarget(e.target.value as any)}
                  className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
                >
                  <option value="retailPrice">Selling / Retail Price</option>
                  <option value="mrp">MRP</option>
                  <option value="costPrice">Cost Price</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-semibold">
                  Percentage Change (+ for increase, - for discount)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    value={bulkPriceChangePercent}
                    onChange={e => setBulkPriceChangePercent(parseFloat(e.target.value))}
                    className="w-28 p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono font-bold"
                  />
                  <span className="font-mono font-bold">%</span>
                  <span className="text-neutral-500">
                    (e.g. +5% for inflation, -10% for festive sale)
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setIsBulkPriceModalOpen(false)} className="px-3 py-1.5 border text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBulkPrice}
                  className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs"
                >
                  Apply Price Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-amber-500" />
                Category Management
              </h2>
              <button onClick={() => setIsCategoryModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category List */}
            <div className="space-y-2">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="p-3 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/40"
                >
                  <div>
                    <span className="font-bold text-xs block">{cat.name}</span>
                    <span className="text-[11px] text-neutral-500">{cat.description || 'No description'}</span>
                  </div>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="p-1 text-neutral-400 hover:text-red-600"
                    title="Delete Category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Category Form */}
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 space-y-2 text-xs">
              <span className="font-bold block">Add New Category:</span>
              <input
                type="text"
                placeholder="Category Name (e.g. Off-Road SUV Tyres)"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-semibold"
              />
              <input
                type="text"
                placeholder="Description"
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black"
              />
              <button
                type="button"
                onClick={() => {
                  if (newCatName.trim()) {
                    addCategory(newCatName, newCatDesc);
                    setNewCatName('');
                    setNewCatDesc('');
                  }
                }}
                className="px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {priceHistoryProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                Price History: {priceHistoryProduct.name}
              </h2>
              <button onClick={() => setPriceHistoryProduct(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto text-xs font-mono">
              {priceHistoryProduct.priceHistory && priceHistoryProduct.priceHistory.length > 0 ? (
                priceHistoryProduct.priceHistory.map((ph, idx) => (
                  <div
                    key={idx}
                    className="p-2 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold">{ph.date}</span>
                      <span className="block text-[11px] text-neutral-500">{ph.reason || 'Price change'}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{formatINR(ph.retailPrice)}</span>
                      <span className="block text-[10px] text-neutral-400">
                        Cost: {formatINR(ph.costPrice)} · MRP: {formatINR(ph.mrp)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-neutral-400 italic text-center py-4">No price adjustments recorded yet.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setPriceHistoryProduct(null)}
                className="px-3 py-1.5 border text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Wizard Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                CSV Import Wizard with Dry-Run Validation
              </h2>
              <button onClick={() => setIsCsvModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Wizard Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold">
              <button
                onClick={() => {
                  setCsvImportTab('PRODUCTS');
                  setCsvPreviewRows(null);
                }}
                className={`px-4 py-2 border-b-2 ${
                  csvImportTab === 'PRODUCTS'
                    ? 'border-black dark:border-white font-bold'
                    : 'border-transparent text-neutral-500'
                }`}
              >
                1. Import Products
              </button>
              <button
                onClick={() => {
                  setCsvImportTab('CUSTOMERS');
                  setCsvPreviewRows(null);
                }}
                className={`px-4 py-2 border-b-2 ${
                  csvImportTab === 'CUSTOMERS'
                    ? 'border-black dark:border-white font-bold'
                    : 'border-transparent text-neutral-500'
                }`}
              >
                2. Import Customers
              </button>
              <button
                onClick={() => {
                  setCsvImportTab('OPENING_STOCK');
                  setCsvPreviewRows(null);
                }}
                className={`px-4 py-2 border-b-2 ${
                  csvImportTab === 'OPENING_STOCK'
                    ? 'border-black dark:border-white font-bold'
                    : 'border-transparent text-neutral-500'
                }`}
              >
                3. Import Opening Stock
              </button>
            </div>

            {/* Template sample info */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 text-[11px] font-mono border space-y-1">
              <strong>Expected Columns ({csvImportTab}):</strong>
              {csvImportTab === 'PRODUCTS' && (
                <p className="text-neutral-600 dark:text-neutral-400">
                  product_name, category, brand, hsn, gst_percent, cost_price, mrp, retail_price, sku, barcode, opening_stock, stock_location
                </p>
              )}
              {csvImportTab === 'CUSTOMERS' && (
                <p className="text-neutral-600 dark:text-neutral-400">
                  customer_name, phone, customer_type (B2B/B2C), gstin, discount_percent, credit_days, address, city, state, pincode
                </p>
              )}
              {csvImportTab === 'OPENING_STOCK' && (
                <p className="text-neutral-600 dark:text-neutral-400">
                  sku (or barcode), qty, cost_price, location (Own/Damaged/Returns/Amazon FBA)
                </p>
              )}
            </div>

            {/* File Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold">Choose CSV File or Paste Raw CSV:</label>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} className="text-xs" />
              <textarea
                placeholder="Or paste comma-separated CSV lines here..."
                value={csvText}
                onChange={e => {
                  setCsvText(e.target.value);
                  try {
                    const rows = parseCsvToObjects(e.target.value);
                    setCsvPreviewRows(rows.slice(0, 10));
                  } catch {
                    // Ignore parse while typing
                  }
                }}
                rows={4}
                className="w-full p-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black font-mono text-xs"
              />
            </div>

            {/* Partial Import Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id="skipErrorsCheck"
                checked={skipErrors}
                onChange={e => setSkipErrors(e.target.checked)}
                className="accent-black"
              />
              <label htmlFor="skipErrorsCheck" className="font-semibold cursor-pointer">
                Partial Import: Import valid rows and skip invalid/broken rows
              </label>
            </div>

            {/* Dry Run Preview Table */}
            {csvPreviewRows && csvPreviewRows.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-bold block">Preview First {csvPreviewRows.length} Rows:</span>
                <div className="max-h-40 overflow-auto border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-100 dark:bg-neutral-800 sticky top-0">
                      <tr>
                        {Object.keys(csvPreviewRows[0]).slice(0, 5).map(k => (
                          <th key={k} className="p-1 border-r">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((r, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(r).slice(0, 5).map((v: any, vi) => (
                            <td key={vi} className="p-1 border-r truncate max-w-[120px]">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Summary & Error feedback */}
            {csvImportSummary && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 text-xs font-mono font-bold">
                {csvImportSummary}
              </div>
            )}

            {csvErrors.length > 0 && (
              <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs font-mono max-h-28 overflow-auto space-y-0.5">
                <strong>Validation Warnings / Skipped Rows:</strong>
                {csvErrors.slice(0, 8).map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
                {csvErrors.length > 8 && <div>... and {csvErrors.length - 8} more errors</div>}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setIsCsvModalOpen(false)} className="px-3 py-1.5 border text-xs font-semibold">
                Cancel
              </button>
              <button
                onClick={handleCommitCsvImport}
                disabled={!csvText.trim()}
                className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black text-xs font-bold disabled:opacity-40"
              >
                Commit Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Sheet Generator Modal */}
      {isLabelModalOpen && labelProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-500" />
                Barcode Label Sheet (A4)
              </h2>
              <button onClick={() => setIsLabelModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold">Sheet Density:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="sheetLayout"
                  checked={labelSheetLayout === '30-up'}
                  onChange={() => setLabelSheetLayout('30-up')}
                />
                <span>30-up (3 &times; 10 per page)</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="sheetLayout"
                  checked={labelSheetLayout === '65-up'}
                  onChange={() => setLabelSheetLayout('65-up')}
                />
                <span>65-up (5 &times; 13 per page)</span>
              </label>
            </div>

            {/* Label preview */}
            <div className="p-4 border border-dashed border-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 text-center space-y-1">
              <span className="font-bold text-xs block">{labelProduct.name}</span>
              <span className="font-mono text-xs block text-neutral-500">
                SKU: {labelProduct.sku || 'N/A'} · MRP: {formatINR(labelProduct.mrp)}
              </span>
              <div
                className="py-1 flex justify-center"
                dangerouslySetInnerHTML={{
                  __html: generateCode128Svg(labelProduct.barcode || labelProduct.sku || 'TYRE123', 140, 40),
                }}
              />
              <span className="font-mono text-[10px] block">{labelProduct.barcode || labelProduct.sku}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsLabelModalOpen(false)} className="px-3 py-1.5 border text-xs">
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-black text-white dark:bg-white dark:text-black font-bold text-xs"
              >
                Print Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

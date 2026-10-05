/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Order, Product, Customer, Supplier, StockBatch, StockLocation } from '../types';

export interface TallyStockItem {
  name: string;
  parentGroup: string;
  hsnCode: string;
  gstRate: number;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  uom: string;
  partNo?: string;
  costPrice: number;
  retailPrice: number;
  mrp: number;
  brand: string;
  category: string;
  sku?: string;
  barcode?: string;
}

export interface TallyLedger {
  name: string;
  parentGroup: string;
  ledgerType: 'SUNDRY_DEBTOR' | 'SUNDRY_CREDITOR' | 'BANK' | 'CASH' | 'DUTIES_TAXES' | 'SALES' | 'PURCHASE' | 'OTHER';
  gstin?: string;
  stateName: string;
  stateCode: string;
  pincode: string;
  address: string;
  phone: string;
  email?: string;
  openingBalance: number;
  balanceType: 'Dr' | 'Cr';
  creditPeriodDays: number;
  creditLimit?: number;
}

export interface TallyVoucher {
  voucherType: string;
  voucherNo: string;
  date: string;
  partyName: string;
  amount: number;
  narration?: string;
  items: Array<{
    name: string;
    qty: number;
    rate: number;
    amount: number;
  }>;
}

export interface TallyParseResult {
  fileType: 'XML' | 'CSV' | 'UNKNOWN';
  stockItems: TallyStockItem[];
  ledgers: TallyLedger[];
  vouchers: TallyVoucher[];
  errors: string[];
  warnings: string[];
  summary: {
    totalStockItems: number;
    totalDebtors: number;
    totalCreditors: number;
    totalVouchers: number;
    rawElementCount: number;
  };
}

// Helper: Infer automotive tyre brand from item name
export function inferBrand(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('MRF')) return 'MRF';
  if (upper.includes('APOLLO')) return 'Apollo';
  if (upper.includes('CEAT')) return 'CEAT';
  if (upper.includes('BRIDGESTONE')) return 'Bridgestone';
  if (upper.includes('GOODYEAR')) return 'Goodyear';
  if (upper.includes('MICHELIN')) return 'Michelin';
  if (upper.includes('JK TYRE') || upper.includes('JK')) return 'JK Tyre';
  if (upper.includes('YOKOHAMA')) return 'Yokohama';
  if (upper.includes('CONTINENTAL')) return 'Continental';
  if (upper.includes('PIRELLI')) return 'Pirelli';
  if (upper.includes('EXIDE')) return 'Exide';
  if (upper.includes('AMARON')) return 'Amaron';
  return 'Tyrebuddy';
}

// Helper: Infer category from parent group or item name
export function inferCategory(parentGroup: string, name: string): string {
  const combined = `${parentGroup} ${name}`.toUpperCase();
  if (combined.includes('TRUCK') || combined.includes('BUS') || combined.includes('TBR') || combined.includes('COMMERCIAL')) {
    return 'Commercial Truck & Bus Tyres';
  }
  if (combined.includes('BIKE') || combined.includes('2 WHEELER') || combined.includes('TWO WHEELER') || combined.includes('SCOOTER') || combined.includes('MOTORCYCLE')) {
    return 'Two-Wheeler & Motorcycle Tyres';
  }
  if (combined.includes('TUBE') || combined.includes('FLAP')) {
    return 'Inner Tubes & Flaps';
  }
  if (combined.includes('BATTERY') || combined.includes('INVERTER') || combined.includes('EXIDE') || combined.includes('AMARON')) {
    return 'Automotive Batteries';
  }
  if (combined.includes('ALLOY') || combined.includes('RIM') || combined.includes('WHEEL')) {
    return 'Alloy Wheels & Rims';
  }
  if (combined.includes('TRACTOR') || combined.includes('AGRICULTUR') || combined.includes('OTR')) {
    return 'Agricultural & OTR Tyres';
  }
  return 'Passenger Car Tyres';
}

// Helper: Extract clean numeric value from Tally strings like "50.00 NOS", "-15000.00", "4,500.00/NOS"
export function cleanTallyNumber(val: string | null | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, ' ').trim();
  const parts = cleaned.split(/\s+/);
  const num = parseFloat(parts[0]);
  return isNaN(num) ? 0 : Math.abs(num);
}

// Decode raw bytes of a Tally export. TallyPrime / ERP 9 save XML as UTF-16 LE (with BOM),
// which FileReader.readAsText() (UTF-8) turns into garbage. Detect the BOM and decode properly.
export function decodeTallyBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let encoding = 'utf-8';
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  else if (bytes.length >= 4 && bytes[1] === 0 && bytes[3] === 0) encoding = 'utf-16le'; // BOM-less UTF-16 LE
  return new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '');
}

// Tally writes control characters as numeric entities (e.g. "&#4; Not Applicable").
// They are illegal in XML 1.0, so DOMParser rejects the whole file. Strip them.
export function sanitizeTallyXml(xml: string): string {
  return xml
    .replace(/&#(?:x0*([0-9a-f]+)|0*(\d+));/gi, (m, hex, dec) => {
      const code = hex ? parseInt(hex, 16) : parseInt(dec, 10);
      const ok = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || code >= 0x10000;
      return ok ? m : '';
    })
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/^\s*<\?xml[^>]*\?>/i, '');
}

// querySelector can't match tag names containing a dot (e.g. "ADDRESS.LIST" is read as tag + class).
function tagList(root: Element | Document, name: string): Element[] {
  return Array.from(root.getElementsByTagName(name));
}

function firstText(node: Element, name: string): string {
  return node.getElementsByTagName(name)[0]?.textContent?.trim() || '';
}

// GST rate for a Tally stock item: take the IGST slab (= total GST %) from the latest GSTDETAILS.LIST
function readGstRate(node: Element): number {
  let rate = 0;
  tagList(node, 'RATEDETAILS.LIST').forEach(r => {
    if (firstText(r, 'GSTRATEDUTYHEAD').toUpperCase() === 'IGST') {
      const v = parseFloat(firstText(r, 'GSTRATE'));
      if (!isNaN(v) && v > 0) rate = v;
    }
  });
  return rate;
}

// Parse Tally XML (TallyPrime / Tally ERP 9)
export function parseTallyXml(xmlString: string): TallyParseResult {
  const stockItems: TallyStockItem[] = [];
  const ledgers: TallyLedger[] = [];
  const vouchers: TallyVoucher[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(sanitizeTallyXml(xmlString), 'text/xml');

  // Check for XML parsing error
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    return {
      fileType: 'XML',
      stockItems: [],
      ledgers: [],
      vouchers: [],
      errors: [`XML Parse Error: ${parserError.textContent?.slice(0, 200) || 'Malformed XML structure'}`],
      warnings: [],
      summary: { totalStockItems: 0, totalDebtors: 0, totalCreditors: 0, totalVouchers: 0, rawElementCount: 0 },
    };
  }

  // 1. Parse Stock Items (<STOCKITEM>)
  const stockItemNodes = xmlDoc.querySelectorAll('STOCKITEM');
  stockItemNodes.forEach((node, idx) => {
    try {
      const name =
        node.getAttribute('NAME') ||
        node.querySelector('NAME')?.textContent?.trim() ||
        `Tally-Item-${idx + 1}`;

      const cleanGroup = (v?: string | null) => {
        const t = (v || '').trim();
        return /^(not applicable|any|primary)$/i.test(t) ? '' : t;
      };
      const parentGroup =
        cleanGroup(node.querySelector('PARENT')?.textContent) ||
        cleanGroup(node.querySelector('CATEGORY')?.textContent) ||
        'Tyres';

      const baseUnits = node.querySelector('BASEUNITS')?.textContent?.trim() || 'NOS';
      
      // HSN / SAC Code
      let hsnCode =
        node.querySelector('HSNCODE')?.textContent?.trim() ||
        node.querySelector('GSTHSNNAME')?.textContent?.trim() ||
        node.querySelector('HSN')?.textContent?.trim() ||
        '';

      // If missing HSN, auto-default to tyre HSN
      if (!hsnCode) {
        hsnCode = '40111010';
        warnings.push(`Item "${name}": Missing HSN Code. Auto-assigned default tyre HSN 40111010.`);
      }

      // GST Rate % (from Tally GST slab details; fall back to legacy tags, then 18%)
      let gstRate = readGstRate(node);
      if (!gstRate) {
        const gstNode = node.querySelector('GSTREPORTRATE') || node.querySelector('INTEGRATEDTAX') || node.querySelector('GSTRATE');
        const parsedGst = gstNode?.textContent ? parseFloat(gstNode.textContent.replace(/[^\d.]/g, '')) : NaN;
        gstRate = !isNaN(parsedGst) && parsedGst > 0 ? parsedGst : 18;
      }

      // Opening balance & rate
      const openBalText = node.querySelector('OPENINGBALANCE')?.textContent?.trim() || '';
      const openingQty = cleanTallyNumber(openBalText);

      const openRateText = node.querySelector('OPENINGRATE')?.textContent?.trim() || '';
      const openingRate = cleanTallyNumber(openRateText);

      const openValText = node.querySelector('OPENINGVALUE')?.textContent?.trim() || '';
      const openingValue = cleanTallyNumber(openValText) || (openingQty * openingRate);

      // Part No / SKU
      const partNo =
        node.querySelector('PARTNO')?.textContent?.trim() ||
        node.querySelector('MAILINGNAME')?.textContent?.trim() ||
        undefined;

      // Selling Price / Retail Price
      const stdPriceNode = node.querySelector('STANDARDPRICE') || node.querySelector('STANDARDPRICELIST RATE');
      let retailPrice = stdPriceNode ? cleanTallyNumber(stdPriceNode.textContent) : 0;

      // Cost price
      let costPrice = openingRate;
      if (costPrice <= 0 && openingQty > 0 && openingValue > 0) {
        costPrice = Math.round(openingValue / openingQty);
      }

      if (retailPrice <= 0) {
        // No selling price in Tally: assume ~15% margin over cost; if cost is also unknown leave 0 for manual entry
        retailPrice = costPrice > 0 ? Math.round(costPrice * 1.15) : 0;
        if (retailPrice === 0) warnings.push(`Item "${name}": no cost/selling price in Tally - set price manually after import.`);
      }

      const mrp = Math.round(retailPrice * 1.12);
      const brand = inferBrand(name);
      const category = inferCategory(parentGroup, name);

      stockItems.push({
        name,
        parentGroup,
        hsnCode,
        gstRate,
        openingQty,
        openingRate: costPrice,
        openingValue,
        uom: baseUnits,
        partNo,
        costPrice,
        retailPrice,
        mrp,
        brand,
        category,
        sku: partNo || `SKU-${name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`,
      });
    } catch (err: any) {
      errors.push(`Error parsing StockItem row ${idx + 1}: ${err.message}`);
    }
  });

  // 2. Parse Ledgers (<LEDGER>)
  const ledgerNodes = xmlDoc.querySelectorAll('LEDGER');
  ledgerNodes.forEach((node, idx) => {
    try {
      const name =
        node.getAttribute('NAME') ||
        node.querySelector('NAME')?.textContent?.trim() ||
        `Tally-Ledger-${idx + 1}`;

      const parentGroup = node.querySelector('PARENT')?.textContent?.trim() || '';
      const parentLower = parentGroup.toLowerCase();

      // Skip internal Tally system ledgers like Profit & Loss
      if (name.toLowerCase() === 'profit & loss a/c') return;

      let ledgerType: TallyLedger['ledgerType'] = 'OTHER';
      if (parentLower.includes('debtor') || parentLower.includes('customer')) {
        ledgerType = 'SUNDRY_DEBTOR';
      } else if (parentLower.includes('creditor') || parentLower.includes('supplier') || parentLower.includes('vendor')) {
        ledgerType = 'SUNDRY_CREDITOR';
      } else if (parentLower.includes('bank')) {
        ledgerType = 'BANK';
      } else if (parentLower.includes('cash')) {
        ledgerType = 'CASH';
      } else if (parentLower.includes('duties') || parentLower.includes('tax')) {
        ledgerType = 'DUTIES_TAXES';
      } else if (parentLower.includes('sales')) {
        ledgerType = 'SALES';
      } else if (parentLower.includes('purchase')) {
        ledgerType = 'PURCHASE';
      }

      // GSTIN
      const gstin = (
        node.querySelector('PARTYGSTIN')?.textContent?.trim() ||
        node.querySelector('GSTIN')?.textContent?.trim() ||
        node.querySelector('INCOMETAXNUMBER')?.textContent?.trim() ||
        ''
      ).toUpperCase();

      // State
      let stateName = node.querySelector('LEDSTATENAME')?.textContent?.trim() ||
        node.querySelector('STATE')?.textContent?.trim() ||
        node.querySelector('STATENAME')?.textContent?.trim() ||
        'Gujarat';

      let stateCode = '24';
      if (gstin && gstin.length >= 2) {
        stateCode = gstin.slice(0, 2);
      }

      // Pincode
      const pincode = node.querySelector('PINCODE')?.textContent?.trim() || '395002';

      // Address
      const addressNodes = tagList(node, 'ADDRESS');
      let address = '';
      addressNodes.forEach(a => {
        const text = a.textContent?.trim();
        if (text) address = address ? `${address}, ${text}` : text;
      });
      if (!address) {
        address = 'Commercial Complex, Ring Road, Surat';
      }

      // Phone / Mobile
      const phoneRaw =
        node.querySelector('LEDGERMOBILE')?.textContent?.trim() ||
        node.querySelector('MOBILENO')?.textContent?.trim() ||
        node.querySelector('LEDGERPHONE')?.textContent?.trim() ||
        node.querySelector('PHONENUMBER')?.textContent?.trim() ||
        '';
      
      const phoneDigits = phoneRaw.replace(/\D/g, '');
      const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : `9879${(idx + 1000).toString().padStart(6, '0')}`;

      const email = node.querySelector('EMAIL')?.textContent?.trim() || undefined;

      // Opening balance
      const openBalText = node.querySelector('OPENINGBALANCE')?.textContent?.trim() || '0';
      // Tally XML export: debit balances are negative, credit balances positive (or explicit Dr/Cr suffix)
      const isCredit = /cr/i.test(openBalText) ? true : /dr/i.test(openBalText) ? false : !openBalText.startsWith('-') && cleanTallyNumber(openBalText) > 0;
      const openingBalance = cleanTallyNumber(openBalText);

      // Credit Days
      const creditPeriodText = node.querySelector('BILLCREDITPERIOD')?.textContent?.trim() || '';
      const creditPeriodDays = cleanTallyNumber(creditPeriodText) || (ledgerType === 'SUNDRY_DEBTOR' ? 30 : 0);

      // Credit Limit
      const creditLimitText = node.querySelector('CREDITLIMIT')?.textContent?.trim() || '';
      const creditLimit = cleanTallyNumber(creditLimitText) || (ledgerType === 'SUNDRY_DEBTOR' ? 200000 : undefined);

      ledgers.push({
        name,
        parentGroup,
        ledgerType,
        gstin: gstin || undefined,
        stateName,
        stateCode,
        pincode,
        address,
        phone,
        email,
        openingBalance,
        balanceType: isCredit ? 'Cr' : 'Dr',
        creditPeriodDays,
        creditLimit,
      });
    } catch (err: any) {
      errors.push(`Error parsing Ledger row ${idx + 1}: ${err.message}`);
    }
  });

  // 3. Parse Vouchers (<VOUCHER>)
  const voucherNodes = xmlDoc.querySelectorAll('VOUCHER');
  voucherNodes.forEach((node, idx) => {
    try {
      const voucherType = node.getAttribute('VCHTYPE') || node.querySelector('VOUCHERTYPENAME')?.textContent?.trim() || 'Sales';
      const voucherNo = node.querySelector('VOUCHERNUMBER')?.textContent?.trim() || `VCH-${idx + 1}`;
      
      const rawDate = node.querySelector('DATE')?.textContent?.trim() || '';
      let date = new Date().toISOString().split('T')[0];
      if (rawDate && rawDate.length === 8) {
        // Tally date format: YYYYMMDD
        date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      }

      const partyName = node.querySelector('PARTYLEDGERNAME')?.textContent?.trim() || 'Cash Customer';
      const narration = node.querySelector('NARRATION')?.textContent?.trim() || undefined;

      const items: Array<{ name: string; qty: number; rate: number; amount: number }> = [];
      const itemNodes = tagList(node, 'ALLINVENTORYENTRIES.LIST');
      let totalAmount = 0;

      itemNodes.forEach(itemNode => {
        const itemName = itemNode.querySelector('STOCKITEMNAME')?.textContent?.trim() || 'Tyre Item';
        const qty = cleanTallyNumber(itemNode.querySelector('ACTUALQTY')?.textContent || itemNode.querySelector('BILLEDQTY')?.textContent || '1');
        const rate = cleanTallyNumber(itemNode.querySelector('RATE')?.textContent || '0');
        const amount = cleanTallyNumber(itemNode.querySelector('AMOUNT')?.textContent || '0') || (qty * rate);
        totalAmount += amount;
        items.push({ name: itemName, qty, rate, amount });
      });

      if (totalAmount === 0) {
        // Try ledger entries sum
        const ledgerEntries = tagList(node, 'ALLLEDGERENTRIES.LIST').flatMap(e => tagList(e, 'AMOUNT'));
        ledgerEntries.forEach(l => {
          totalAmount += cleanTallyNumber(l.textContent);
        });
      }

      vouchers.push({
        voucherType,
        voucherNo,
        date,
        partyName,
        amount: totalAmount,
        narration,
        items,
      });
    } catch (err: any) {
      errors.push(`Error parsing Voucher row ${idx + 1}: ${err.message}`);
    }
  });

  const totalDebtors = ledgers.filter(l => l.ledgerType === 'SUNDRY_DEBTOR').length;
  const totalCreditors = ledgers.filter(l => l.ledgerType === 'SUNDRY_CREDITOR').length;

  return {
    fileType: 'XML',
    stockItems,
    ledgers,
    vouchers,
    errors,
    warnings,
    summary: {
      totalStockItems: stockItems.length,
      totalDebtors,
      totalCreditors,
      totalVouchers: vouchers.length,
      rawElementCount: stockItemNodes.length + ledgerNodes.length + voucherNodes.length,
    },
  };
}

// Parse Tally Excel / CSV Export Text
export function parseTallyCsv(csvString: string): TallyParseResult {
  const stockItems: TallyStockItem[] = [];
  const ledgers: TallyLedger[] = [];
  const vouchers: TallyVoucher[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = csvString.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      fileType: 'CSV',
      stockItems: [],
      ledgers: [],
      vouchers: [],
      errors: ['File is empty or contains only 1 line.'],
      warnings: [],
      summary: { totalStockItems: 0, totalDebtors: 0, totalCreditors: 0, totalVouchers: 0, rawElementCount: 0 },
    };
  }

  // Parse CSV Line respecting quotes
  const parseLine = (line: string): string[] => {
    const res: string[] = [];
    let insideQuotes = false;
    let curr = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        curr += '"';
        i++;
      } else if (ch === '"') {
        insideQuotes = !insideQuotes;
      } else if ((ch === ',' || ch === '\t') && !insideQuotes) {
        res.push(curr.trim());
        curr = '';
      } else {
        curr += ch;
      }
    }
    res.push(curr.trim());
    return res;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Detect whether this CSV is Stock Item Master or Ledger Master
  const isStockCsv = headers.some(h => h.includes('item') || h.includes('stock') || h.includes('hsn') || h.includes('closingqty') || h.includes('openingqty'));
  const isLedgerCsv = headers.some(h => h.includes('party') || h.includes('debtor') || h.includes('creditor') || h.includes('ledger') || h.includes('gstin'));

  lines.slice(1).forEach((line, idx) => {
    const cols = parseLine(line);
    if (cols.length === 0 || cols.every(c => c === '')) return;

    const getCol = (possibleKeywords: string[]): string => {
      for (let i = 0; i < headers.length; i++) {
        if (possibleKeywords.some(k => headers[i].includes(k))) {
          return cols[i] || '';
        }
      }
      return '';
    };

    if (isStockCsv || (!isLedgerCsv && cols.length >= 3)) {
      const name = getCol(['item', 'particulars', 'name', 'description']) || `Stock Item ${idx + 1}`;
      const parentGroup = getCol(['group', 'parent', 'category']) || 'Tyres';
      let hsnCode = getCol(['hsn', 'sac']) || '40111010';
      const gstRate = cleanTallyNumber(getCol(['gst', 'tax', 'rate', 'igst'])) || 28;
      const openingQty = cleanTallyNumber(getCol(['open', 'stock', 'qty', 'balance', 'closing']));
      const costPrice = cleanTallyNumber(getCol(['cost', 'rate', 'purchase', 'inward'])) || 3800;
      let retailPrice = cleanTallyNumber(getCol(['retail', 'price', 'selling', 'mrp']));
      if (retailPrice <= 0) retailPrice = Math.round(costPrice * 1.15);
      const mrp = Math.round(retailPrice * 1.12);
      const uom = getCol(['uom', 'unit']) || 'NOS';
      const partNo = getCol(['part', 'sku', 'code']);

      stockItems.push({
        name,
        parentGroup,
        hsnCode,
        gstRate,
        openingQty,
        openingRate: costPrice,
        openingValue: openingQty * costPrice,
        uom,
        partNo: partNo || undefined,
        costPrice,
        retailPrice,
        mrp,
        brand: inferBrand(name),
        category: inferCategory(parentGroup, name),
        sku: partNo || `SKU-${name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}`,
      });
    }

    if (isLedgerCsv || (!isStockCsv && cols.length >= 4)) {
      const name = getCol(['party', 'ledger', 'particulars', 'customer', 'supplier', 'name']) || `Party ${idx + 1}`;
      const parentGroup = getCol(['group', 'parent', 'under']) || 'Sundry Debtors';
      const parentLower = parentGroup.toLowerCase();

      let ledgerType: TallyLedger['ledgerType'] = 'SUNDRY_DEBTOR';
      if (parentLower.includes('creditor') || parentLower.includes('supplier')) {
        ledgerType = 'SUNDRY_CREDITOR';
      }

      const gstin = (getCol(['gstin', 'uin', 'gst']) || '').toUpperCase();
      const stateName = getCol(['state']) || 'Gujarat';
      const stateCode = gstin && gstin.length >= 2 ? gstin.slice(0, 2) : '24';
      const pincode = getCol(['pincode', 'pin', 'zip']) || '395002';
      const address = getCol(['address', 'city', 'location']) || 'Surat, Gujarat';
      
      const rawPhone = getCol(['phone', 'mobile', 'contact']);
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : `9879${(idx + 1000).toString().padStart(6, '0')}`;
      
      const email = getCol(['email']) || undefined;
      const openBal = cleanTallyNumber(getCol(['balance', 'opening', 'amount']));
      const creditDays = cleanTallyNumber(getCol(['credit', 'days', 'period'])) || (ledgerType === 'SUNDRY_DEBTOR' ? 30 : 0);

      ledgers.push({
        name,
        parentGroup,
        ledgerType,
        gstin: gstin || undefined,
        stateName,
        stateCode,
        pincode,
        address,
        phone,
        email,
        openingBalance: openBal,
        balanceType: 'Dr',
        creditPeriodDays: creditDays,
        creditLimit: 250000,
      });
    }
  });

  const totalDebtors = ledgers.filter(l => l.ledgerType === 'SUNDRY_DEBTOR').length;
  const totalCreditors = ledgers.filter(l => l.ledgerType === 'SUNDRY_CREDITOR').length;

  return {
    fileType: 'CSV',
    stockItems,
    ledgers,
    vouchers,
    errors,
    warnings,
    summary: {
      totalStockItems: stockItems.length,
      totalDebtors,
      totalCreditors,
      totalVouchers: 0,
      rawElementCount: lines.length - 1,
    },
  };
}

// Master Parser: Auto-detects whether rawText is XML or CSV/Excel
export function parseTallyData(rawText: string): TallyParseResult {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (trimmed.startsWith('<') || trimmed.includes('<ENVELOPE') || trimmed.includes('<TALLYMESSAGE')) {
    return parseTallyXml(trimmed);
  }
  return parseTallyCsv(trimmed);
}

// Real-world sample Tally XML for instant 1-click test
export function getSampleTallyXml(): string {
  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <!-- Stock Items Masters (Tyres, Tubes & Batteries) -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="MRF ZVTV 185/65 R15 88H Tubeless" ACTION="Create">
            <PARENT>Passenger Car Tyres</PARENT>
            <BASEUNITS>NOS</BASEUNITS>
            <PARTNO>MRF-ZVTV-1856515</PARTNO>
            <HSNCODE>40111010</HSNCODE>
            <GSTREPORTRATE>28.00</GSTREPORTRATE>
            <OPENINGBALANCE>48.00 NOS</OPENINGBALANCE>
            <OPENINGRATE>3850.00/NOS</OPENINGRATE>
            <OPENINGVALUE>184800.00</OPENINGVALUE>
            <STANDARDPRICE>4400.00</STANDARDPRICE>
          </STOCKITEM>
        </TALLYMESSAGE>

        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Apollo Alnac 4G 195/65 R15 91V Tubeless" ACTION="Create">
            <PARENT>Passenger Car Tyres</PARENT>
            <BASEUNITS>NOS</BASEUNITS>
            <PARTNO>APO-ALN-1956515</PARTNO>
            <HSNCODE>40111010</HSNCODE>
            <GSTREPORTRATE>28.00</GSTREPORTRATE>
            <OPENINGBALANCE>36.00 NOS</OPENINGBALANCE>
            <OPENINGRATE>4200.00/NOS</OPENINGRATE>
            <OPENINGVALUE>151200.00</OPENINGVALUE>
            <STANDARDPRICE>4850.00</STANDARDPRICE>
          </STOCKITEM>
        </TALLYMESSAGE>

        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="CEAT Secura Zoom F 90/90-17 49P Tubeless" ACTION="Create">
            <PARENT>Two-Wheeler &amp; Motorcycle Tyres</PARENT>
            <BASEUNITS>NOS</BASEUNITS>
            <PARTNO>CEAT-SEC-909017</PARTNO>
            <HSNCODE>40114010</HSNCODE>
            <GSTREPORTRATE>28.00</GSTREPORTRATE>
            <OPENINGBALANCE>60.00 NOS</OPENINGBALANCE>
            <OPENINGRATE>1450.00/NOS</OPENINGRATE>
            <OPENINGVALUE>87000.00</OPENINGVALUE>
            <STANDARDPRICE>1850.00</STANDARDPRICE>
          </STOCKITEM>
        </TALLYMESSAGE>

        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Exide Mileage ML38B20R Car Battery (35Ah)" ACTION="Create">
            <PARENT>Automotive Batteries</PARENT>
            <BASEUNITS>NOS</BASEUNITS>
            <PARTNO>EXD-ML38B20R</PARTNO>
            <HSNCODE>85071000</HSNCODE>
            <GSTREPORTRATE>28.00</GSTREPORTRATE>
            <OPENINGBALANCE>24.00 NOS</OPENINGBALANCE>
            <OPENINGRATE>3400.00/NOS</OPENINGRATE>
            <OPENINGVALUE>81600.00</OPENINGVALUE>
            <STANDARDPRICE>4200.00</STANDARDPRICE>
          </STOCKITEM>
        </TALLYMESSAGE>

        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="Bridgestone Ecopia EP150 205/65 R16 Tubeless" ACTION="Create">
            <PARENT>Passenger Car Tyres</PARENT>
            <BASEUNITS>NOS</BASEUNITS>
            <PARTNO>BRDG-ECO-2056516</PARTNO>
            <HSNCODE>40111010</HSNCODE>
            <GSTREPORTRATE>28.00</GSTREPORTRATE>
            <OPENINGBALANCE>20.00 NOS</OPENINGBALANCE>
            <OPENINGRATE>6200.00/NOS</OPENINGRATE>
            <OPENINGVALUE>124000.00</OPENINGVALUE>
            <STANDARDPRICE>7100.00</STANDARDPRICE>
          </STOCKITEM>
        </TALLYMESSAGE>

        <!-- Customer Ledgers (Sundry Debtors) -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Gujarat Fleet Logistics Pvt Ltd" ACTION="Create">
            <PARENT>Sundry Debtors</PARENT>
            <PARTYGSTIN>24AABCG1234F1Z8</PARTYGSTIN>
            <LEDSTATENAME>Gujarat</LEDSTATENAME>
            <PINCODE>395006</PINCODE>
            <ADDRESS.LIST>
              <ADDRESS>Plot 42, GIDC Sachin Industrial Area</ADDRESS>
              <ADDRESS>Surat, Gujarat</ADDRESS>
            </ADDRESS.LIST>
            <LEDGERMOBILE>9879101234</LEDGERMOBILE>
            <EMAIL>accounts@gujaratfleet.in</EMAIL>
            <OPENINGBALANCE>45000.00 Dr</OPENINGBALANCE>
            <BILLCREDITPERIOD>45 Days</BILLCREDITPERIOD>
            <CREDITLIMIT>500000.00</CREDITLIMIT>
          </LEDGER>
        </TALLYMESSAGE>

        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Surat Royal Auto Spares &amp; Tyres" ACTION="Create">
            <PARENT>Sundry Debtors</PARENT>
            <PARTYGSTIN>24BBPPR5678K1Z2</PARTYGSTIN>
            <LEDSTATENAME>Gujarat</LEDSTATENAME>
            <PINCODE>395002</PINCODE>
            <ADDRESS.LIST>
              <ADDRESS>Shop 12-14, Auto Market, Ring Road</ADDRESS>
              <ADDRESS>Surat, Gujarat</ADDRESS>
            </ADDRESS.LIST>
            <LEDGERMOBILE>9825123456</LEDGERMOBILE>
            <EMAIL>suratroyalauto@gmail.com</EMAIL>
            <OPENINGBALANCE>28500.00 Dr</OPENINGBALANCE>
            <BILLCREDITPERIOD>30 Days</BILLCREDITPERIOD>
            <CREDITLIMIT>300000.00</CREDITLIMIT>
          </LEDGER>
        </TALLYMESSAGE>

        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="Patel Cab Services &amp; Tours" ACTION="Create">
            <PARENT>Sundry Debtors</PARENT>
            <PARTYGSTIN>24AAJFP9988D1Z4</PARTYGSTIN>
            <LEDSTATENAME>Gujarat</LEDSTATENAME>
            <PINCODE>395007</PINCODE>
            <ADDRESS.LIST>
              <ADDRESS>Near Airport Road, Vesu</ADDRESS>
              <ADDRESS>Surat, Gujarat</ADDRESS>
            </ADDRESS.LIST>
            <LEDGERMOBILE>9898234567</LEDGERMOBILE>
            <EMAIL>patelcabsurat@yahoo.com</EMAIL>
            <OPENINGBALANCE>12400.00 Dr</OPENINGBALANCE>
            <BILLCREDITPERIOD>30 Days</BILLCREDITPERIOD>
            <CREDITLIMIT>200000.00</CREDITLIMIT>
          </LEDGER>
        </TALLYMESSAGE>

        <!-- Supplier Ledgers (Sundry Creditors) -->
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="MRF Tyres Regional Depot" ACTION="Create">
            <PARENT>Sundry Creditors</PARENT>
            <PARTYGSTIN>24AAACM1122C1Z9</PARTYGSTIN>
            <LEDSTATENAME>Gujarat</LEDSTATENAME>
            <PINCODE>380015</PINCODE>
            <ADDRESS.LIST>
              <ADDRESS>Highway Logistics Park, SG Highway</ADDRESS>
              <ADDRESS>Ahmedabad, Gujarat</ADDRESS>
            </ADDRESS.LIST>
            <LEDGERMOBILE>9879555666</LEDGERMOBILE>
            <EMAIL>depot.ahmedabad@mrftyres.com</EMAIL>
            <OPENINGBALANCE>180000.00 Cr</OPENINGBALANCE>
            <BILLCREDITPERIOD>30 Days</BILLCREDITPERIOD>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

// Two-Way Sync: Generate Tally-Compatible XML for Tyrebuddy Sales Orders / Invoices
export function generateTallyVouchersXml(orders: Order[], settings: { businessName: string; gstin: string }): string {
  const vouchersXml = orders.map(order => {
    // Format date as YYYYMMDD
    const dateFormatted = order.orderDate.replace(/-/g, '');
    const isInterState = !order.isGujarat;
    const cgstTotal = order.cgstTotal || 0;
    const sgstTotal = order.sgstTotal || 0;
    const igstTotal = order.igstTotal || 0;

    // Inventory items entries
    const inventoryXml = order.items.map(item => {
      const taxable = item.taxableAmount || (item.unitPrice * item.qty);
      return `          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${escapeXml(item.name)}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${item.unitPrice.toFixed(2)}/NOS</RATE>
            <ACTUALQTY>${item.qty} NOS</ACTUALQTY>
            <BILLEDQTY>${item.qty} NOS</BILLEDQTY>
            <AMOUNT>-${taxable.toFixed(2)}</AMOUNT>
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>Primary</BATCHNAME>
              <AMOUNT>-${taxable.toFixed(2)}</AMOUNT>
              <ACTUALQTY>${item.qty} NOS</ACTUALQTY>
              <BILLEDQTY>${item.qty} NOS</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`;
    }).join('\n');

    // Tax ledger entries
    let taxLedgersXml = '';
    if (isInterState) {
      taxLedgersXml = `          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>IGST Output @ 28%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${igstTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
    } else {
      taxLedgersXml = `          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>CGST Output @ 14%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${cgstTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>SGST Output @ 14%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${sgstTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
    }

    return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>${dateFormatted}</DATE>
          <EFFECTIVEDATE>${dateFormatted}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(order.invoiceNo || order.orderNo)}</VOUCHERNUMBER>
          <REFERENCE>${escapeXml(order.orderNo)}</REFERENCE>
          <PARTYLEDGERNAME>${escapeXml(order.customerName)}</PARTYLEDGERNAME>
          <PARTYNAME>${escapeXml(order.customerName)}</PARTYNAME>
          <NARRATION>Billed via Tyrebuddy Business OS. Invoice ${order.invoiceNo || order.orderNo}. Customer: ${escapeXml(order.customerName)} (${order.customerType}).</NARRATION>
          
          <!-- Debit Customer Account with Grand Total -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(order.customerName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>${order.grandTotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- Credit Sales Account with Taxable Total -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Tyre Sales - GST 28%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${order.subtotal.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- Credit GST Duties & Taxes Ledgers -->
${taxLedgersXml}

          <!-- Detailed Inventory Allocation -->
${inventoryXml}
        </VOUCHER>
      </TALLYMESSAGE>`;
  }).join('\n');

  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <!-- Generated by Tyrebuddy Business OS for TallyPrime / Tally ERP 9 -->
        <!-- Company: ${escapeXml(settings.businessName)} (GSTIN: ${escapeXml(settings.gstin)}) -->
${vouchersXml}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

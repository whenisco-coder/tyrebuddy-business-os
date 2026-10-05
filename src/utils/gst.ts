export const GUJARAT_STATE_NAME = 'Gujarat';
export const GUJARAT_STATE_CODE = '24';

export const INDIAN_STATES = [
  { name: 'Gujarat', code: '24' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Delhi', code: '07' },
  { name: 'Karnataka', code: '29' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Haryana', code: '06' },
  { name: 'Punjab', code: '03' },
  { name: 'West Bengal', code: '19' },
  { name: 'Telangana', code: '36' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Kerala', code: '32' },
  { name: 'Goa', code: '30' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Odisha', code: '21' },
];

export function isGujaratState(stateName: string): boolean {
  if (!stateName) return true; // default to intra-state if unspecified
  const clean = stateName.trim().toLowerCase();
  return clean === 'gujarat' || clean === 'gj' || clean === '24';
}

export interface TaxCalculation {
  taxableAmount: number;
  isGujarat: boolean;
  gstPercent: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  grandTotal: number;
}

export function calculateItemTax(
  taxableAmount: number,
  gstPercent: number,
  isGujarat: boolean
): TaxCalculation {
  const round2 = (num: number) => Math.round(num * 100) / 100;

  if (isGujarat) {
    const halfRate = gstPercent / 2;
    const cgstAmount = round2((taxableAmount * halfRate) / 100);
    const sgstAmount = round2((taxableAmount * halfRate) / 100);
    const taxTotal = round2(cgstAmount + sgstAmount);
    return {
      taxableAmount: round2(taxableAmount),
      isGujarat: true,
      gstPercent,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      taxTotal,
      grandTotal: round2(taxableAmount + taxTotal),
    };
  } else {
    const igstAmount = round2((taxableAmount * gstPercent) / 100);
    return {
      taxableAmount: round2(taxableAmount),
      isGujarat: false,
      gstPercent,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: gstPercent,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount,
      taxTotal: igstAmount,
      grandTotal: round2(taxableAmount + igstAmount),
    };
  }
}

export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface HsnSummaryRow {
  hsn: string;
  taxableValue: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
}

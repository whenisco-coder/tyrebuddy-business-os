const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertBelowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n] + ' ';
  if (n < 100) {
    return TENS[Math.floor(n / 10)] + ' ' + (n % 10 !== 0 ? ONES[n % 10] + ' ' : '');
  }
  return ONES[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? convertBelowThousand(n % 100) : '');
}

export function numberToIndianWords(amount: number): string {
  if (amount === 0) return 'INR Zero Only';

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let num = rupees;
  let words = '';

  // Crores (1,00,00,000)
  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) {
    words += convertBelowThousand(crores) + 'Crore ';
  }

  // Lakhs (1,00,000)
  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) {
    words += convertBelowThousand(lakhs) + 'Lakh ';
  }

  // Thousands (1,000)
  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) {
    words += convertBelowThousand(thousands) + 'Thousand ';
  }

  // Hundreds & Remaining
  if (num > 0) {
    words += convertBelowThousand(num);
  }

  let result = 'INR ' + words.trim();

  if (paise > 0) {
    result += ' and ' + convertBelowThousand(paise).trim() + ' Paise';
  }

  result += ' Only';
  return result;
}

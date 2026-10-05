import QRCode from 'qrcode';

// Code128 pattern table (patterns for Code 128 B)
// Each character pattern has 11 modules (6 bars and spaces), Stop pattern has 13 modules
const CODE128_PATTERNS: Record<number, string> = {
  0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322',
  5: '131222', 6: '122213', 7: '122312', 8: '132212', 9: '221213',
  10: '221312', 11: '231212', 12: '112232', 13: '122132', 14: '122231',
  15: '113222', 16: '123122', 17: '123221', 18: '223211', 19: '221132',
  20: '221231', 21: '213212', 22: '223112', 23: '312131', 24: '311222',
  25: '321122', 26: '321221', 27: '312212', 28: '322112', 29: '322211',
  30: '212123', 31: '212321', 32: '232121', 33: '111323', 34: '131123',
  35: '131321', 36: '112313', 37: '132113', 38: '132311', 39: '211313',
  40: '231113', 41: '231311', 42: '112133', 43: '112331', 44: '132131',
  45: '113123', 46: '113321', 47: '133121', 48: '313121', 49: '211331',
  50: '231131', 51: '213113', 52: '213311', 53: '213131', 54: '311123',
  55: '311321', 56: '331121', 57: '312113', 58: '312311', 59: '332111',
  60: '314111', 61: '221411', 62: '431111', 63: '111224', 64: '111422',
  65: '121124', 66: '121421', 67: '141122', 68: '141221', 69: '112214',
  70: '112412', 71: '122114', 72: '122411', 73: '142112', 74: '142211',
  75: '241211', 76: '221114', 77: '413111', 78: '241112', 79: '134111',
  80: '111242', 81: '121142', 82: '121241', 83: '114212', 84: '124112',
  85: '124211', 86: '411212', 87: '421112', 88: '421211', 89: '212141',
  90: '214121', 91: '412121', 92: '111143', 93: '111341', 94: '131141',
  95: '114113', 96: '114311', 97: '411113', 98: '411311', 99: '113141',
  100: '114131', 101: '311141', 102: '411131', 103: '211412', 104: '211214',
  105: '211232', 106: '2331112' // Stop pattern has 7 elements
};

export function encodeCode128B(text: string): string {
  // Start Code B is value 104
  const startCode = 104;
  const values: number[] = [startCode];
  let checkSum = startCode;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    const val = Math.max(0, Math.min(code, 95));
    values.push(val);
    checkSum += val * (i + 1);
  }

  const checkDigit = checkSum % 103;
  values.push(checkDigit);
  values.push(106); // Stop code

  let binary = '';
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v] || '212222';
    let isBar = true;
    for (const widthChar of pattern) {
      const width = parseInt(widthChar, 10);
      binary += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  }

  return binary;
}

export function generateCode128Svg(
  text: string,
  width: number = 200,
  height: number = 50,
  showText: boolean = true
): string {
  if (!text) text = 'TYRE-0000';
  const binary = encodeCode128B(text);
  const totalModules = binary.length + 20; // 10 quiet zone modules each side
  const moduleWidth = width / totalModules;
  const barHeight = showText ? height - 14 : height;

  let rects = '';
  let x = 10 * moduleWidth;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${moduleWidth.toFixed(2)}" height="${barHeight}" fill="#000000" />`;
    }
    x += moduleWidth;
  }

  const textElement = showText
    ? `<text x="${(width / 2).toFixed(2)}" y="${height - 2}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" fill="#000000">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">
    <rect width="${width}" height="${height}" fill="#ffffff" />
    ${rects}
    ${textElement}
  </svg>`;
}

export async function generateQrDataUrl(text: string, size: number = 180): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR:', err);
    return '';
  }
}

export function buildUpiPayUri(upiId: string, name: string, amount?: number, note?: string): string {
  const params = new URLSearchParams();
  params.set('pa', upiId);
  params.set('pn', name);
  params.set('cu', 'INR');
  if (amount && amount > 0) {
    params.set('am', amount.toFixed(2));
  }
  if (note) {
    params.set('tn', note);
  }
  return `upi://pay?${params.toString()}`;
}

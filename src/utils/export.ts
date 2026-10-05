export function downloadFile(filename: string, content: string, contentType: string = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsv(
  filename: string,
  arg2: string[] | Record<string, any>[],
  arg3?: (string | number)[][]
) {
  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  if (Array.isArray(arg2) && arg2.length > 0 && typeof arg2[0] === 'object' && !Array.isArray(arg2[0])) {
    // Array of objects passed
    const data = arg2 as Record<string, any>[];
    headers = Object.keys(data[0]);
    rows = data.map(item => headers.map(h => item[h] ?? ''));
  } else if (Array.isArray(arg2) && Array.isArray(arg3)) {
    headers = arg2 as string[];
    rows = arg3;
  } else {
    headers = Array.isArray(arg2) ? (arg2 as string[]) : [];
    rows = [];
  }

  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(r => r.map(escapeCell).join(',')).join('\n');
  const csvContent = `${headerLine}\n${rowLines}`;

  downloadFile(filename.endsWith('.csv') ? filename : `${filename}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string) => {
    const result: string[] = [];
    let insideQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export function parseCsvToObjects(text: string): Record<string, string>[] {
  const { headers, rows } = parseCsv(text);
  const cleanHeaders = headers.map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.map(row => {
    const obj: Record<string, string> = {};
    cleanHeaders.forEach((h, idx) => {
      obj[h] = row[idx] ?? '';
    });
    return obj;
  });
}

export function checkBackupReminder(lastBackupDateStr?: string): { isOverdue: boolean; daysAgo: number } {
  if (!lastBackupDateStr) {
    return { isOverdue: true, daysAgo: 99 };
  }
  const lastDate = new Date(lastBackupDateStr).getTime();
  const now = Date.now();
  const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
  return {
    isOverdue: diffDays >= 7,
    daysAgo: diffDays,
  };
}

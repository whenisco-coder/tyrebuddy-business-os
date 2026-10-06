import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Saves a file to the device and opens the native share menu.
 * Works for both Native (APK) and Web (Browser).
 */
export async function saveAndShareFile(
  filename: string,
  data: string,
  mimeType: string = 'text/plain'
) {
  if (Capacitor.isNativePlatform()) {
    try {
      let encoding = Encoding.UTF8;
      let fileData = data;

      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        encoding = Encoding.Base64;
        if (data.includes(',')) {
          fileData = data.split(',')[1];
        }
      }

      const result = await Filesystem.writeFile({
        path: filename,
        data: fileData,
        directory: Directory.Documents,
        encoding: encoding,
      });

      await Share.share({
        title: 'Export File',
        text: `Here is your file: ${filename}`,
        url: result.uri,
        dialogTitle: 'Share or Save File',
      });

      alert('File saved successfully to Documents folder!');
    } catch (e) {
      console.error('Error saving file', e);
      alert('Failed to save file. Please check storage permissions.');
    }
  } else {
    let blob: Blob;
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      const base64Data = data.includes(',') ? data.split(',')[1] : data;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      blob = new Blob([data], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Legacy download function for CSV/Text exports (web-only style).
 */
export function downloadFile(
  filename: string,
  content: string,
  contentType: string = 'text/plain'
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Converts an array of objects into a CSV string.
 */
export function objectsToCsv(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (val: any): string => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map(escapeCell).join(',');
  const bodyLines = rows.map(row =>
    headers.map(h => escapeCell(row[h])).join(',')
  );
  return [headerLine, ...bodyLines].join('\n');
}

/**
 * Exports an array of objects as a CSV file and saves/shares it.
 */
export async function exportToCsv(
  filename: string,
  rows: Record<string, any>[]
) {
  const csv = objectsToCsv(rows);
  await saveAndShareFile(filename, csv, 'text/csv');
}

/**
 * Parses a CSV string into an array of objects.
 * The first row is treated as the header.
 * Handles quoted values and commas inside quotes.
 */
export function parseCsvToObjects(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim());
  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0].trim() === '') continue;

    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = (row[index] ?? '').trim();
    });
    result.push(obj);
  }

  return result;
}

/**
 * Reads an uploaded File and returns its text content.
 * Useful for CSV imports via <input type="file" />.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Opens the native share menu with plain text.
 */
export async function shareText(title: string, text: string) {
  if (Capacitor.isNativePlatform()) {
    await Share.share({
      title,
      text,
      dialogTitle: title,
    });
  } else if (navigator.share) {
    await navigator.share({ title, text });
  } else {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  }
}

/**
 * Checks whether the user should be reminded to take a backup.
 * Returns true if the last backup was more than 7 days ago (or never).
 */
export function checkBackupReminder(): boolean {
  try {
    const lastBackup = localStorage.getItem('tyrebuddy_last_backup');
    if (!lastBackup) return true;
    const lastDate = new Date(lastBackup);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= 7;
  } catch (e) {
    console.error('Error checking backup reminder:', e);
    return false;
  }
}

/**
 * Marks the current date as the last successful backup time.
 */
export function markBackupDone(): void {
  try {
    localStorage.setItem('tyrebuddy_last_backup', new Date().toISOString());
  } catch (e) {
    console.error('Error marking backup done:', e);
  }
}

/**
 * Downloads a JSON backup of the provided data.
 */
export async function downloadBackup(
  filename: string,
  data: any
): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  await saveAndShareFile(filename, json, 'application/json');
  markBackupDone();
}

/**
 * Reads a JSON backup file from an uploaded File object.
 */
export async function readBackupFile(file: File): Promise<any> {
  const text = await readFileAsText(file);
  return JSON.parse(text);
}

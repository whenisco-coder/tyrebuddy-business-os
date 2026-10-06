import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Saves a file to the device and opens the share menu.
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

      // If it's a PDF or Image, it comes as Base64.
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
    // Web Browser Fallback
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
 * Kept for backward compatibility with older CSV/Text exports.
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
 * Checks whether the user should be reminded to take a backup.
 * Returns true if the last backup was more than 7 days ago (or never).
 */
export function checkBackupReminder(): boolean {
  try {
    const lastBackup = localStorage.getItem('tyrebuddy_last_backup');
    if (!lastBackup) {
      return true; // Never backed up — show reminder
    }
    const lastDate = new Date(lastBackup);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= 7; // Remind if 7+ days since last backup
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

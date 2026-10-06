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

      // If it's a PDF or Image, it comes as Base64. We need to handle it natively.
      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        encoding = Encoding.Base64;
        // Remove the Data URI prefix (e.g., "data:application/pdf;base64,")
        if (data.includes(',')) {
          fileData = data.split(',')[1];
        }
      }

      // 1. Save the file to the phone's Documents folder
      const result = await Filesystem.writeFile({
        path: filename,
        data: fileData,
        directory: Directory.Documents,
        encoding: encoding
      });

      // 2. Open the native Share menu
      await Share.share({
        title: 'Export File',
        text: `Here is your file: ${filename}`,
        url: result.uri,
        dialogTitle: 'Share or Save File'
      });
      
      alert('File saved successfully to Documents folder!');
    } catch (e) {
      console.error('Error saving file', e);
      alert('Failed to save file. Please ensure the app has storage permissions.');
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

// Keep this for any old CSV exports you might have
export function downloadFile(filename: string, content: string, contentType: string = 'text/plain') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

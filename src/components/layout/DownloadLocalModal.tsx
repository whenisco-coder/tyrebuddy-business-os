import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { downloadFile } from '../../utils/export';
import {
  Download,
  Terminal,
  HardDrive,
  Copy,
  Check,
  X,
  Laptop,
  CheckCircle2,
  FolderArchive,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface DownloadLocalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadLocalModal: React.FC<DownloadLocalModalProps> = ({ isOpen, onClose }) => {
  const { triggerBackup, products, orders, customers, stockBatches, settings } = useStore();
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(label);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const handleDownloadFullDatabase = () => {
    const snap = triggerBackup('MANUAL');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(`tyrebuddy-local-database-${timestamp}.json`, snap.backupJson, 'application/json');
  };

  const handleDownloadStarterGuide = () => {
    const readmeContent = `# Tyrebuddy Business OS — Local Offline Setup Guide

This application is built with React, Vite, TypeScript, and Tailwind CSS.
It is 100% offline-ready, storing all operational business data in local device storage with zero cloud lock-in.

---

## Quick Start (3 Steps)

### Step 1: Install Dependencies
Open your command terminal (Command Prompt, PowerShell, or macOS/Linux Terminal) in this project folder:
\`\`\`bash
npm install
\`\`\`

### Step 2: Start Local Offline Server
\`\`\`bash
npm run dev
\`\`\`

### Step 3: Open in Any Web Browser
Visit:
\`\`\`
http://localhost:3000
\`\`\`

---

## Key Features When Running Locally:
1. **100% Offline Capability**: Runs seamlessly even with zero internet / in airplane mode.
2. **Instant Hardware Barcode Scanning**: Works directly with USB plug-and-play barcode scanners (Code128 wedge) and webcams.
3. **High-Speed GST Printing**: Monochrome Tally-style GST Invoices, Credit Notes, and thermal Courier Shipping Labels (4×6, A6, A5, A4) print instantly using your local default printer drivers.
4. **Data Privacy**: All customer records, FIFO procurement batches, and revenue details stay strictly on your local computer.
5. **Automated Daily Backups**: Local rolling retention keeps daily snapshots, with 1-click JSON and CSV exports.

---

## System Requirements:
- Node.js version 18.0 or higher (Download free at https://nodejs.org)
- Any modern web browser (Google Chrome, Microsoft Edge, Brave, Firefox, Safari)

Business: ${settings.businessName}
Generated on: ${new Date().toLocaleString()}
`;
    downloadFile('TYREBUDDY-LOCAL-SETUP.md', readmeContent, 'text/markdown');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 w-full max-w-2xl shadow-2xl rounded-none my-8 overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-tight text-neutral-900 dark:text-neutral-100">
                Run Tyrebuddy Business OS Locally on Your Computer
              </h2>
              <p className="text-[11px] text-neutral-500 font-mono">
                100% Offline · Standalone React App · Zero External Cloud Dependencies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs">
          {/* Answer Banner */}
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-xs uppercase tracking-wide">
                Yes! You can run this entire application on your local machine.
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300 font-sans">
                Tyrebuddy OS is built as a self-contained, offline-first application. You can download the code, install dependencies, and run it locally on Windows, Mac, or Linux without needing any cloud hosting or active internet connection.
              </p>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase font-mono text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              How to Run Locally in 3 Steps:
            </h3>

            {/* Step 1 */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-[11px]">
                  Step 1: Download or Export the Codebase
                </span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 text-[11px]">
                In the Google AI Studio top bar, click the <strong>Export / Download Code</strong> button to save the project ZIP to your computer, and unzip it to a folder.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-[11px]">
                  Step 2: Install Dependencies (Runs Once)
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('npm install', 'step2')}
                  className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  {copiedStep === 'step2' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedStep === 'step2' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2 bg-neutral-900 text-neutral-100 dark:bg-black font-mono text-[11px] overflow-x-auto">
                npm install
              </pre>
            </div>

            {/* Step 3 */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 font-mono text-[11px]">
                  Step 3: Launch Local Offline Server
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('npm run dev', 'step3')}
                  className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  {copiedStep === 'step3' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedStep === 'step3' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-2 bg-neutral-900 text-neutral-100 dark:bg-black font-mono text-[11px] overflow-x-auto">
                npm run dev
              </pre>
              <p className="text-[11px] text-neutral-500">
                Then open your browser to <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 text-neutral-900 dark:text-neutral-100 font-mono">http://localhost:3000</code>.
              </p>
            </div>
          </div>

          {/* Instant Downloads Block */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
            <h4 className="text-[11px] font-bold uppercase font-mono text-neutral-600 dark:text-neutral-400">
              Download Local Data & Setup Package:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadFullDatabase}
                className="flex items-center justify-between p-3 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left transition"
              >
                <div>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                    Download Local Database (.json)
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    {orders.length} orders · {products.length} products · {stockBatches.length} FIFO batches
                  </div>
                </div>
                <Download className="w-4 h-4 text-neutral-500 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleDownloadStarterGuide}
                className="flex items-center justify-between p-3 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left transition"
              >
                <div>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                    <FolderArchive className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
                    Download Setup Guide (.md)
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    Step-by-step instructions for Windows / Mac / Linux
                  </div>
                </div>
                <Download className="w-4 h-4 text-neutral-500 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero cloud tracking · 100% offline data privacy</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 font-bold"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Camera, X, Scan, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatINR } from '../../utils/gst';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'lookup' | 'order' | 'count';
  onScanResult?: (skuOrBarcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  mode = 'lookup',
  onScanResult,
}) => {
  const { products, getStockQty, adjustStock } = useStore();
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [matchedItem, setMatchedItem] = useState<{
    product: any;
    variant?: any;
    stockTotal: number;
  } | null>(null);
  const [countFeedback, setCountFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setManualCode('');
      setLastScanned(null);
      setMatchedItem(null);
      setCountFeedback(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } else {
        setCameraError('Camera access not supported on this browser/device.');
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Camera permissions unavailable. Use quick barcode input below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleResolveCode = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    setLastScanned(code);

    // Search products and variants
    let foundProd = null;
    let foundVar = null;

    for (const p of products) {
      if (
        p.barcode?.toLowerCase() === clean ||
        p.sku?.toLowerCase() === clean ||
        p.name.toLowerCase().includes(clean)
      ) {
        foundProd = p;
        break;
      }
      if (p.variants) {
        const v = p.variants.find(
          vr =>
            vr.barcode.toLowerCase() === clean ||
            vr.sku.toLowerCase() === clean ||
            vr.amazonFnsku?.toLowerCase() === clean
        );
        if (v) {
          foundProd = p;
          foundVar = v;
          break;
        }
      }
    }

    if (foundProd) {
      const stock = getStockQty(foundProd.id, foundVar?.id);
      setMatchedItem({ product: foundProd, variant: foundVar, stockTotal: stock });

      if (mode === 'count') {
        // Quick increment stock count by 1 in Own location
        adjustStock({
          productId: foundProd.id,
          variantId: foundVar?.id,
          location: 'Own',
          qtyDelta: 1,
          type: 'COUNT_CORRECTION',
          reason: 'Scan-for-Count Audit Mode (+1)',
        });
        setCountFeedback(`Counted +1 unit of ${foundVar?.title || foundProd.name}. Current stock: ${stock + 1}`);
      }

      if (onScanResult) {
        onScanResult(code);
      }
    } else {
      setMatchedItem(null);
      setCountFeedback(`No product or variant found matching barcode "${code}"`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
            <h2 className="text-sm font-semibold tracking-tight uppercase text-neutral-900 dark:text-neutral-100">
              {mode === 'lookup' && 'Product & Barcode Scanner'}
              {mode === 'order' && 'Order Picking Scanner'}
              {mode === 'count' && 'Scan-for-Count Mode'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Camera Viewport */}
          <div className="relative w-full aspect-16/9 bg-neutral-950 flex items-center justify-center overflow-hidden border border-neutral-800">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Aiming Reticle */}
                <div className="absolute inset-8 border-2 border-dashed border-white/60 pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500/80 animate-pulse" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                <Camera className="w-10 h-10 mb-2 stroke-1" />
                <p className="text-xs text-neutral-300">
                  {cameraError || 'Camera inactive'}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-3 px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                >
                  Enable Camera
                </button>
              </div>
            )}
          </div>

          {/* Quick Manual / Wedge Scanner Input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
              Barcode / SKU / FNSKU
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Scan with USB wedge or type SKU (e.g. MRF1856515)..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleResolveCode(manualCode);
                    setManualCode('');
                  }
                }}
                className="flex-1 px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100"
              />
              <button
                type="button"
                onClick={() => {
                  handleResolveCode(manualCode);
                  setManualCode('');
                }}
                className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-white"
              >
                Scan / Enter
              </button>
            </div>
          </div>

          {/* Quick sample test buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span className="font-medium text-[11px] uppercase tracking-wide">Test Barcodes:</span>
            {['MRF1856515', 'APO2055516', 'TBPRESTA48', 'EXD45AH12V'].map(bc => (
              <button
                key={bc}
                type="button"
                onClick={() => handleResolveCode(bc)}
                className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 hover:border-neutral-900"
              >
                {bc}
              </button>
            ))}
          </div>

          {/* Match Result Display */}
          {matchedItem && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Item Identified</span>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {matchedItem.product.name}
                  </h3>
                  {matchedItem.variant && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                      Variant: {matchedItem.variant.title}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100 block">
                    {formatINR(matchedItem.variant?.priceDelta ? matchedItem.product.retailPrice + matchedItem.variant.priceDelta : matchedItem.product.retailPrice)}
                  </span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Stock: {matchedItem.stockTotal} units
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-500 font-mono">
                <span>HSN: {matchedItem.product.hsn}</span>
                <span>GST: {matchedItem.product.gstPercent}%</span>
                <span>SKU: {matchedItem.variant?.sku || matchedItem.product.sku}</span>
              </div>
            </div>
          )}

          {countFeedback && (
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 font-mono">
              {countFeedback}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};

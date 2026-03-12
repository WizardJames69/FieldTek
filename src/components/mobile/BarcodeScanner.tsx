import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
}

const SUPPORTED_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
];

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return;

    setLoading(true);
    setPermissionDenied(false);

    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, SUPPORTED_FORMATS);
      const reader = new BrowserMultiFormatReader(hints);

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const cleaned = result.getText().trim().replace(/\s+/g, "");
            if (cleaned) {
              stopScanning();
              onScan(cleaned);
              onOpenChange(false);
              toast.success("Barcode scanned successfully");
            }
          }
          // Errors are expected during continuous scanning (no barcode in frame)
        }
      );

      controlsRef.current = controls;
      setLoading(false);
    } catch (err) {
      console.error("[BarcodeScanner] Failed to start camera:", err);
      setLoading(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionDenied(true);
      } else {
        toast.error("Failed to start camera");
        onOpenChange(false);
      }
    }
  }, [onScan, onOpenChange, stopScanning]);

  useEffect(() => {
    if (open) {
      startScanning();
    }
    return () => {
      stopScanning();
    };
  }, [open, startScanning, stopScanning]);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) stopScanning();
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-sm">Scan Barcode / QR Code</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-square bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {/* Scanning crosshair overlay */}
          {!loading && !permissionDenied && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/5 h-2/5 border-2 border-white/70 rounded-lg" />
            </div>
          )}

          {/* Loading spinner */}
          {loading && !permissionDenied && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Starting camera...</span>
            </div>
          )}

          {/* Permission denied */}
          {permissionDenied && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white gap-3 px-6 text-center">
              <p className="text-sm">
                Camera permission denied. Please enable camera access in device settings.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => startScanning()}
              >
                <RefreshCw className="h-4 w-4" />
                Retry Scan
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

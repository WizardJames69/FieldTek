import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

interface ImageAttachmentProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

// Compress image to max dimension and quality
async function compressImage(file: File, maxDimension = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if needed
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ImageAttachment({
  images,
  onImagesChange,
  maxImages = 4,
  disabled = false,
}: ImageAttachmentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setIsProcessing(true);
    try {
      const newImages: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }

        // Check file size (max 10MB before compression)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        const compressed = await compressImage(file);
        newImages.push(compressed);
      }

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages]);
      }
    } catch (error) {
      console.error("Image processing error:", error);
      toast.error("Failed to process image");
    } finally {
      setIsProcessing(false);
      // Reset inputs
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const canAddMore = images.length < maxImages && !disabled;

  // Rendered as a fragment so the pieces slot directly into the composer's
  // flex-wrap row: previews take a full line above (basis-full), the two
  // icon buttons sit inline next to the input.
  return (
    <>
      {/* Image previews */}
      {images.length > 0 && (
        <div className="basis-full flex flex-wrap items-center gap-2 px-1.5 pt-1 pb-1.5">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={img}
                alt={`Attached ${idx + 1}`}
                className="h-16 w-16 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={disabled}
                aria-label={`Remove attached image ${idx + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {images.length}/{maxImages}
          </span>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={!canAddMore || isProcessing}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
        disabled={!canAddMore || isProcessing}
      />

      {/* Action buttons */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => cameraInputRef.current?.click()}
        disabled={!canAddMore || isProcessing}
        title="Take photo"
        aria-label="Take photo"
      >
        <Camera className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => fileInputRef.current?.click()}
        disabled={!canAddMore || isProcessing}
        title="Upload image"
        aria-label="Upload image"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
    </>
  );
}

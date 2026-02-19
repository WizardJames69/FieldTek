import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Linkedin, Twitter, Facebook, Link2, Check, Share2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SHARE_URL = "https://fieldtek.ai/?waitlist=open";
const SHARE_TEXT = "Just discovered FieldTek - AI-powered field service management that actually helps techs in the field. Joining the waitlist for early access! 🔧";
const SHARE_HASHTAGS = "FieldService,HVAC,AI";

interface SocialShareProps {
  variant?: "inline" | "floating";
  className?: string;
}

export function SocialShare({ variant = "inline", className = "" }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const shareLinks = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_URL)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}&hashtags=${SHARE_HASHTAGS}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
  };

  const handleShare = (platform: string, url: string) => {
    trackEvent("social_share_click", { platform });
    window.open(url, "_blank", "width=600,height=400");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      trackEvent("social_share_click", { platform: "copy_link" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const ShareButtons = () => (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full border-border/50 hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/50 hover:text-[#0A66C2]"
        onClick={() => handleShare("linkedin", shareLinks.linkedin)}
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full border-border/50 hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/50 hover:text-[#1DA1F2]"
        onClick={() => handleShare("twitter", shareLinks.twitter)}
        aria-label="Share on X (Twitter)"
      >
        <Twitter className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full border-border/50 hover:bg-[#1877F2]/10 hover:border-[#1877F2]/50 hover:text-[#1877F2]"
        onClick={() => handleShare("facebook", shareLinks.facebook)}
        aria-label="Share on Facebook"
      >
        <Facebook className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 rounded-full border-border/50 hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
        onClick={handleCopyLink}
        aria-label="Copy link"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
      </Button>
    </div>
  );

  if (variant === "floating") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className={`fixed bottom-24 right-4 sm:right-6 z-40 h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 ${className}`}
            aria-label="Share FieldTek"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="end"
          sideOffset={8}
          className="w-auto p-3"
        >
          <p className="text-sm text-muted-foreground mb-2">Share FieldTek</p>
          <ShareButtons />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm text-muted-foreground">Share:</span>
      <ShareButtons />
    </div>
  );
}

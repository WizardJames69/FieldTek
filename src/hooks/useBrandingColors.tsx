import { useEffect, useState, useMemo, useRef } from 'react';
import { useBranding } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

// Convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function extractBucketPath(url: string, bucket: string): string | null {
  const patterns = [
    new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`),
    new RegExp(`/storage/v1/object/${bucket}/(.+)$`),
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return null;
}

// Track if we've ever applied branding to prevent flash on refresh
const appliedColorsRef = { current: false };

export function useBrandingColors() {
  const branding = useBranding();
  const [faviconSignedUrl, setFaviconSignedUrl] = useState<string | null>(null);
  const hasAppliedRef = useRef(false);

  const faviconSource = branding?.favicon_url ?? null;
  const faviconPath = useMemo(
    () => (faviconSource ? extractBucketPath(faviconSource, 'documents') : null),
    [faviconSource]
  );

  // Fetch signed URL for favicon
  useEffect(() => {
    let cancelled = false;

    async function getSignedUrl() {
      if (!faviconPath) {
        setFaviconSignedUrl(null);
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(faviconPath, 3600);
        if (!cancelled && data && !error) {
          setFaviconSignedUrl(data.signedUrl);
        }
      } catch {
        // fall back to nothing
      }
    }

    getSignedUrl();
    return () => { cancelled = true; };
  }, [faviconPath]);

  // Apply colors + favicon
  useEffect(() => {
    const root = document.documentElement;

    // Only apply when we have actual values
    if (branding?.primary_color) {
      const hsl = hexToHSL(branding.primary_color);
      if (hsl) {
        root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        const foregroundL = hsl.l > 50 ? 10 : 98;
        root.style.setProperty('--primary-foreground', `${hsl.h} ${Math.max(hsl.s - 20, 0)}% ${foregroundL}%`);

        root.style.setProperty('--sidebar-primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        root.style.setProperty('--sidebar-primary-foreground', `${hsl.h} ${Math.max(hsl.s - 20, 0)}% ${foregroundL}%`);

        const darkL = Math.max(hsl.l - 30, 15);
        root.style.setProperty('--sidebar-background', `${hsl.h} ${Math.min(hsl.s, 40)}% ${darkL}%`);
        root.style.setProperty('--sidebar-foreground', `${hsl.h} ${Math.max(hsl.s - 30, 0)}% 95%`);
        root.style.setProperty('--sidebar-border', `${hsl.h} ${Math.min(hsl.s, 40)}% ${Math.min(darkL + 10, 30)}%`);

        root.style.setProperty('--sidebar-accent', `${hsl.h} ${Math.min(hsl.s, 40)}% ${Math.min(darkL + 12, 35)}%`);
        root.style.setProperty('--sidebar-accent-foreground', `${hsl.h} ${Math.max(hsl.s - 30, 0)}% 95%`);
        
        hasAppliedRef.current = true;
        appliedColorsRef.current = true;
      }
    }

    if (branding?.secondary_color) {
      const hsl = hexToHSL(branding.secondary_color);
      if (hsl) {
        root.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        const foregroundL = hsl.l > 50 ? 10 : 98;
        root.style.setProperty('--accent-foreground', `${hsl.h} ${Math.max(hsl.s - 20, 0)}% ${foregroundL}%`);
      }
    }

    if (faviconSignedUrl) {
      let faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = faviconSignedUrl;
    }

    // Only cleanup on true unmount (component destroyed), not on re-renders
    // We track if we've applied colors to prevent removing them during loading states
    return () => {
      // Don't remove styles during loading/refresh - only on true component unmount
      // Check if this is a page unload or navigation away from the app entirely
      const isUnloading = !document.hasFocus() || document.visibilityState === 'hidden';
      
      if (!isUnloading && hasAppliedRef.current) {
        // Don't remove - we're likely just re-rendering
        return;
      }
      
      // Only remove if we're truly leaving the app
      if (isUnloading) {
        root.style.removeProperty('--primary');
        root.style.removeProperty('--primary-foreground');
        root.style.removeProperty('--accent');
        root.style.removeProperty('--accent-foreground');
        root.style.removeProperty('--sidebar-primary');
        root.style.removeProperty('--sidebar-primary-foreground');
        root.style.removeProperty('--sidebar-background');
        root.style.removeProperty('--sidebar-foreground');
        root.style.removeProperty('--sidebar-border');
        root.style.removeProperty('--sidebar-accent');
        root.style.removeProperty('--sidebar-accent-foreground');
      }
    };
  }, [branding?.primary_color, branding?.secondary_color, faviconSignedUrl]);
}

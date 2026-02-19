import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/TenantContext";

function extractBucketPathFromUrl(url: string, bucket: string): string | null {
  // Matches both public and non-public object URLs
  // e.g. .../storage/v1/object/public/documents/<path>
  // e.g. .../storage/v1/object/documents/<path>
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

async function resolveSignedUrl(bucket: string, path: string, expiresInSeconds: number) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export function useBrandingAssets() {
  const branding = useBranding();

  const logoSource = branding?.logo_url ?? null;
  const faviconSource = branding?.favicon_url ?? null;

  const [logoUrl, setLogoUrl] = useState<string | null>(logoSource);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(faviconSource);

  // Use branding bucket for logos/favicons (public bucket, no signed URLs needed)
  // Fall back to documents bucket for legacy URLs that need signed URLs
  const brandingBucket = "branding";
  const documentsBucket = "documents";
  const expiresIn = 60 * 60; // 1h

  // Determine which bucket each URL is from
  const getUrlBucket = (url: string | null): string | null => {
    if (!url) return null;
    if (url.includes('/branding/')) return brandingBucket;
    if (url.includes('/documents/')) return documentsBucket;
    return null;
  };

  const logoPath = useMemo(() => {
    if (!logoSource) return null;
    const bucket = getUrlBucket(logoSource);
    return bucket ? extractBucketPathFromUrl(logoSource, bucket) : null;
  }, [logoSource]);

  const faviconPath = useMemo(() => {
    if (!faviconSource) return null;
    const bucket = getUrlBucket(faviconSource);
    return bucket ? extractBucketPathFromUrl(faviconSource, bucket) : null;
  }, [faviconSource]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // default to what is stored
      setLogoUrl(logoSource);
      setFaviconUrl(faviconSource);

      // For branding bucket (public), URLs work directly - no need for signed URLs
      // For documents bucket (private legacy), generate signed URLs
      try {
        const logoBucket = getUrlBucket(logoSource);
        if (logoSource && logoPath && logoBucket === documentsBucket) {
          const signed = await resolveSignedUrl(documentsBucket, logoPath, expiresIn);
          if (!cancelled) setLogoUrl(signed);
        }
        // For branding bucket, the public URL already works
      } catch {
        // fall back to stored url
      }

      try {
        const faviconBucket = getUrlBucket(faviconSource);
        if (faviconSource && faviconPath && faviconBucket === documentsBucket) {
          const signed = await resolveSignedUrl(documentsBucket, faviconPath, expiresIn);
          if (!cancelled) setFaviconUrl(signed);
        }
        // For branding bucket, the public URL already works
      } catch {
        // fall back to stored url
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [logoSource, faviconSource, logoPath, faviconPath]);

  return { logoUrl, faviconUrl };
}

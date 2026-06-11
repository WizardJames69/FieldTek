import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage object path from a public Supabase storage URL, or
 * return the value unchanged if it is already a path. Mirrors the logic in
 * DocumentCard so citation chips resolve the same file the Documents page does.
 */
export function extractFilePath(fileUrl: string): string {
  if (fileUrl.startsWith("http")) {
    try {
      const url = new URL(fileUrl);
      // Path format: /storage/v1/object/public/documents/tenant-id/filename
      const match = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
      if (match) return match[1];
      return fileUrl;
    } catch {
      return fileUrl;
    }
  }
  return fileUrl;
}

/**
 * Resolve a short-lived signed URL for a document by id, with an optional PDF
 * page anchor (`#page=N`). Returns null on any failure so callers can fall back
 * to navigating to the Documents page. Reuses the `documents` bucket + 1-hour
 * expiry convention from DocumentCard. The page anchor is best-effort — browsers
 * with a built-in PDF viewer (Chrome / PDF.js) honor it; others open at page 1.
 */
export async function resolveDocumentSignedUrl(
  documentId: string,
  pageNumber?: number | null,
): Promise<string | null> {
  try {
    const { data: doc, error } = await supabase
      .from("documents")
      .select("file_url")
      .eq("id", documentId)
      .maybeSingle();
    if (error || !doc?.file_url) return null;

    const filePath = extractFilePath(doc.file_url);
    const { data, error: signError } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 3600);
    if (signError || !data?.signedUrl) return null;

    return pageNumber != null ? `${data.signedUrl}#page=${pageNumber}` : data.signedUrl;
  } catch {
    return null;
  }
}

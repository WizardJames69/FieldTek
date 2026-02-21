/**
 * AES-256-GCM encryption/decryption for OAuth tokens stored in calendar_sync_tokens.
 *
 * Encrypted format: "hex(iv):hex(ciphertext)"
 * - 12-byte random IV per encryption (NIST recommended for AES-GCM)
 * - Requires env var CALENDAR_TOKEN_ENCRYPTION_KEY (base64-encoded 32 bytes)
 *
 * Backward compatible: decrypt() returns plaintext as-is if the value
 * doesn't match the encrypted format (no colon separator).
 */

let _cachedKey: CryptoKey | null = null;

function hexEncode(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function getKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;

  const b64 = Deno.env.get("CALENDAR_TOKEN_ENCRYPTION_KEY");
  if (!b64) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY is not configured");
  }

  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error(`Encryption key must be 32 bytes, got ${raw.length}`);
  }

  _cachedKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );

  return _cachedKey;
}

/**
 * Encrypt a plaintext string. Returns "hex(iv):hex(ciphertext)".
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return `${hexEncode(iv.buffer)}:${hexEncode(ciphertext)}`;
}

/**
 * Decrypt an encrypted string. If the value doesn't look encrypted
 * (no colon separator, or not valid hex), returns it as-is for
 * backward compatibility with pre-encryption plaintext tokens.
 */
export async function decryptToken(encrypted: string): Promise<string> {
  // Backward compat: plaintext values don't contain our hex:hex pattern
  const colonIdx = encrypted.indexOf(":");
  if (colonIdx === -1) return encrypted;

  const ivHex = encrypted.substring(0, colonIdx);
  const ctHex = encrypted.substring(colonIdx + 1);

  // Additional check: both parts should be valid hex and IV should be 24 hex chars (12 bytes)
  if (ivHex.length !== 24 || !/^[0-9a-f]+$/.test(ivHex) || !/^[0-9a-f]+$/.test(ctHex)) {
    // Doesn't match encrypted format — treat as plaintext (e.g., a JWT with ":" in it)
    return encrypted;
  }

  try {
    const key = await getKey();
    const iv = hexDecode(ivHex);
    const ciphertext = hexDecode(ctHex);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed — likely a plaintext value that happened to match the format
    return encrypted;
  }
}

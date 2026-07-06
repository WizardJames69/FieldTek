/**
 * Pure validation/normalization for public "service request" intake forms
 * (submitted through the CAPTCHA-gated public endpoints). Keeps the untrusted,
 * unauthenticated payload bounded: required fields present, types correct,
 * lengths capped — so a public caller cannot push oversized or malformed data
 * into a tenant's request queue.
 *
 * Pure and side-effect-free so it can be unit-tested directly.
 */

export interface SanitizedServiceRequest {
  title: string;
  description: string;
  request_type: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
}

export type IntakeResult =
  | { ok: true; value: SanitizedServiceRequest }
  | { ok: false; error: string };

// Generous caps — well above any legitimate submission, low enough to stop
// payload abuse.
export const INTAKE_LIMITS = {
  title: 200,
  description: 5000,
  request_type: 100,
  contact_name: 200,
  contact_email: 320,
  contact_phone: 50,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v.trim();
}

/**
 * Validate and normalize an untrusted intake form. Returns `{ ok: false }`
 * with a generic reason on any missing required field, wrong type, bad email,
 * or over-limit field (rejected rather than silently truncated).
 */
export function sanitizeServiceRequestForm(form: unknown): IntakeResult {
  if (!form || typeof form !== "object") {
    return { ok: false, error: "Invalid form data" };
  }
  const f = form as Record<string, unknown>;

  const title = asTrimmedString(f.title);
  const description = asTrimmedString(f.description);
  const requestType = asTrimmedString(f.request_type);
  const contactName = asTrimmedString(f.contact_name);
  const contactEmail = asTrimmedString(f.contact_email);
  const contactPhoneRaw = f.contact_phone === undefined || f.contact_phone === null
    ? null
    : asTrimmedString(f.contact_phone);

  if (!title || !description || !requestType || !contactName || !contactEmail) {
    return { ok: false, error: "Missing required fields" };
  }
  if (contactPhoneRaw === null && f.contact_phone !== undefined && f.contact_phone !== null) {
    return { ok: false, error: "Invalid contact phone" };
  }
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "Invalid contact email" };
  }

  if (
    title.length > INTAKE_LIMITS.title ||
    description.length > INTAKE_LIMITS.description ||
    requestType.length > INTAKE_LIMITS.request_type ||
    contactName.length > INTAKE_LIMITS.contact_name ||
    contactEmail.length > INTAKE_LIMITS.contact_email ||
    (contactPhoneRaw !== null && contactPhoneRaw.length > INTAKE_LIMITS.contact_phone)
  ) {
    return { ok: false, error: "One or more fields exceed the allowed length" };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      request_type: requestType,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhoneRaw && contactPhoneRaw.length > 0 ? contactPhoneRaw : null,
    },
  };
}

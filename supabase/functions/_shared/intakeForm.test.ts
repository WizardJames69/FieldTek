import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { INTAKE_LIMITS, sanitizeServiceRequestForm } from "./intakeForm.ts";

const VALID = {
  title: "  AC not cooling  ",
  description: "Unit blows warm air.",
  request_type: "repair",
  contact_name: "  Jane Doe ",
  contact_email: "jane@example.com",
  contact_phone: " 555-0100 ",
};

Deno.test("valid form is accepted and trimmed", () => {
  const r = sanitizeServiceRequestForm(VALID);
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.value.title, "AC not cooling");
    assertEquals(r.value.contact_name, "Jane Doe");
    assertEquals(r.value.contact_phone, "555-0100");
    assertEquals(r.value.request_type, "repair");
  }
});

Deno.test("missing phone is allowed → null", () => {
  const { contact_phone: _drop, ...noPhone } = VALID;
  const r = sanitizeServiceRequestForm(noPhone);
  assert(r.ok);
  if (r.ok) assertEquals(r.value.contact_phone, null);
});

Deno.test("empty-string phone normalizes to null", () => {
  const r = sanitizeServiceRequestForm({ ...VALID, contact_phone: "   " });
  assert(r.ok);
  if (r.ok) assertEquals(r.value.contact_phone, null);
});

Deno.test("non-object input is rejected", () => {
  assert(!sanitizeServiceRequestForm(null).ok);
  assert(!sanitizeServiceRequestForm("nope").ok);
  assert(!sanitizeServiceRequestForm(42).ok);
});

Deno.test("missing required field is rejected", () => {
  const { title: _drop, ...noTitle } = VALID;
  assert(!sanitizeServiceRequestForm(noTitle).ok);
  const blankDesc = sanitizeServiceRequestForm({ ...VALID, description: "   " });
  assert(!blankDesc.ok);
});

Deno.test("non-string required field is rejected", () => {
  assert(!sanitizeServiceRequestForm({ ...VALID, title: 123 }).ok);
});

Deno.test("invalid email is rejected", () => {
  assert(!sanitizeServiceRequestForm({ ...VALID, contact_email: "not-an-email" }).ok);
  assert(!sanitizeServiceRequestForm({ ...VALID, contact_email: "a@b" }).ok);
});

Deno.test("non-string phone is rejected", () => {
  assert(!sanitizeServiceRequestForm({ ...VALID, contact_phone: 5550100 }).ok);
});

Deno.test("oversized fields are rejected, not truncated", () => {
  const bigDesc = sanitizeServiceRequestForm({
    ...VALID,
    description: "x".repeat(INTAKE_LIMITS.description + 1),
  });
  assert(!bigDesc.ok);

  const bigTitle = sanitizeServiceRequestForm({
    ...VALID,
    title: "x".repeat(INTAKE_LIMITS.title + 1),
  });
  assert(!bigTitle.ok);
});

Deno.test("a field exactly at the cap is accepted", () => {
  const r = sanitizeServiceRequestForm({
    ...VALID,
    title: "x".repeat(INTAKE_LIMITS.title),
  });
  assert(r.ok);
});

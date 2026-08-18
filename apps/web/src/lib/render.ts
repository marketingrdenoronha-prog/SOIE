/* eslint-disable @typescript-eslint/no-explicit-any */

/** Coerces any value into a string safe to render as a React child. AI-produced
 * JSON is not fully predictable, so a field expected to be a string can arrive
 * as an object/array — handing that to React throws a client-side exception. */
export function text(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.value === "string") return v.value;
    if (typeof v.description === "string") return v.description;
    if (typeof v.name === "string") return v.name;
    if (typeof v.title === "string") return v.title;
    if (typeof v.label === "string") return v.label;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Coerces any value into an array so `.map` is always safe. */
export function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

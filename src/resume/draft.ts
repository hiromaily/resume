import type { Lang } from "../i18n/lang";
import type { Texts } from "../translate/ports";
import { type FormValues, fieldName, list, str } from "./validation";

/** Extracts the source to translate (the fields in the `from` language) from the form values. Keys are the base names. Empty values are dropped */
export function pickSource(values: FormValues, fields: readonly string[], from: Lang): Texts {
  const source: Texts = {};
  for (const field of fields) {
    const value = values[fieldName(field, from)];
    if (Array.isArray(value)) {
      const items = list(value).filter((s) => s.length > 0);
      if (items.length > 0) source[field] = items;
    } else if (str(value).trim().length > 0) {
      source[field] = str(value);
    }
  }
  return source;
}

/** Puts the translation (keyed by base name) into the fields of the `to` language. Other values stay as they are */
export function applyDraft(values: FormValues, draft: Texts, to: Lang): FormValues {
  const next: FormValues = { ...values };
  for (const [field, value] of Object.entries(draft)) next[fieldName(field, to)] = value;
  return next;
}

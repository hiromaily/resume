import type { ProjectInput, ResumeInput } from "../db/ports";
import type { Lang, Localized } from "../i18n/lang";
import { LANGS } from "../i18n/lang";
import { isPosition } from "./positions";

export type FormValues = Record<string, string | string[]>;

/** Field name → error message */
export type FieldErrors = Record<string, string>;

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors; values: FormValues };

/** The first form value as a string (empty string if none) */
export const str = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? ""));

/** All form values as an array of strings (empty if none) */
export const list = (v: unknown): string[] => [v ?? []].flat().map(String);

const dedupe = (items: string[]) =>
  items.filter((t, i) => items.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i);

/** Merges the chips (<field>, multiple) with the words left in the input (<field>_query, comma- or newline-separated) */
export const chipValues = (form: Record<string, unknown>, field: string): string[] =>
  dedupe(
    [form[field], form[`${field}_query`]]
      .flat()
      .flatMap((x) => String(x ?? "").split(/[,\r\n]/))
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
  );

const result = <T>(errors: FieldErrors, values: FormValues, value: T): Validation<T> =>
  Object.keys(errors).length > 0 ? { ok: false, errors, values } : { ok: true, value };

/** Per-language text field names. Japanese uses the base name; English appends _en */
export const fieldName = (base: string, lang: Lang): string => (lang === "ja" ? base : `${base}_en`);

/** Fields held per language (also used as the list of fields Task 6 translates) */
export const RESUME_TEXT_FIELDS = ["full_name", "certifications", "self_pr"] as const;
export const PROJECT_TEXT_FIELDS = ["company", "project_name", "duties"] as const;

/** The marker added to English field names in error messages */
const label = (name: string, lang: Lang) => (lang === "ja" ? name : `${name}（英語）`);

/** Turns form values into FormValues without validating */
export function resumeFormValues(form: Record<string, unknown>): FormValues {
  const values: FormValues = { skills: chipValues(form, "skills") };
  for (const lang of LANGS) {
    values[fieldName("full_name", lang)] = str(form[fieldName("full_name", lang)]).trim();
    values[fieldName("certifications", lang)] = chipValues(form, fieldName("certifications", lang));
    values[fieldName("self_pr", lang)] = str(form[fieldName("self_pr", lang)]);
  }
  return values;
}

export function projectFormValues(form: Record<string, unknown>): FormValues {
  // If currently employed, ignore the end inputs (without JS, the dropdowns that should be disabled are still sent)
  const current = str(form.current) === "on";
  const values: FormValues = {
    start_year: str(form.start_year).trim(),
    start_month: str(form.start_month).trim(),
    current: current ? "on" : "",
    end_year: str(form.end_year).trim(),
    end_month: str(form.end_month).trim(),
    technologies: chipValues(form, "technologies"),
    // The same value can come from both the chips and the dropdown, so drop duplicates and empties
    positions: [...new Set([...list(form.positions), ...list(form.position_pick)])].filter((p) => p.length > 0),
  };
  for (const lang of LANGS) {
    values[fieldName("company", lang)] = str(form[fieldName("company", lang)]).trim();
    values[fieldName("project_name", lang)] = str(form[fieldName("project_name", lang)]).trim();
    values[fieldName("duties", lang)] = str(form[fieldName("duties", lang)]);
  }
  return values;
}

/** Extracts the per-language values (strings in FormValues) */
const text = (values: FormValues, base: string): Localized<string> => ({
  ja: str(values[fieldName(base, "ja")]),
  en: str(values[fieldName(base, "en")]),
});

export function validateResumeInput(form: Record<string, unknown>): Validation<ResumeInput> {
  const values = resumeFormValues(form);
  const skills = list(values.skills);
  const fullName = text(values, "full_name");
  const selfPr = text(values, "self_pr");
  const certifications: Localized<string[]> = {
    ja: list(values[fieldName("certifications", "ja")]),
    en: list(values[fieldName("certifications", "en")]),
  };
  const errors: FieldErrors = {};

  if (fullName.ja.length === 0 && fullName.en.length === 0)
    errors.full_name = "氏名を日本語か英語のどちらかで入力してください";
  if (skills.length > 50 || skills.some((s) => s.length > 50))
    errors.skills = "スキルは50個まで、1つ50文字以内にしてください";
  for (const lang of LANGS) {
    if (fullName[lang].length > 100)
      errors[fieldName("full_name", lang)] = `${label("氏名", lang)}は100文字以内にしてください`;
    if (certifications[lang].length > 50 || certifications[lang].some((s) => s.length > 100))
      errors[fieldName("certifications", lang)] = `${label("資格", lang)}は50個まで、1つ100文字以内にしてください`;
    if (selfPr[lang].length > 4000)
      errors[fieldName("self_pr", lang)] = `${label("自己PR", lang)}は4000文字以内にしてください`;
  }

  return result(errors, values, { fullName, skills, certifications, selfPr });
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateProjectInput(form: Record<string, unknown>): Validation<ProjectInput> {
  const values = projectFormValues(form);
  const startYear = str(values.start_year);
  const startMonth = str(values.start_month);
  const current = str(values.current) === "on";
  const endYear = str(values.end_year);
  const endMonth = str(values.end_month);
  const company = text(values, "company");
  const projectName = text(values, "project_name");
  const duties = text(values, "duties");
  const technologies = list(values.technologies);
  const positions = list(values.positions);

  const startYm = `${startYear}-${startMonth}`;
  const endYm = current || (!endYear && !endMonth) ? "" : `${endYear}-${endMonth}`;
  const errors: FieldErrors = {};

  if (!YM.test(startYm)) errors.start = "開始の年と月を選んでください";
  if (!current && !endYm) errors.end = "終了の年と月を選ぶか、就業中にチェックしてください";
  else if (endYm && !YM.test(endYm)) errors.end = "終了の年と月を選んでください（現在なら年を「現在」に）";
  else if (endYm && YM.test(startYm) && endYm < startYm) errors.end = "終了は開始より後の年月にしてください";
  if (company.ja.length === 0 && company.en.length === 0)
    errors.company = "会社名を日本語か英語のどちらかで入力してください";
  if (projectName.ja.length === 0 && projectName.en.length === 0)
    errors.project_name = "プロジェクト名を日本語か英語のどちらかで入力してください";
  for (const lang of LANGS) {
    if (company[lang].length > 100)
      errors[fieldName("company", lang)] = `${label("会社名", lang)}は100文字以内にしてください`;
    if (projectName[lang].length > 100)
      errors[fieldName("project_name", lang)] = `${label("プロジェクト名", lang)}は100文字以内にしてください`;
    if (duties[lang].length > 4000)
      errors[fieldName("duties", lang)] = `${label("職務内容", lang)}は4000文字以内にしてください`;
  }
  if (technologies.length > 30 || technologies.some((t) => t.length > 50))
    errors.technologies = "利用技術は30個まで、1つ50文字以内にしてください";
  const validPositions = positions.filter(isPosition);
  if (validPositions.length !== positions.length) errors.positions = "ポジションは一覧から選んでください";

  return result(errors, values, {
    startYm,
    endYm: endYm || null,
    company,
    projectName,
    duties,
    technologies,
    positions: validPositions,
  });
}

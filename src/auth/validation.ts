const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredentialsResult =
  | { ok: true; email: string; password: string }
  | { ok: false; errors: Partial<Record<"email" | "password", string>>; email: string };

/** Trim surrounding whitespace from email addresses and lowercase them (so sign-up and login match) */
export const normalizeEmail = (v: unknown): string =>
  String(v ?? "")
    .trim()
    .toLowerCase();

export function validateCredentials(form: Record<string, unknown>): CredentialsResult {
  const email = normalizeEmail(form.email);
  const password = String(form.password ?? "");
  const errors: Partial<Record<"email" | "password", string>> = {};
  if (email.length > 254 || !EMAIL.test(email)) errors.email = "メールアドレスの形式が正しくありません";
  if (password.length < 12 || password.length > 128)
    errors.password = "パスワードは12文字以上128文字以下にしてください";
  return Object.keys(errors).length > 0 ? { ok: false, errors, email } : { ok: true, email, password };
}

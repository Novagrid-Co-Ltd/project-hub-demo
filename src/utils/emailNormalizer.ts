export function normalizeEmail(email: string): string {
  return email.toLowerCase().replace(/@novagrid\.co\.jp$/i, "@novagrid.tech");
}

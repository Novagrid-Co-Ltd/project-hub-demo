import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export interface Config {
  // Google OAuth (legacy — optional when SA is configured)
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;

  // Google Service Account (optional — takes precedence over OAuth)
  googleSaCredentials: string;
  googleImpersonateEmail: string;
  workspaceDomain: string;

  geminiApiKey: string;
  openaiApiKey: string;
  llmProvider: "gemini" | "openai";
  supabaseUrl: string;
  supabaseServiceKey: string;
  apiKey: string;
  calendarId: string;
  driveFolderId: string;
  adminEmail: string;
  calendarLookbackDays: number;
  quickchartBaseUrl: string;
  port: number;
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    const hasSa = !!process.env["GOOGLE_SA_CREDENTIALS"];

    _config = {
      // OAuth vars are optional when SA is configured
      googleClientId: hasSa ? (process.env["GOOGLE_CLIENT_ID"] || "") : requireEnv("GOOGLE_CLIENT_ID"),
      googleClientSecret: hasSa ? (process.env["GOOGLE_CLIENT_SECRET"] || "") : requireEnv("GOOGLE_CLIENT_SECRET"),
      googleRefreshToken: hasSa ? (process.env["GOOGLE_REFRESH_TOKEN"] || "") : requireEnv("GOOGLE_REFRESH_TOKEN"),

      // SA vars
      googleSaCredentials: process.env["GOOGLE_SA_CREDENTIALS"] || "",
      googleImpersonateEmail: process.env["GOOGLE_IMPERSONATE_EMAIL"] || "",
      workspaceDomain: process.env["WORKSPACE_DOMAIN"] || "",

      geminiApiKey: process.env["GEMINI_API_KEY"] || "",
      openaiApiKey: process.env["OPENAI_API_KEY"] || "",
      llmProvider: (optionalEnv("LLM_PROVIDER", "gemini") as "gemini" | "openai"),
      supabaseUrl: requireEnv("SUPABASE_URL"),
      supabaseServiceKey: requireEnv("SUPABASE_SERVICE_KEY"),
      apiKey: requireEnv("API_KEY"),
      calendarId: optionalEnv("CALENDAR_ID", "ren.fujioka@novagrid.tech"),
      driveFolderId: process.env["DRIVE_FOLDER_ID"] || "",
      adminEmail: process.env["ADMIN_EMAIL"] || "",
      calendarLookbackDays: parseInt(optionalEnv("CALENDAR_LOOKBACK_DAYS", "14"), 10),
      quickchartBaseUrl: optionalEnv("QUICKCHART_BASE_URL", "https://quickchart.io"),
      port: parseInt(optionalEnv("PORT", "8080"), 10),
    };
  }
  return _config;
}

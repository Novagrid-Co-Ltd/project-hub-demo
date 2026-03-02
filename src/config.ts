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
  geminiApiKey: string;
  openaiApiKey: string;
  llmProvider: "gemini" | "openai";
  supabaseUrl: string;
  supabaseServiceKey: string;
  apiKey: string;
  port: number;
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = {
      geminiApiKey: process.env["GEMINI_API_KEY"] || "",
      openaiApiKey: process.env["OPENAI_API_KEY"] || "",
      llmProvider: (optionalEnv("LLM_PROVIDER", "openai") as "gemini" | "openai"),
      supabaseUrl: requireEnv("SUPABASE_URL"),
      supabaseServiceKey: requireEnv("SUPABASE_SERVICE_KEY"),
      apiKey: requireEnv("API_KEY"),
      port: parseInt(optionalEnv("PORT", "8080"), 10),
    };
  }
  return _config;
}

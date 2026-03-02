import { getConfig } from "../config.js";
import { sanitizeAndParseJson } from "../utils/jsonSanitizer.js";
import { logger } from "../utils/logger.js";

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

interface OpenAIApiResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${getConfig().geminiApiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as GeminiApiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function callOpenAI(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getConfig().openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as OpenAIApiResponse;
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

async function callLLM(prompt: string): Promise<string> {
  const provider = getConfig().llmProvider;
  logger.info(`Calling LLM (${provider})`);
  if (provider === "openai") {
    return callOpenAI(prompt);
  }
  return callGemini(prompt);
}

export async function generateAndParse<T>(prompt: string): Promise<{ parsed: T | null; raw: string }> {
  const raw = await callLLM(prompt);
  const parsed = sanitizeAndParseJson<T>(raw);

  if (parsed !== null) {
    return { parsed, raw };
  }

  // Retry once on parse failure
  logger.warn("LLM JSON parse failed, retrying once");
  const retryRaw = await callLLM(prompt);
  const retryParsed = sanitizeAndParseJson<T>(retryRaw);

  return { parsed: retryParsed, raw: retryRaw };
}

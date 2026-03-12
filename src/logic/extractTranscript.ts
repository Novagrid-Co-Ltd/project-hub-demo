import type { DocsDocument, DocsTab, DocsContentElement } from "../services/googleDocs.js";
import { AppError } from "../types/api.js";

export interface ExtractedTranscript {
  transcript: string;
  summary: string;
  eid: string;
  documentId: string;
  transcriptTabId: string;
  transcriptTitle: string;
  charCount: number;
}

function isTranscriptTab(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("文字起こし") || lower.includes("transcript");
}

function extractTextFromContent(content: DocsContentElement[]): string {
  const parts: string[] = [];
  for (const element of content) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
  }
  return parts.join("");
}

function extractEidFromTabs(tabs: DocsTab[]): string {
  for (const tab of tabs) {
    const content = tab.documentTab?.body?.content;
    if (!content) continue;
    for (const element of content) {
      if (element.paragraph?.elements) {
        for (const el of element.paragraph.elements) {
          const uri = el.richLink?.richLinkProperties?.uri;
          if (uri) {
            const match = uri.match(/[?&]eid=([A-Za-z0-9_-]+)/);
            if (match) return match[1]!;
          }
        }
      }
    }
  }
  return "";
}

export function extractTranscript(doc: DocsDocument): ExtractedTranscript {
  const tabs = doc.tabs ?? [];

  // Find transcript tab
  let transcriptTab: DocsTab | undefined;
  for (const tab of tabs) {
    const title = tab.tabProperties?.title ?? "";
    if (isTranscriptTab(title)) {
      transcriptTab = tab;
      break;
    }
  }

  if (!transcriptTab) {
    throw new AppError({
      code: "TRANSCRIPT_NOT_FOUND",
      message: "No transcript tab found in document",
      step: "extractTranscript",
      statusCode: 422,
    });
  }

  const content = transcriptTab.documentTab?.body?.content ?? [];
  const transcript = extractTextFromContent(content);
  const eid = extractEidFromTabs(tabs);

  // Extract summary from non-transcript tabs (typically the main/first tab)
  const summaryParts: string[] = [];
  for (const tab of tabs) {
    const title = tab.tabProperties?.title ?? "";
    if (isTranscriptTab(title)) continue;
    const tabContent = tab.documentTab?.body?.content ?? [];
    const text = extractTextFromContent(tabContent).trim();
    if (text) summaryParts.push(text);
  }
  const summary = summaryParts.join("\n\n");

  return {
    transcript,
    summary,
    eid,
    documentId: doc.documentId,
    transcriptTabId: transcriptTab.tabProperties?.tabId ?? "",
    transcriptTitle: transcriptTab.tabProperties?.title ?? "",
    charCount: transcript.length,
  };
}

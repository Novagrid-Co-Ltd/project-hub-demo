import { getAuthClient } from "./googleAuth.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../types/api.js";

export interface DocsDocument {
  documentId: string;
  title: string;
  tabs?: DocsTab[];
}

export interface DocsTab {
  tabProperties?: { tabId: string; title: string };
  documentTab?: {
    body?: {
      content?: DocsContentElement[];
    };
  };
}

export interface DocsContentElement {
  paragraph?: {
    elements?: Array<{
      textRun?: { content: string };
      richLink?: { richLinkProperties?: { uri: string } };
    }>;
  };
}

export async function getDocument(documentId: string, subjectEmail?: string): Promise<DocsDocument> {
  const client = await getAuthClient(subjectEmail);
  const url = `https://docs.googleapis.com/v1/documents/${documentId}?includeTabsContent=true`;
  logger.info("Fetching Google Doc", { documentId });

  try {
    const res = await client.request<DocsDocument>({ url });
    return res.data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      throw new AppError({
        code: "DOCUMENT_NOT_FOUND",
        message: `Google Docsドキュメントが見つかりません (fileId: ${documentId})`,
        step: "fetch_document",
        statusCode: 404,
      });
    }
    if (status === 403) {
      throw new AppError({
        code: "DOCUMENT_ACCESS_DENIED",
        message: `Google Docsドキュメントへのアクセス権がありません (fileId: ${documentId})`,
        step: "fetch_document",
        statusCode: 403,
      });
    }
    throw err;
  }
}

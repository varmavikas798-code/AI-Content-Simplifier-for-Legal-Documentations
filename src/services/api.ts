import { demoAnalysis, demoDocuments, toListItem } from "../data/demo";
import type { ChatResponse, DocumentListItem, LegalDocument } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";
const localDocuments = new Map(demoDocuments.map((document) => [document.id, structuredClone(document)]));
let demoMode = false;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, signal: controller.signal });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "The request could not be completed." }));
      throw new Error(body.message ?? "The request could not be completed.");
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function demoUpload(file: File): LegalDocument {
  const id = `demo-${Date.now()}`;
  const offlineAnalysis = {
    ...structuredClone(demoAnalysis),
    plainLanguageSummary: "The Spring Boot analysis service is offline, so this uploaded document has not been analyzed. Start the backend and upload it again to extract document-grounded findings.",
    highlights: ["The file was accepted for interface preview only.", "No facts, dates, obligations, or risks were inferred without readable document text."],
    importantDates: [],
    keyTerms: [],
    risks: [],
    uncertaintyNote: "No document analysis was performed. The sample documents remain available for exploring completed results.",
  };
  const document: LegalDocument = {
    id,
    name: file.name,
    documentType: "Unprocessed legal document",
    status: "READY",
    uploadedAt: new Date().toISOString(),
    pageCount: Math.max(1, Math.round(file.size / 65_000)),
    fileSize: file.size,
    analysis: offlineAnalysis,
    extractedText: "Demo analysis is active because the Spring Boot API is offline. Start the backend to extract and analyze the uploaded document text.",
    errorMessage: null,
  };
  localDocuments.set(id, document);
  return document;
}

export const documentApi = {
  async list(): Promise<DocumentListItem[]> {
    if (!demoMode) {
      try {
        return await request<DocumentListItem[]>("/documents");
      } catch {
        demoMode = true;
      }
    }
    return [...localDocuments.values()].sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt)).map(toListItem);
  },

  async get(id: string): Promise<LegalDocument> {
    if (!demoMode) {
      try {
        return await request<LegalDocument>(`/documents/${id}`);
      } catch {
        demoMode = true;
      }
    }
    const document = localDocuments.get(id);
    if (!document) throw new Error("Document not found.");
    return structuredClone(document);
  },

  async upload(file: File): Promise<LegalDocument> {
    const data = new FormData();
    data.append("file", file);
    if (!demoMode) {
      try {
        return await request<LegalDocument>("/documents", { method: "POST", body: data });
      } catch {
        demoMode = true;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2_200));
    return demoUpload(file);
  },

  async delete(id: string): Promise<void> {
    if (!demoMode) {
      try {
        await request<void>(`/documents/${id}`, { method: "DELETE" });
        return;
      } catch {
        demoMode = true;
      }
    }
    localDocuments.delete(id);
  },

  async chat(id: string, question: string): Promise<ChatResponse> {
    if (!demoMode) {
      try {
        return await request<ChatResponse>(`/documents/${id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
      } catch {
        demoMode = true;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    if (id.startsWith("demo-")) {
      return { answer: "I cannot answer from this upload because the document text was not processed while the Spring Boot API was offline. Start the backend and upload the file again.", sources: [], foundInDocument: false, disclaimer: demoAnalysis.disclaimer };
    }
    const normalized = question.toLowerCase();
    const risk = demoAnalysis.risks[0];
    const date = demoAnalysis.importantDates[0];
    if (/renew|deadline|date|expire|notice/.test(normalized)) {
      return { answer: `The lease requires written non-renewal notice at least 90 days before the term ends. The inferred deadline is ${date.isoDate}. Confirm the calculation against the complete agreement.`, sources: [date.source], foundInDocument: true, disclaimer: demoAnalysis.disclaimer };
    }
    if (/risk|guarant|liability|concern/.test(normalized)) {
      return { answer: `${risk.title}. ${risk.whyItMatters}`, sources: [risk.source], foundInDocument: true, disclaimer: demoAnalysis.disclaimer };
    }
    if (/rent|pay|fee|cost/.test(normalized)) {
      return { answer: "The document states that base rent is $8,500 per month and is due in advance on the first day of each calendar month.", sources: [demoAnalysis.keyTerms[0].source], foundInDocument: true, disclaimer: demoAnalysis.disclaimer };
    }
    return { answer: "I could not find that information in this document. Try asking about a named clause, date, payment, party, or obligation that appears in the text.", sources: [], foundInDocument: false, disclaimer: demoAnalysis.disclaimer };
  },
};
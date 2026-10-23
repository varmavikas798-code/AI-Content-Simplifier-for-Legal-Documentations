export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type DocumentStatus = "PROCESSING" | "READY" | "ERROR";

export interface SourceReference {
  page: number;
  passage: string;
}

export interface ImportantDate {
  id: string;
  label: string;
  dateText: string;
  isoDate: string | null;
  urgency: string;
  inferred: boolean;
  source: SourceReference;
}

export interface KeyTerm {
  id: string;
  title: string;
  detail: string;
  party: string;
  source: SourceReference;
}

export interface RiskFinding {
  id: string;
  level: RiskLevel;
  title: string;
  whyItMatters: string;
  source: SourceReference;
}

export interface Analysis {
  plainLanguageSummary: string;
  highlights: string[];
  importantDates: ImportantDate[];
  keyTerms: KeyTerm[];
  risks: RiskFinding[];
  uncertaintyNote: string;
  disclaimer: string;
}

export interface LegalDocument {
  id: string;
  name: string;
  documentType: string;
  status: DocumentStatus;
  uploadedAt: string;
  pageCount: number;
  fileSize: number;
  analysis: Analysis | null;
  extractedText: string;
  errorMessage: string | null;
}

export interface DocumentListItem {
  id: string;
  name: string;
  documentType: string;
  status: DocumentStatus;
  uploadedAt: string;
  pageCount: number;
  riskCount: number;
  highestRisk: RiskLevel | "NONE";
  nextDate: string | null;
}

export interface ChatResponse {
  answer: string;
  sources: SourceReference[];
  foundInDocument: boolean;
  disclaimer: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
}
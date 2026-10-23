import type { Analysis, DocumentListItem, LegalDocument } from "../types";

export const demoAnalysis: Analysis = {
  plainLanguageSummary:
    "This commercial lease sets the terms for office space between Northstar Properties and Acme Design Co. It runs through March 31, 2027, requires monthly rent and insurance, and renews automatically unless timely written notice is given.",
  highlights: [
    "Monthly base rent is due on the first day of each month.",
    "The lease renews automatically unless either party gives 90 days' written notice.",
    "The tenant is responsible for specified insurance and interior repairs.",
  ],
  importantDates: [
    {
      id: "date-1",
      label: "Non-renewal notice",
      dateText: "at least ninety (90) days before the end of the Term",
      isoDate: "2026-12-31",
      urgency: "Action needed",
      inferred: true,
      source: { page: 11, passage: "Either party must give written notice at least ninety (90) days before the end of the Term." },
    },
    {
      id: "date-2",
      label: "Lease expiry",
      dateText: "March 31, 2027",
      isoDate: "2027-03-31",
      urgency: "Upcoming",
      inferred: false,
      source: { page: 2, passage: "The Term begins April 1, 2024 and ends March 31, 2027." },
    },
    {
      id: "date-3",
      label: "Monthly rent",
      dateText: "the first day of each calendar month",
      isoDate: null,
      urgency: "Recurring",
      inferred: false,
      source: { page: 4, passage: "Tenant shall pay Base Rent in advance on the first day of each calendar month." },
    },
  ],
  keyTerms: [
    {
      id: "term-1",
      title: "Base rent",
      detail: "$8,500 per month, due in advance on the first day of each month.",
      party: "Tenant",
      source: { page: 4, passage: "Tenant shall pay Base Rent of $8,500 per month in advance on the first day of each calendar month." },
    },
    {
      id: "term-2",
      title: "Insurance",
      detail: "Maintain commercial general liability coverage of at least $2,000,000.",
      party: "Tenant",
      source: { page: 8, passage: "Tenant shall maintain commercial general liability insurance with limits no less than $2,000,000." },
    },
    {
      id: "term-3",
      title: "Repairs and maintenance",
      detail: "Tenant handles interior, non-structural repairs; landlord handles structural systems.",
      party: "Both parties",
      source: { page: 7, passage: "Tenant is responsible for interior non-structural repairs. Landlord shall maintain structural systems." },
    },
    {
      id: "term-4",
      title: "Security deposit",
      detail: "$17,000 held as security for performance of the tenant's obligations.",
      party: "Tenant",
      source: { page: 5, passage: "Tenant shall deliver a security deposit in the amount of $17,000." },
    },
  ],
  risks: [
    {
      id: "risk-1",
      level: "HIGH",
      title: "Personal guaranty continues through renewal",
      whyItMatters: "The guaranty appears to extend into renewal terms. This may expose the guarantor beyond the initial lease term and should be reviewed in context.",
      source: { page: 19, passage: "Guarantor unconditionally guarantees all obligations during the Term and any extension or renewal." },
    },
    {
      id: "risk-2",
      level: "MEDIUM",
      title: "Automatic renewal",
      whyItMatters: "Missing the 90-day notice window may commit the parties to another year. Consider calendaring the inferred notice deadline.",
      source: { page: 11, passage: "The Lease automatically renews for one additional year unless timely notice is given." },
    },
    {
      id: "risk-3",
      level: "LOW",
      title: "Late payment fee",
      whyItMatters: "A 5% fee applies after the stated grace period. Confirm how it interacts with other default remedies.",
      source: { page: 5, passage: "Payments more than five (5) days late are subject to a fee equal to 5% of the unpaid amount." },
    },
  ],
  uncertaintyNote: "The non-renewal date is inferred from the stated 90-day period. Confirm the calculation against the complete agreement and applicable calendar rules.",
  disclaimer: "This analysis provides general information, not legal advice. Consult a qualified lawyer for important decisions.",
};

const extractedLease = `COMMERCIAL LEASE AGREEMENT

This Commercial Lease Agreement is entered into between Northstar Properties, LLC ("Landlord") and Acme Design Co. ("Tenant").

2. TERM. The Term begins April 1, 2024 and ends March 31, 2027.

4. BASE RENT. Tenant shall pay Base Rent of $8,500 per month in advance on the first day of each calendar month.

5. LATE PAYMENT. Payments more than five (5) days late are subject to a fee equal to 5% of the unpaid amount.

8. INSURANCE. Tenant shall maintain commercial general liability insurance with limits no less than $2,000,000.

11. RENEWAL. The Lease automatically renews for one additional year unless either party gives written notice at least ninety (90) days before the end of the Term.

19. GUARANTY. Guarantor unconditionally guarantees all obligations during the Term and any extension or renewal.`;

export const demoDocuments: LegalDocument[] = [
  {
    id: "lease-001",
    name: "Acme Office Lease.pdf",
    documentType: "Lease Agreement",
    status: "READY",
    uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    pageCount: 24,
    fileSize: 1_840_200,
    analysis: demoAnalysis,
    extractedText: extractedLease,
    errorMessage: null,
  },
  {
    id: "employment-002",
    name: "Employment Offer - Rivera.pdf",
    documentType: "Employment Document",
    status: "READY",
    uploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    pageCount: 6,
    fileSize: 482_100,
    analysis: { ...demoAnalysis, plainLanguageSummary: "This employment offer describes the role, start date, compensation, confidentiality duties, and termination terms for the proposed employment relationship.", importantDates: [demoAnalysis.importantDates[1]], risks: [demoAnalysis.risks[2]] },
    extractedText: "EMPLOYMENT OFFER\n\nThis letter confirms the terms of employment, including compensation, benefits, confidentiality, and termination procedures.",
    errorMessage: null,
  },
  {
    id: "notice-003",
    name: "Notice of Rent Adjustment.pdf",
    documentType: "Legal Notice",
    status: "READY",
    uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    pageCount: 3,
    fileSize: 219_500,
    analysis: { ...demoAnalysis, plainLanguageSummary: "This notice informs the recipient of a rent adjustment and states when the new monthly amount becomes effective.", keyTerms: demoAnalysis.keyTerms.slice(0, 1), risks: [] },
    extractedText: "NOTICE OF RENT ADJUSTMENT\n\nThis notice confirms the adjusted monthly rent and its effective date. Please retain a copy for your records.",
    errorMessage: null,
  },
];

export function toListItem(document: LegalDocument): DocumentListItem {
  const risks = document.analysis?.risks ?? [];
  const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const highest = [...risks].sort((a, b) => priority[a.level] - priority[b.level])[0]?.level ?? "NONE";
  return {
    id: document.id,
    name: document.name,
    documentType: document.documentType,
    status: document.status,
    uploadedAt: document.uploadedAt,
    pageCount: document.pageCount,
    riskCount: risks.length,
    highestRisk: highest,
    nextDate: document.analysis?.importantDates[0]?.dateText ?? null,
  };
}
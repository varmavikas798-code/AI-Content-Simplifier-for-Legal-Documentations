package com.legaldoc.analyzer.service;

import com.legaldoc.analyzer.model.ApiModels.Analysis;
import com.legaldoc.analyzer.model.ApiModels.ChatResponse;
import com.legaldoc.analyzer.model.ApiModels.DocumentListItem;
import com.legaldoc.analyzer.model.ApiModels.DocumentResponse;
import com.legaldoc.analyzer.model.ApiModels.ImportantDate;
import com.legaldoc.analyzer.model.ApiModels.KeyTerm;
import com.legaldoc.analyzer.model.ApiModels.RiskFinding;
import com.legaldoc.analyzer.model.ApiModels.SourceReference;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DocumentService {

    private static final String DISCLAIMER = "This analysis provides general information, not legal advice. Consult a qualified lawyer for important decisions.";
    private static final Pattern WRITTEN_DATE = Pattern.compile("\\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern NUMERIC_DATE = Pattern.compile("\\b(?:0?[1-9]|1[0-2])[/.-](?:0?[1-9]|[12]\\d|3[01])[/.-](?:19|20)\\d{2}\\b");
    private static final Pattern SENTENCE_BREAK = Pattern.compile("(?<=[.!?])\\s+");
    private static final Set<String> STOP_WORDS = Set.of("what", "when", "where", "which", "that", "this", "with", "from", "does", "document", "about", "have", "your", "there", "their", "would", "could", "should");

    private final ConcurrentHashMap<String, StoredDocument> documents = new ConcurrentHashMap<>();

    public DocumentService() {
        seedDemoDocuments();
    }

    public List<DocumentListItem> list() {
        return documents.values().stream()
                .sorted(Comparator.comparing((StoredDocument item) -> item.response().uploadedAt()).reversed())
                .map(this::toListItem)
                .toList();
    }

    public DocumentResponse get(String id) {
        return findStored(id).response();
    }

    public DocumentResponse upload(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a non-empty PDF or text document.");
        }

        String fileName = file.getOriginalFilename() == null ? "uploaded-document.pdf" : file.getOriginalFilename();
        String lowerName = fileName.toLowerCase(Locale.ROOT);
        if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".txt")) {
            throw new IllegalArgumentException("Only PDF and text documents are supported in this demo.");
        }

        String id = UUID.randomUUID().toString();
        byte[] bytes = file.getBytes();
        DocumentResponse processing = new DocumentResponse(
                id,
                fileName,
                "Detecting document type",
                "PROCESSING",
                Instant.now(),
                0,
                file.getSize(),
                null,
                "",
                null
        );
        documents.put(id, new StoredDocument(processing, List.of()));

        CompletableFuture.runAsync(() -> processUpload(id, fileName, lowerName, bytes));
        return processing;
    }

    public void delete(String id) {
        if (documents.remove(id) == null) {
            throw new DocumentNotFoundException(id);
        }
    }

    public ChatResponse chat(String id, String question) {
        StoredDocument stored = findStored(id);
        DocumentResponse document = stored.response();
        if (!"READY".equals(document.status()) || document.analysis() == null) {
            return new ChatResponse("The document is still being processed. Ask again when the analysis is ready.", List.of(), false, DISCLAIMER);
        }

        String normalized = question.toLowerCase(Locale.ROOT);
        if (containsAny(normalized, "date", "deadline", "renew", "expire", "payment due")) {
            List<ImportantDate> dates = document.analysis().importantDates();
            if (!dates.isEmpty()) {
                ImportantDate date = dates.get(0);
                return new ChatResponse(
                        date.label() + ": " + date.dateText() + ". " + (date.inferred() ? "This timing is inferred from a stated period." : "The date is stated explicitly."),
                        List.of(date.source()),
                        true,
                        DISCLAIMER
                );
            }
        }

        if (containsAny(normalized, "risk", "concern", "penalty", "terminate", "liability")) {
            List<RiskFinding> risks = document.analysis().risks();
            if (!risks.isEmpty()) {
                RiskFinding risk = risks.get(0);
                return new ChatResponse(risk.title() + ": " + risk.whyItMatters(), List.of(risk.source()), true, DISCLAIMER);
            }
        }

        if (containsAny(normalized, "must", "obligation", "responsible", "pay", "fee")) {
            List<KeyTerm> terms = document.analysis().keyTerms();
            if (!terms.isEmpty()) {
                KeyTerm term = terms.get(0);
                return new ChatResponse(term.title() + ": " + term.detail(), List.of(term.source()), true, DISCLAIMER);
            }
        }

        PassageMatch match = findBestPassage(stored.pages(), question);
        if (match != null) {
            return new ChatResponse(
                    "The most relevant passage says: \"" + abbreviate(match.passage(), 260) + "\" I have limited the answer to the document wording.",
                    List.of(new SourceReference(match.page(), abbreviate(match.passage(), 220))),
                    true,
                    DISCLAIMER
            );
        }

        return new ChatResponse(
                "I could not find that information in this document. Try asking about a named party, clause, date, payment, or obligation that appears in the text.",
                List.of(),
                false,
                DISCLAIMER
        );
    }

    private void processUpload(String id, String fileName, String lowerName, byte[] bytes) {
        try {
            Thread.sleep(1_250);
            ExtractedContent extracted = lowerName.endsWith(".pdf") ? extractPdf(bytes) : extractText(bytes);
            String type = detectDocumentType(fileName + " " + extracted.text());
            Analysis analysis = analyze(extracted.pages(), type);
            StoredDocument current = findStored(id);
            DocumentResponse ready = new DocumentResponse(
                    id,
                    fileName,
                    type,
                    "READY",
                    current.response().uploadedAt(),
                    extracted.pages().size(),
                    current.response().fileSize(),
                    analysis,
                    abbreviate(extracted.text(), 18_000),
                    null
            );
            documents.put(id, new StoredDocument(ready, extracted.pages()));
        } catch (Exception exception) {
            documents.computeIfPresent(id, (key, current) -> new StoredDocument(
                    new DocumentResponse(
                            current.response().id(),
                            current.response().name(),
                            "Unknown document",
                            "ERROR",
                            current.response().uploadedAt(),
                            0,
                            current.response().fileSize(),
                            null,
                            "",
                            "The document could not be read. It may be encrypted, scanned without OCR, or damaged."
                    ),
                    List.of()
            ));
        }
    }

    private ExtractedContent extractPdf(byte[] bytes) throws IOException {
        try (PDDocument pdf = Loader.loadPDF(bytes)) {
            if (pdf.isEncrypted()) {
                throw new IllegalArgumentException("Encrypted PDFs are not supported.");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            List<String> pages = new ArrayList<>();
            for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                pages.add(stripper.getText(pdf).trim());
            }
            return new ExtractedContent(String.join("\n\n", pages), pages);
        }
    }

    private ExtractedContent extractText(byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8).trim();
        return new ExtractedContent(text, List.of(text));
    }

    private Analysis analyze(List<String> pages, String type) {
        String fullText = String.join("\n", pages).trim();
        if (fullText.isBlank()) {
            return new Analysis(
                    "No readable text was found. The file may contain scanned images and may require OCR before it can be analyzed.",
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    "The document text is unreadable, so no dates, obligations, or risks were inferred.",
                    DISCLAIMER
            );
        }

        List<ImportantDate> dates = extractDates(pages);
        List<KeyTerm> terms = extractObligations(pages);
        List<RiskFinding> risks = extractRisks(pages);
        List<String> highlights = new ArrayList<>();
        highlights.add("Detected as " + type.toLowerCase(Locale.ROOT) + " based on the available text.");
        highlights.add(dates.isEmpty() ? "No explicit calendar dates were found." : dates.size() + " date reference" + (dates.size() == 1 ? " was" : "s were") + " found.");
        highlights.add(terms.isEmpty() ? "No clear must/shall obligation was found in the readable text." : terms.size() + " potential obligation" + (terms.size() == 1 ? " was" : "s were") + " identified.");

        return new Analysis(
                "This appears to be a " + type.toLowerCase(Locale.ROOT) + ". The review is limited to readable text and identifies stated dates, duties, and clauses that may deserve closer attention. It does not determine legal effect or enforceability.",
                highlights,
                dates,
                terms,
                risks,
                "Automated review can miss context, handwritten changes, exhibits, or text embedded in images. Confirm important details against the original document.",
                DISCLAIMER
        );
    }

    private List<ImportantDate> extractDates(List<String> pages) {
        List<ImportantDate> dates = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < pages.size() && dates.size() < 8; pageIndex++) {
            String page = pages.get(pageIndex);
            Matcher written = WRITTEN_DATE.matcher(page);
            Matcher numeric = NUMERIC_DATE.matcher(page);
            while (written.find() && dates.size() < 8) {
                dates.add(toDateFinding(dates.size(), written.group(), sentenceAround(page, written.start()), pageIndex + 1));
            }
            while (numeric.find() && dates.size() < 8) {
                dates.add(toDateFinding(dates.size(), numeric.group(), sentenceAround(page, numeric.start()), pageIndex + 1));
            }
        }
        return dates;
    }

    private ImportantDate toDateFinding(int index, String date, String passage, int page) {
        String lower = passage.toLowerCase(Locale.ROOT);
        String label = containsAny(lower, "renew", "extension") ? "Renewal date"
                : containsAny(lower, "pay", "payment", "due") ? "Payment date"
                : containsAny(lower, "expire", "end", "termination") ? "Expiry or termination date"
                : "Date mentioned";
        return new ImportantDate("date-" + index, label, date, null, "Review", false, new SourceReference(page, abbreviate(passage, 240)));
    }

    private List<KeyTerm> extractObligations(List<String> pages) {
        List<KeyTerm> terms = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < pages.size() && terms.size() < 6; pageIndex++) {
            for (String sentence : SENTENCE_BREAK.split(pages.get(pageIndex))) {
                String lower = sentence.toLowerCase(Locale.ROOT);
                if ((lower.contains(" shall ") || lower.contains(" must ") || lower.startsWith("shall ") || lower.startsWith("must ")) && sentence.length() > 24) {
                    String title = containsAny(lower, "pay", "fee", "rent") ? "Payment obligation"
                            : containsAny(lower, "notice", "notify") ? "Notice obligation"
                            : containsAny(lower, "insurance", "coverage") ? "Insurance requirement"
                            : "Required action";
                    terms.add(new KeyTerm("term-" + terms.size(), title, abbreviate(sentence.trim(), 260), "Party named in clause", new SourceReference(pageIndex + 1, abbreviate(sentence.trim(), 220))));
                    if (terms.size() == 6) break;
                }
            }
        }
        return terms;
    }

    private List<RiskFinding> extractRisks(List<String> pages) {
        List<RiskFinding> risks = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < pages.size() && risks.size() < 5; pageIndex++) {
            for (String sentence : SENTENCE_BREAK.split(pages.get(pageIndex))) {
                String lower = sentence.toLowerCase(Locale.ROOT);
                String level = null;
                String title = null;
                String reason = null;
                if (containsAny(lower, "indemnif", "unlimited liability", "waive all", "personal guarantee")) {
                    level = "HIGH";
                    title = "Broad liability language";
                    reason = "This wording may allocate substantial financial responsibility. Its effect depends on the full clause and applicable law.";
                } else if (containsAny(lower, "automatic renewal", "automatically renew", "late fee", "penalty", "sole discretion")) {
                    level = "MEDIUM";
                    title = "Timing or discretion deserves review";
                    reason = "This term may create a cost, renewal, or decision point that is easy to overlook.";
                } else if (containsAny(lower, "may terminate", "written notice", "governing law")) {
                    level = "LOW";
                    title = "Procedural term to confirm";
                    reason = "This is a common type of provision, but the required process should be understood before relying on it.";
                }
                if (level != null && sentence.length() > 25) {
                    risks.add(new RiskFinding("risk-" + risks.size(), level, title, reason, new SourceReference(pageIndex + 1, abbreviate(sentence.trim(), 240))));
                    if (risks.size() == 5) break;
                }
            }
        }
        return risks;
    }

    private String detectDocumentType(String text) {
        String normalized = text.toLowerCase(Locale.ROOT);
        if (containsAny(normalized, "lease", "landlord", "tenant")) return "Lease Agreement";
        if (containsAny(normalized, "employment", "employee", "employer")) return "Employment Document";
        if (containsAny(normalized, "court", "plaintiff", "defendant", "docket")) return "Court Paper";
        if (containsAny(normalized, "privacy policy", "terms of use", "policy")) return "Policy";
        if (containsAny(normalized, "notice of", "hereby notified")) return "Legal Notice";
        if (containsAny(normalized, "agreement", "contract", "parties")) return "Agreement";
        return "Legal Document";
    }

    private DocumentListItem toListItem(StoredDocument stored) {
        DocumentResponse response = stored.response();
        Analysis analysis = response.analysis();
        int riskCount = analysis == null ? 0 : analysis.risks().size();
        String highestRisk = analysis == null ? "NONE" : analysis.risks().stream()
                .map(RiskFinding::level)
                .min(Comparator.comparingInt(this::riskRank))
                .orElse("NONE");
        String nextDate = analysis == null || analysis.importantDates().isEmpty() ? null : analysis.importantDates().get(0).dateText();
        return new DocumentListItem(response.id(), response.name(), response.documentType(), response.status(), response.uploadedAt(), response.pageCount(), riskCount, highestRisk, nextDate);
    }

    private int riskRank(String level) {
        return switch (level) {
            case "HIGH" -> 0;
            case "MEDIUM" -> 1;
            case "LOW" -> 2;
            default -> 3;
        };
    }

    private PassageMatch findBestPassage(List<String> pages, String question) {
        Set<String> queryTerms = new LinkedHashSet<>();
        for (String word : question.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
            if (word.length() > 3 && !STOP_WORDS.contains(word)) queryTerms.add(word);
        }
        if (queryTerms.isEmpty()) return null;

        PassageMatch best = null;
        for (int pageIndex = 0; pageIndex < pages.size(); pageIndex++) {
            for (String sentence : SENTENCE_BREAK.split(pages.get(pageIndex))) {
                String normalized = sentence.toLowerCase(Locale.ROOT);
                long score = queryTerms.stream().filter(normalized::contains).count();
                if (score > 0 && (best == null || score > best.score())) {
                    best = new PassageMatch(pageIndex + 1, sentence.trim(), score);
                }
            }
        }
        return best;
    }

    private void seedDemoDocuments() {
        String leaseText = "COMMERCIAL LEASE AGREEMENT. Tenant shall pay Base Rent on the first day of each month. The current term ends March 31, 2027. This lease will automatically renew for one additional year unless either party gives at least 90 days written notice. Tenant shall maintain commercial liability insurance. Any payment more than five days late is subject to a late fee of 5%.";
        Analysis leaseAnalysis = new Analysis(
                "This commercial lease sets the terms for office space between Northstar Properties and Acme Design Co. It runs through March 31, 2027, requires monthly rent and insurance, and renews automatically unless timely written notice is given.",
                List.of("Monthly base rent is due on the first day of each month.", "The lease renews automatically unless either party gives 90 days' written notice.", "The tenant is responsible for maintaining specified insurance."),
                List.of(
                        new ImportantDate("date-1", "Lease expiry", "March 31, 2027", "2027-03-31", "Upcoming", false, new SourceReference(2, "The Term begins April 1, 2024 and ends March 31, 2027.")),
                        new ImportantDate("date-2", "Non-renewal notice", "at least ninety (90) days before the end of the Term", "2026-12-31", "Action needed", true, new SourceReference(11, "Either party must give written notice at least ninety (90) days before the end of the Term.")),
                        new ImportantDate("date-3", "Monthly rent", "the first day of each calendar month", null, "Recurring", false, new SourceReference(4, "Tenant shall pay Base Rent in advance on the first day of each calendar month."))
                ),
                List.of(
                        new KeyTerm("term-1", "Base rent", "$8,500 per month, due in advance on the first day of each month.", "Tenant", new SourceReference(4, "Tenant shall pay Base Rent of $8,500 per month in advance...")),
                        new KeyTerm("term-2", "Insurance", "Maintain commercial general liability coverage of at least $2,000,000.", "Tenant", new SourceReference(8, "Tenant shall maintain commercial general liability insurance...")),
                        new KeyTerm("term-3", "Repairs", "Tenant handles interior, non-structural repairs; landlord handles structural systems.", "Both parties", new SourceReference(7, "Tenant is responsible for interior non-structural repairs..."))
                ),
                List.of(
                        new RiskFinding("risk-1", "HIGH", "Personal guaranty continues through renewal", "The guaranty appears to extend into renewal terms. This may expose the guarantor beyond the initial lease term and should be reviewed in context.", new SourceReference(19, "Guarantor unconditionally guarantees all obligations during the Term and any extension or renewal.")),
                        new RiskFinding("risk-2", "MEDIUM", "Automatic renewal", "Missing the 90-day notice window may commit the parties to another year. Consider calendaring the inferred notice deadline.", new SourceReference(11, "The Lease automatically renews for one additional year unless timely notice is given.")),
                        new RiskFinding("risk-3", "LOW", "Late payment fee", "A 5% fee applies after the stated grace period. Confirm how it interacts with other default remedies.", new SourceReference(5, "Payments more than five (5) days late are subject to a fee equal to 5%."))
                ),
                "The notice deadline is inferred from the stated 90-day period and should be confirmed against the complete agreement and calendar rules.",
                DISCLAIMER
        );

        putSeed("lease-001", "Acme Office Lease.pdf", "Lease Agreement", 24, 1_840_200L, Instant.now().minusSeconds(7_200), leaseText, leaseAnalysis);
        putSeed("employment-002", "Employment Offer - Rivera.pdf", "Employment Document", 6, 482_100L, Instant.now().minusSeconds(86_400),
                "Employment offer. Employee shall begin work on June 16, 2026. Either party may terminate employment by written notice. Employee must protect confidential information.",
                analyze(List.of("Employment offer. Employee shall begin work on June 16, 2026. Either party may terminate employment by written notice. Employee must protect confidential information."), "Employment Document"));
        putSeed("notice-003", "Notice of Rent Adjustment.pdf", "Legal Notice", 3, 219_500L, Instant.now().minusSeconds(259_200),
                "Notice of rent adjustment. The new monthly amount is effective September 1, 2026. Payment must be received on the first day of the month.",
                analyze(List.of("Notice of rent adjustment. The new monthly amount is effective September 1, 2026. Payment must be received on the first day of the month."), "Legal Notice"));
    }

    private void putSeed(String id, String name, String type, int pages, long size, Instant uploadedAt, String text, Analysis analysis) {
        DocumentResponse response = new DocumentResponse(id, name, type, "READY", uploadedAt, pages, size, analysis, text, null);
        documents.put(id, new StoredDocument(response, List.of(text)));
    }

    private StoredDocument findStored(String id) {
        StoredDocument stored = documents.get(id);
        if (stored == null) throw new DocumentNotFoundException(id);
        return stored;
    }

    private boolean containsAny(String text, String... values) {
        for (String value : values) if (text.contains(value)) return true;
        return false;
    }

    private String sentenceAround(String text, int index) {
        int start = Math.max(0, Math.max(text.lastIndexOf('.', index), text.lastIndexOf('\n', index)) + 1);
        int period = text.indexOf('.', index);
        int line = text.indexOf('\n', index);
        int end = period < 0 ? text.length() : period + 1;
        if (line >= 0 && line < end) end = line;
        return text.substring(start, Math.min(end, text.length())).trim();
    }

    private String abbreviate(String value, int max) {
        if (value == null || value.length() <= max) return value;
        return value.substring(0, Math.max(0, max - 1)).trim() + "...";
    }

    private record StoredDocument(DocumentResponse response, List<String> pages) {
    }

    private record ExtractedContent(String text, List<String> pages) {
    }

    private record PassageMatch(int page, String passage, long score) {
    }

    public static class DocumentNotFoundException extends RuntimeException {
        public DocumentNotFoundException(String id) {
            super("Document " + id + " was not found.");
        }
    }
}
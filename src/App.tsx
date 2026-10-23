import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, ArrowLeft, Bell, CalendarDays, Check, CheckCircle2,
  ChevronRight, Database, Download, FileCheck2, FileText, LayoutDashboard,
  LoaderCircle, LockKeyhole, Menu, MoreHorizontal, PanelRight, Plus, Search,
  Send, Settings, ShieldAlert, Sparkles, Trash2, UploadCloud, User, X,
} from "lucide-react";
import { documentApi } from "./services/api";
import type { ChatMessage, DocumentListItem, LegalDocument, RiskLevel, SourceReference } from "./types";

type Route = { page: "dashboard" } | { page: "settings" } | { page: "workspace"; id: string };
type AnalysisTab = "summary" | "dates" | "terms" | "risks";
type Profile = { name: string; email: string };

const defaultProfile: Profile = { name: "VIKAS", email: "vikasvarma@gmail.com" };
const profileStorageKey = "legal-document-analyzer.profile";

function readProfile(): Profile {
  try {
    const saved = window.localStorage.getItem(profileStorageKey);
    if (!saved) return defaultProfile;
    const parsed = JSON.parse(saved) as Partial<Profile>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : defaultProfile.name,
      email: typeof parsed.email === "string" ? parsed.email : defaultProfile.email,
    };
  } catch {
    return defaultProfile;
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const } },
};

function parseRoute(): Route {
  const value = window.location.hash.replace(/^#\/?/, "");
  if (value === "settings") return { page: "settings" };
  if (value.startsWith("documents/")) return { page: "workspace", id: value.split("/")[1] };
  return { page: "dashboard" };
}

function navigate(route: Route) {
  const hash = route.page === "dashboard" ? "#/" : route.page === "settings" ? "#/settings" : `#/documents/${route.id}`;
  window.history.pushState(null, "", hash);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><i /></div>;
}

function Sidebar({ route, onUpload, profile }: { route: Route; onUpload: () => void; profile: Profile }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate({ page: "dashboard" })} aria-label="Legal Document Analyzer home">
        <BrandMark /><span><strong>Legal Document</strong><small>ANALYZER</small></span>
      </button>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <button className={route.page === "dashboard" ? "active" : ""} onClick={() => navigate({ page: "dashboard" })}><LayoutDashboard /> <span>Dashboard</span></button>
        <button className={route.page === "workspace" ? "active" : ""} onClick={() => navigate({ page: "workspace", id: "lease-001" })}><FileText /> <span>Documents</span></button>
        <button className={route.page === "settings" ? "active" : ""} onClick={() => navigate({ page: "settings" })}><Settings /> <span>Settings</span></button>
      </nav>
      <button className="sidebar-upload" onClick={onUpload}><Plus /> <span>New analysis</span></button>
      <div className="sidebar-note"><LockKeyhole /><p><strong>Private by design</strong>Your documents stay tied to your workspace.</p></div>
      <div className="sidebar-profile"><div className="avatar">{profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"}</div><div><strong>{profile.name || "Your profile"}</strong><span>{profile.email}</span></div><MoreHorizontal /></div>
    </aside>
  );
}

function MobileHeader({ onUpload }: { onUpload: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="mobile-header">
      <button className="brand compact" onClick={() => navigate({ page: "dashboard" })}><BrandMark /><span><strong>Legal Document</strong><small>ANALYZER</small></span></button>
      <div><button onClick={onUpload} aria-label="Upload document"><Plus /></button><button onClick={() => setOpen(!open)} aria-label="Open navigation"><Menu /></button></div>
      <AnimatePresence>{open && <motion.nav initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><button onClick={() => navigate({ page: "dashboard" })}>Dashboard</button><button onClick={() => navigate({ page: "workspace", id: "lease-001" })}>Documents</button><button onClick={() => navigate({ page: "settings" })}>Settings</button></motion.nav>}</AnimatePresence>
    </header>
  );
}

function Topbar({ search, setSearch }: { search: string; setSearch: (value: string) => void }) {
  return (
    <header className="topbar">
      <label className="global-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" /></label>
      <div className="topbar-actions"><span className="secure-label"><LockKeyhole /> Encrypted workspace</span><button aria-label="Notifications"><Bell /><i /></button></div>
    </header>
  );
}

function RiskBadge({ level }: { level: RiskLevel | "NONE" }) {
  if (level === "NONE") return <span className="risk-badge none">No flags</span>;
  return <span className={`risk-badge ${level.toLowerCase()}`}><i /> {level[0] + level.slice(1).toLowerCase()}</span>;
}

function formatRelative(value: string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function formatBytes(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1_000)} KB`;
}

function DocumentTable({ documents, search, loading, onOpen }: { documents: DocumentListItem[]; search: string; loading: boolean; onOpen: (id: string) => void }) {
  const filtered = documents.filter((document) => `${document.name} ${document.documentType}`.toLowerCase().includes(search.toLowerCase()));
  if (loading) return <div className="table-loading">{[1, 2, 3].map((item) => <span key={item} />)}</div>;
  if (!filtered.length) return <div className="empty-state"><FileText /><h3>No documents found</h3><p>{search ? "Try a different search." : "Upload your first legal document to begin."}</p></div>;
  return (
    <div className="document-table">
      <div className="document-row table-head"><span>Document</span><span>Type</span><span>Key date</span><span>Risk review</span><span>Analyzed</span><span /></div>
      {filtered.map((document) => (
        <button className="document-row" key={document.id} onClick={() => onOpen(document.id)}>
          <span className="document-name"><i><FileText /></i><span><strong>{document.name}</strong><small>{document.pageCount || "--"} pages</small></span></span>
          <span>{document.documentType}</span><span className="date-cell">{document.nextDate ?? "No date found"}</span>
          <span><RiskBadge level={document.highestRisk} /></span>
          <span>{document.status === "PROCESSING" ? <span className="processing-label"><LoaderCircle /> Processing</span> : formatRelative(document.uploadedAt)}</span><ChevronRight />
        </button>
      ))}
    </div>
  );
}

function UploadZone({ onFile, compact = false }: { onFile: (file: File) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const accept = (files: FileList | null) => files?.[0] && onFile(files[0]);
  return (
    <motion.button type="button" className={`upload-zone ${compact ? "compact-zone" : ""} ${dragging ? "dragging" : ""}`} onClick={() => input.current?.click()}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }} animate={{ scale: dragging ? 1.008 : 1 }} transition={{ duration: 0.2 }}>
      <input ref={input} type="file" accept="application/pdf,.pdf,.txt,text/plain" onChange={(event) => accept(event.target.files)} hidden />
      <span className="upload-icon"><UploadCloud /></span><span className="upload-copy"><strong>{compact ? "Upload another document" : "Drop a legal document here"}</strong><small>PDF or TXT, up to 20 MB</small></span><span className="browse-button">Browse files</span>
    </motion.button>
  );
}

function Dashboard({ documents, loading, search, setSearch, onFile }: { documents: DocumentListItem[]; loading: boolean; search: string; setSearch: (v: string) => void; onFile: (file: File) => void }) {
  return (
    <div className="main-column">
      <Topbar search={search} setSearch={setSearch} />
      <motion.div className="page-content dashboard-page" initial="hidden" animate="visible" variants={fadeUp}>
        <section className="dashboard-intro"><div><span className="eyebrow">DOCUMENT INTELLIGENCE</span><h1>AI Content Simplifier for Legal Documentations</h1><p>Upload any legal PDF. Get the dates, duties, and clauses that deserve your attention, in plain language.</p></div><div className="trust-line"><CheckCircle2 /><span><strong>Grounded in your document</strong>No unsupported answers or invented terms.</span></div></section>
        <UploadZone onFile={onFile} />
        <section className="recent-section"><div className="section-heading"><div><h2>Recent documents</h2><p>Your latest analyses and their most urgent findings.</p></div><button onClick={() => setSearch("")} className="text-button">View all <ChevronRight /></button></div><DocumentTable documents={documents} search={search} loading={loading} onOpen={(id) => navigate({ page: "workspace", id })} /></section>
        <footer className="legal-footer"><ShieldAlert /><p>Legal Document Analyzer provides general information, not legal advice. For decisions with legal consequences, consult a qualified lawyer.</p></footer>
      </motion.div>
    </div>
  );
}

function SourceButton({ source, onSource }: { source: SourceReference; onSource: (page: number) => void }) {
  return <button className="source-button" onClick={() => onSource(source.page)}>Page {source.page} <ChevronRight /></button>;
}

function SummaryPanel({ document, onSource }: { document: LegalDocument; onSource: (page: number) => void }) {
  const analysis = document.analysis!;
  return (
    <motion.div className="analysis-section" initial="hidden" animate="visible" variants={fadeUp}>
      <div className="analysis-title"><span><Sparkles /></span><div><p>PLAIN-LANGUAGE SUMMARY</p><h2>What this document does</h2></div></div>
      <p className="lead-summary">{analysis.plainLanguageSummary}</p><div className="summary-points">{analysis.highlights.map((item) => <div key={item}><Check /><p>{item}</p></div>)}</div>
      <div className="attention-block"><AlertCircle /><div><strong>Review note</strong><p>{analysis.uncertaintyNote}</p></div></div>
      <div className="quick-look"><div><span>NEXT KEY DATE</span><strong>{analysis.importantDates[0]?.dateText ?? "No date found"}</strong>{analysis.importantDates[0] && <SourceButton source={analysis.importantDates[0].source} onSource={onSource} />}</div><div><span>HIGHEST RISK</span><strong>{analysis.risks[0]?.title ?? "No risk flagged"}</strong>{analysis.risks[0] && <SourceButton source={analysis.risks[0].source} onSource={onSource} />}</div></div>
    </motion.div>
  );
}

function DatesPanel({ document, onSource }: { document: LegalDocument; onSource: (page: number) => void }) {
  const dates = document.analysis!.importantDates;
  return (
    <motion.div className="analysis-section" initial="hidden" animate="visible" variants={fadeUp}>
      <div className="analysis-title"><span><CalendarDays /></span><div><p>IMPORTANT DATES</p><h2>Deadlines and timing</h2></div></div><p className="section-explainer">Sorted by urgency where a date can be determined. Inferred dates are clearly marked.</p>
      {!dates.length ? <div className="empty-analysis"><CalendarDays /><h3>No dates found</h3><p>No explicit dates or clearly stated time periods were found in the readable text.</p></div> : <div className="date-timeline">{dates.map((date, index) => <motion.article key={date.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .07 }}><div className="timeline-mark"><i /></div><div className="date-body"><div className="date-meta"><span>{date.urgency}</span>{date.inferred && <em>Inferred from period</em>}</div><h3>{date.label}</h3><strong>{date.dateText}</strong><blockquote>“{date.source.passage}”</blockquote><SourceButton source={date.source} onSource={onSource} /></div></motion.article>)}</div>}
    </motion.div>
  );
}

function TermsPanel({ document, onSource }: { document: LegalDocument; onSource: (page: number) => void }) {
  const terms = document.analysis!.keyTerms;
  return (
    <motion.div className="analysis-section" initial="hidden" animate="visible" variants={fadeUp}>
      <div className="analysis-title"><span><FileCheck2 /></span><div><p>KEY TERMS & OBLIGATIONS</p><h2>Who needs to do what</h2></div></div>
      {!terms.length ? <div className="empty-analysis"><FileCheck2 /><h3>No clear obligations found</h3><p>The readable text did not contain a clear must or shall obligation.</p></div> : <div className="term-list">{terms.map((term, index) => <article key={term.id}><div className="term-number">{String(index + 1).padStart(2, "0")}</div><div><span>{term.party}</span><h3>{term.title}</h3><p>{term.detail}</p><SourceButton source={term.source} onSource={onSource} /></div></article>)}</div>}
    </motion.div>
  );
}

function RisksPanel({ document, onSource }: { document: LegalDocument; onSource: (page: number) => void }) {
  const risks = document.analysis!.risks;
  return (
    <motion.div className="analysis-section" initial="hidden" animate="visible" variants={fadeUp}>
      <div className="analysis-title"><span><ShieldAlert /></span><div><p>RISK REVIEW</p><h2>Clauses to look at twice</h2></div></div><p className="section-explainer">Potential concerns, not legal conclusions. Context and applicable law may change their significance.</p>
      {!risks.length ? <div className="empty-analysis"><CheckCircle2 /><h3>No specific risk language found</h3><p>This does not mean the document is risk-free. Review the complete document with a lawyer when needed.</p></div> : <div className="risk-list">{risks.map((risk) => <article key={risk.id} className={`risk-item ${risk.level.toLowerCase()}`}><div className="risk-item-head"><RiskBadge level={risk.level} /><SourceButton source={risk.source} onSource={onSource} /></div><h3>{risk.title}</h3><p>{risk.whyItMatters}</p><blockquote>“{risk.source.passage}”</blockquote></article>)}</div>}
    </motion.div>
  );
}

function DocumentViewer({ document, page }: { document: LegalDocument; page: number }) {
  const lines = document.extractedText.split("\n").filter(Boolean);
  return (
    <section className="document-viewer"><div className="viewer-toolbar"><span>DOCUMENT</span><div><span>Page {page} of {document.pageCount}</span><button title="Download original"><Download /></button></div></div><div className="paper-wrap"><motion.div className="paper" key={page} initial={{ opacity: .55, y: 4 }} animate={{ opacity: 1, y: 0 }}><div className="paper-brand">NORTHSTAR <span>PROPERTIES</span></div><h2>{document.documentType.toUpperCase()}</h2><div className="paper-rule" />{lines.slice(0, 14).map((line, index) => index === 0 ? <h3 key={index}>{line}</h3> : <p className={index === 3 || index === 7 ? "highlighted" : ""} key={index}>{line}</p>)}{!lines.length && <p className="muted-paper">Extracted text is not available for this page.</p>}<span className="page-number">{page}</span></motion.div></div></section>
  );
}

function ChatPanel({ document }: { document: LegalDocument }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "hello", role: "assistant", content: "Ask me about this document. I’ll answer from its text and show a source when I can." }]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim() || sending) return;
    const text = question.trim();
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: text }]); setQuestion(""); setSending(true);
    try { const response = await documentApi.chat(document.id, text); setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: response.answer, sources: response.sources }]); }
    catch (error) { setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "I could not answer right now." }]); }
    finally { setSending(false); }
  };
  return (
    <aside className="chat-panel"><div className="chat-head"><div><span><Sparkles /></span><div><strong>Ask this document</strong><small>Answers include sources</small></div></div><PanelRight /></div><div className="chat-messages" ref={scrollRef}>{messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>{message.role === "assistant" && <span className="ai-avatar">AI</span>}<div><p>{message.content}</p>{message.sources?.map((source) => <button key={`${message.id}-${source.page}`}>Page {source.page} <ChevronRight /></button>)}</div></div>)}{sending && <div className="chat-message assistant"><span className="ai-avatar">AI</span><div className="typing"><i /><i /><i /></div></div>}</div><div className="suggestions"><button onClick={() => setQuestion("When do I need to give notice?")}>Notice deadline?</button><button onClick={() => setQuestion("What are the biggest risks?")}>Biggest risks?</button></div><form className="chat-form" onSubmit={send}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this document..." rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button disabled={!question.trim() || sending} aria-label="Send question"><Send /></button></form><p className="chat-disclaimer">General information, not legal advice.</p></aside>
  );
}

function Workspace({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<AnalysisTab>("summary");
  const [page, setPage] = useState(1);
  useEffect(() => { let active = true; const load = async () => { try { const item = await documentApi.get(id); if (!active) return; setDocument(item); if (item.status === "PROCESSING") window.setTimeout(load, 1_300); } catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : "Document unavailable."); } }; load(); return () => { active = false; }; }, [id]);
  if (error) return <div className="workspace-state"><AlertTriangle /><h2>Unable to open document</h2><p>{error}</p><button onClick={() => navigate({ page: "dashboard" })}>Back to dashboard</button></div>;
  if (!document || document.status === "PROCESSING") return <div className="workspace-state processing-workspace"><LoaderCircle /><h2>Analyzing your document</h2><p>Reading pages, finding dates, and reviewing key clauses.</p></div>;
  if (document.status === "ERROR" || !document.analysis) return <div className="workspace-state"><AlertTriangle /><h2>Analysis could not be completed</h2><p>{document.errorMessage ?? "The document may be scanned, protected, or unreadable."}</p><button onClick={() => navigate({ page: "dashboard" })}>Back to dashboard</button></div>;
  const deleteDocument = async () => { if (!window.confirm(`Delete ${document.name} and all associated data?`)) return; await documentApi.delete(document.id); onDeleted(); navigate({ page: "dashboard" }); };
  return (
    <div className="workspace-page"><header className="workspace-header"><button className="back-button" onClick={() => navigate({ page: "dashboard" })}><ArrowLeft /></button><div className="workspace-doc-title"><span><FileText /></span><div><strong>{document.name}</strong><small>{document.documentType} · {document.pageCount} pages · {formatBytes(document.fileSize)}</small></div></div><div className="workspace-actions"><span className="analysis-complete"><CheckCircle2 /> Analysis complete</span><button aria-label="Delete document" onClick={deleteDocument}><Trash2 /></button><button><Download /> <span>Original</span></button></div></header><div className="workspace-grid"><DocumentViewer document={document} page={page} /><main className="analysis-pane"><div className="analysis-tabs">{(["summary", "dates", "terms", "risks"] as AnalysisTab[]).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item === "dates" ? `Dates ${document.analysis!.importantDates.length}` : item === "risks" ? `Risks ${document.analysis!.risks.length}` : item === "terms" ? "Key terms" : "Summary"}</button>)}</div><div className="analysis-scroll"><AnimatePresence mode="wait"><div key={tab}>{tab === "summary" && <SummaryPanel document={document} onSource={setPage} />}{tab === "dates" && <DatesPanel document={document} onSource={setPage} />}{tab === "terms" && <TermsPanel document={document} onSource={setPage} />}{tab === "risks" && <RisksPanel document={document} onSource={setPage} />}</div></AnimatePresence><p className="inline-disclaimer"><AlertCircle /> {document.analysis.disclaimer}</p></div></main><ChatPanel document={document} /></div></div>
  );
}

function SettingsPage({ documents, onDeleted, profile, onProfileSaved }: { documents: DocumentListItem[]; onDeleted: () => void; profile: Profile; onProfileSaved: (profile: Profile) => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [saved, setSaved] = useState(false);
  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    const updated = { name: name.trim(), email: email.trim() };
    if (!updated.name || !updated.email) return;
    onProfileSaved(updated);
    setName(updated.name);
    setEmail(updated.email);
    setSaved(true);
  };
  const remove = async (id: string, name: string) => { if (!window.confirm(`Permanently delete ${name} and its analysis?`)) return; setDeleting(id); await documentApi.delete(id); setDeleting(null); onDeleted(); };
  const deleteAll = async () => { if (!window.confirm("Permanently delete every uploaded document and analysis?")) return; for (const document of documents) await documentApi.delete(document.id); onDeleted(); };
  return (
    <div className="main-column settings-column"><header className="simple-topbar"><h1>Settings</h1><span>Manage your profile and document data.</span></header><motion.main className="settings-page" initial="hidden" animate="visible" variants={fadeUp}><section className="settings-section"><div className="settings-label"><User /><div><h2>Profile</h2><p>Basic workspace information.</p></div></div><form className="profile-form" onSubmit={saveProfile}><label>Full name<input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} required /></label><label>Email address<input value={email} onChange={(event) => { setEmail(event.target.value); setSaved(false); }} type="email" required /></label><button type="submit">Save changes</button>{saved && <span className="profile-saved" role="status">Changes saved</span>}</form></section><section className="settings-section"><div className="settings-label"><Database /><div><h2>Document data</h2><p>Deleting a file also removes extracted text, analysis, and chat history.</p></div></div><div className="settings-documents">{documents.map((document) => <div key={document.id}><span><FileText /><span><strong>{document.name}</strong><small>{document.documentType} · {formatRelative(document.uploadedAt)}</small></span></span><button disabled={deleting === document.id} onClick={() => remove(document.id, document.name)}>{deleting === document.id ? <LoaderCircle className="spin" /> : <Trash2 />} Delete</button></div>)}{!documents.length && <p className="settings-empty">No uploaded documents remain.</p>}<button className="delete-all" onClick={deleteAll} disabled={!documents.length}><Trash2 /> Delete all document data</button></div></section><section className="settings-section security-row"><div className="settings-label"><LockKeyhole /><div><h2>Privacy controls</h2><p>AI credentials are stored only on the Spring Boot server and are never sent to the browser.</p></div></div><span><CheckCircle2 /> Server-side protected</span></section></motion.main></div>
  );
}

function ProcessingOverlay({ fileName, stage }: { fileName: string; stage: number }) {
  const steps = ["Uploading securely", "Reading document text", "Finding dates and obligations", "Reviewing potential risks"];
  return (
    <motion.div className="processing-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="processing-modal" initial={{ opacity: 0, scale: .97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98 }}><div className="scan-animation"><FileText /><motion.i animate={{ y: [0, 80, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} /></div><span>ANALYZING DOCUMENT</span><h2>{fileName}</h2><p>We are grounding every result in the uploaded text.</p><div className="processing-steps">{steps.map((step, index) => <div className={index < stage ? "done" : index === stage ? "current" : ""} key={step}><span>{index < stage ? <Check /> : index === stage ? <LoaderCircle className="spin" /> : index + 1}</span>{step}</div>)}</div></motion.div></motion.div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);
  const [profile, setProfile] = useState<Profile>(readProfile);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploadInputOpen, setUploadInputOpen] = useState(false);
  const [processing, setProcessing] = useState<{ name: string; stage: number } | null>(null);
  const [toast, setToast] = useState("");
  const quickInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => { setLoading(true); try { setDocuments(await documentApi.list()); } finally { setLoading(false); } }, []);
  useEffect(() => { const updateRoute = () => setRoute(parseRoute()); window.addEventListener("popstate", updateRoute); refresh(); return () => window.removeEventListener("popstate", updateRoute); }, [refresh]);
  const upload = async (file: File) => {
    setUploadInputOpen(false);
    if (!/\.(pdf|txt)$/i.test(file.name)) { setToast("Please choose a PDF or text document."); return; }
    if (file.size > 20_000_000) { setToast("That file is larger than the 20 MB limit."); return; }
    setProcessing({ name: file.name, stage: 0 });
    const timer = window.setInterval(() => setProcessing((current) => current ? { ...current, stage: Math.min(3, current.stage + 1) } : null), 850);
    try { let result = await documentApi.upload(file); let attempts = 0; while (result.status === "PROCESSING" && attempts < 12) { await new Promise((resolve) => window.setTimeout(resolve, 1_000)); result = await documentApi.get(result.id); attempts++; } if (result.status === "ERROR") throw new Error(result.errorMessage ?? "The document could not be analyzed."); await refresh(); navigate({ page: "workspace", id: result.id }); }
    catch (error) { setToast(error instanceof Error ? error.message : "Upload failed. Please try again."); }
    finally { window.clearInterval(timer); setProcessing(null); }
  };
  const openUpload = () => { setUploadInputOpen(true); window.setTimeout(() => quickInput.current?.click(), 0); };
  const saveProfile = (updated: Profile) => {
    try { window.localStorage.setItem(profileStorageKey, JSON.stringify(updated)); } catch { /* Keep the current session usable if browser storage is unavailable. */ }
    setProfile(updated);
  };
  return (
    <div className="app-frame"><input ref={quickInput} hidden type="file" accept="application/pdf,.pdf,.txt,text/plain" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} /><Sidebar route={route} onUpload={openUpload} profile={profile} /><MobileHeader onUpload={openUpload} /><AnimatePresence mode="wait"><motion.div className="route-view" key={route.page + (route.page === "workspace" ? route.id : "")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .18 }}>{route.page === "dashboard" && <Dashboard documents={documents} loading={loading} search={search} setSearch={setSearch} onFile={upload} />}{route.page === "workspace" && <Workspace id={route.id} onDeleted={refresh} />}{route.page === "settings" && <SettingsPage documents={documents} onDeleted={refresh} profile={profile} onProfileSaved={saveProfile} />}</motion.div></AnimatePresence><AnimatePresence>{processing && <ProcessingOverlay fileName={processing.name} stage={processing.stage} />}</AnimatePresence><AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><AlertTriangle /><span>{toast}</span><button onClick={() => setToast("")}><X /></button></motion.div>}</AnimatePresence>{uploadInputOpen && <span className="sr-only">File picker open</span>}</div>
  );
}

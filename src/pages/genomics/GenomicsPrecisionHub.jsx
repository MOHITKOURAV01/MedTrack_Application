import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Award, Beaker, Bell, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, Clock, Download, Eye, FileText, Filter, Gauge,
  HeartPulse, Home, Info, Layers, Mail, MessageSquare, Pause, Phone, Play, Plus,
  RefreshCw, Search, ShieldAlert, ShieldCheck, Siren, SlidersHorizontal,
  Sparkles, Stethoscope, Syringe, Target, Timer, TrendingDown, TrendingUp,
  User, Users, X, Zap,
} from "lucide-react";
import { downloadCsv } from "../../utils/csv";

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const CLASS_META = {
  Pathogenic: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  "Likely pathogenic": { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  VUS: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  "Likely benign": { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  Benign: { cls: "bg-slate-800 text-slate-300 border-slate-700" },
};

const SEED_VARIANTS = [
  { id: "V-1701", gene: "BRCA1", hgvs: "c.5266dupC (p.Gln1756ProfsTer74)", af: 0.0003, cadd: 35, zygosity: "Het", cls: "Pathogenic", source: "Germline WES", status: "Curated", review: "Dr. Lindqvist", ref: "ClinVar 17661" },
  { id: "V-1702", gene: "EGFR", hgvs: "c.2573T>G (p.Leu858Arg)", af: 0.0008, cadd: 28, zygosity: "Somatic", cls: "Pathogenic", source: "Tumor NGS", status: "Reviewed", review: "Dr. Osei", ref: "COSMIC 6224" },
  { id: "V-1703", gene: "KRAS", hgvs: "c.34G>T (p.Gly12Cys)", af: 0.0011, cadd: 24, zygosity: "Somatic", cls: "Pathogenic", source: "Tumor NGS", status: "Reviewed", review: "Dr. Osei", ref: "COSMIC 516" },
  { id: "V-1704", gene: "MLH1", hgvs: "c.1852_1853del (p.Lys618GlufsTer2)", af: 0.0002, cadd: 31, zygosity: "Het", cls: "Pathogenic", source: "Lynch panel", status: "Curated", review: "Dr. Lindqvist", ref: "ClinVar 90564" },
  { id: "V-1705", gene: "TP53", hgvs: "c.743G>A (p.Arg248Gln)", af: 0.0004, cadd: 22, zygosity: "Somatic", cls: "Likely pathogenic", source: "Tumor NGS", status: "Pending", review: "—", ref: "COSMIC 10659" },
  { id: "V-1706", gene: "MSH2", hgvs: "c.942+2T>C (splice donor)", af: 0.0001, cadd: 33, zygosity: "Het", cls: "Pathogenic", source: "Lynch panel", status: "Reviewed", review: "Dr. Lindqvist", ref: "ClinVar 91092" },
  { id: "V-1707", gene: "ALK", hgvs: "c.3640G>C (p.Asp1214His) — EML4 fusion +", af: 0.0005, cadd: 19, zygosity: "Somatic", cls: "Pathogenic", source: "Tumor NGS", status: "Reviewed", review: "Dr. Osei", ref: "COSMIC 1730943" },
  { id: "V-1708", gene: "CHEK2", hgvs: "c.1100delC (p.Thr367MetfsTer15)", af: 0.004, cadd: 26, zygosity: "Het", cls: "Likely pathogenic", source: "HBOC panel", status: "Pending", review: "—", ref: "ClinVar 127816" },
  { id: "V-1709", gene: "PALB2", hgvs: "c.3113G>A (p.Trp1038Ter)", af: 0.0002, cadd: 30, zygosity: "Het", cls: "Pathogenic", source: "HBOC panel", status: "Curated", review: "Dr. Lindqvist", ref: "ClinVar 127832" },
  { id: "V-1710", gene: "BRAF", hgvs: "c.1799T>A (p.Val600Glu)", af: 0.0009, cadd: 21, zygosity: "Somatic", cls: "Pathogenic", source: "Tumor NGS", status: "Reviewed", review: "Dr. Osei", ref: "COSMIC 476" },
];

const PGX_META = {
  A: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  B: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  C: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  D: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
};

const SEED_PGX = [
  { id: "P-1801", patient: "Ava Thompson", gene: "CYP2C19", diplot: "*2/*2", phenotype: "Poor metabolizer", drug: "Clopidogrel", cpic: "A", action: "Use alternative antiplatelet (prasugrel/ticagrelor)", status: "Actioned" },
  { id: "P-1802", patient: "Lucas Miller", gene: "CYP2D6", diplot: "*1/*4", phenotype: "Intermediate metabolizer", drug: "Codeine → morphine", cpic: "B", action: "Monitor response; consider non-opioid alternative", status: "Reviewed" },
  { id: "P-1803", patient: "Nora Patel", gene: "VKORC1", diplot: "A/A (−1639G>A)", phenotype: "Sensitive (low-dose)", drug: "Warfarin", cpic: "A", action: "Initiate at 2–3 mg/day; frequent INR monitoring", status: "Actioned" },
  { id: "P-1804", patient: "Owen Carter", gene: "SLCO1B1", diplot: "c.521T>C (Val174Ala) het", phenotype: "Intermediate function", drug: "Simvastatin", cpic: "A", action: "Dose ≤ 20 mg/day or switch to pravastatin", status: "Actioned" },
  { id: "P-1805", patient: "Zoe Bennett", gene: "HLA-B", diplot: "B*57:01 positive", phenotype: "Positive — at risk", drug: "Abacavir", cpic: "A", action: "AVOID abacavir — high risk of hypersensitivity", status: "Actioned" },
  { id: "P-1806", patient: "Mason Reed", gene: "TPMT", diplot: "*1/*3A", phenotype: "Intermediate activity", drug: "Azathioprine", cpic: "A", action: "Start at 50% dose; monitor CBC weekly ×4", status: "Reviewed" },
  { id: "P-1807", patient: "Lily Scott", gene: "CYP2D6", diplot: "*1/*1 ×N", phenotype: "Ultrarapid metabolizer", drug: "Tamoxifen → endoxifen", cpic: "B", action: "Consider alternative endocrine therapy", status: "Pending" },
  { id: "P-1808", patient: "Henry Wu", gene: "CYP2C19", diplot: "*1/*17", phenotype: "Rapid metabolizer", drug: "Omeprazole", cpic: "B", action: "No change needed; monitor for reduced efficacy", status: "Reviewed" },
];

const SEED_HERED = [
  { id: "H-1901", patient: "Rachel Green", panel: "HBOC (14-gene)", syndrome: "HBOC — BRCA1", risk: "High", cascade: "3 of 5 relatives tested", tb: "—", next: "2026-08-22", status: "Cascade testing" },
  { id: "H-1902", patient: "Peter Novak", panel: "Lynch (MMR genes)", syndrome: "Lynch — MLH1", risk: "High", cascade: "2 of 4 relatives tested", tb: "—", next: "2026-08-25", status: "Surveillance" },
  { id: "H-1903", patient: "Sara Cohen", panel: "Tumor NGS 500-gene", syndrome: "—", risk: "—", cascade: "—", tb: "NSCLC — EGFR L858R, TMB 14", next: "2026-08-19", status: "Tumor board" },
  { id: "H-1904", patient: "James Doyle", panel: "Tumor NGS 500-gene", syndrome: "—", risk: "—", cascade: "—", tb: "Melanoma — BRAF V600E, TMB 42", next: "2026-08-19", status: "Tumor board" },
  { id: "H-1905", patient: "Alice Kim", panel: "FAP (APC)", syndrome: "FAP — APC truncating", risk: "High", cascade: "1 of 3 relatives tested", tb: "—", next: "2026-09-02", status: "Surveillance" },
  { id: "H-1906", patient: "George Hall", panel: "HBOC (14-gene)", syndrome: "Li-Fraumeni — TP53", risk: "Very high", cascade: "0 of 4 relatives tested", tb: "—", next: "2026-08-28", status: "Cascade testing" },
  { id: "H-1907", patient: "Maria Lopez", panel: "Tumor NGS 500-gene", syndrome: "—", risk: "—", cascade: "—", tb: "Colon — MSI-H, MLH1 methylated, TMB 48", next: "2026-08-20", status: "Tumor board" },
  { id: "H-1908", patient: "Tom Bailey", panel: "HBOC (14-gene)", syndrome: "HBOC — PALB2", risk: "High", cascade: "4 of 4 relatives tested", tb: "—", next: "2026-09-10", status: "Surveillance" },
];

/* ------------------------------------------------------------------ */
/*  Simulation helpers                                                 */
/* ------------------------------------------------------------------ */

const SPEEDS = [
  { label: "1×", mult: 1 },
  { label: "2×", mult: 2 },
  { label: "4×", mult: 4 },
];

const VARIANT_FLOW = ["Pending", "Curated", "Reviewed"];

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, sub, accent = "text-cyan-300" }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function Chip({ children, cls }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
        active
          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function ProgressMeter({ pct, cls = "bg-cyan-500" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function GenomicsPrecisionHub() {
  const [tab, setTab] = useState("variants");
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [lastRun, setLastRun] = useState("live");

  const [variants, setVariants] = useState(SEED_VARIANTS);
  const [pgx, setPgx] = useState(SEED_PGX);
  const [hered, setHered] = useState(SEED_HERED);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [toasts, setToasts] = useState([]);
  const [inspect, setInspect] = useState(null);

  const toastId = useRef(0);
  const tickerRef = useRef(0);

  const pushToast = useCallback((title, body, tone = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, body, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ---------------- simulation loop ---------------- */
  useEffect(() => {
    if (!running) return undefined;
    const iv = setInterval(() => setTick((t) => t + 1), 1200 / speed);
    return () => clearInterval(iv);
  }, [running, speed]);

  useEffect(() => {
    if (tick === 0) return;
    tickerRef.current += 1;
    const n = tickerRef.current;

    // Variant curation workflow advances
    setVariants((prev) =>
      prev.map((v, i) => {
        const idx = VARIANT_FLOW.indexOf(v.status);
        if (idx < 0 || idx >= VARIANT_FLOW.length - 1) return v;
        if (n % (4 + i) === 0) {
          const next = VARIANT_FLOW[idx + 1];
          return { ...v, status: next, review: next === "Reviewed" && v.review === "—" ? "Dr. Lindqvist" : v.review };
        }
        return v;
      })
    );

    // PGx: pending results get reviewed and actioned
    setPgx((prev) =>
      prev.map((p, i) => {
        if (p.status === "Pending" && n % 6 === i % 6) return { ...p, status: "Reviewed" };
        if (p.status === "Reviewed" && n % 9 === i % 9 && p.cpic === "A") return { ...p, status: "Actioned" };
        return p;
      })
    );

    // Hereditary: cascade testing ticks up; tumor board cases re-stage
    setHered((prev) =>
      prev.map((h, i) => {
        if (h.cascade !== "—") {
          const m = h.cascade.match(/(\d+) of (\d+) relatives/);
          if (m && n % 8 === i % 8) {
            const done = Math.min(+m[2], +m[1] + 1);
            const cascade = `${done} of ${m[2]} relatives tested`;
            const status = done >= +m[2] ? "Surveillance" : "Cascade testing";
            return { ...h, cascade, status };
          }
        }
        if (h.tb !== "—" && n % 12 === i % 12) return { ...h, status: "Tumor board — therapy match" };
        return h;
      })
    );

    // Toasts
    if (n % 9 === 0) pushToast("Variant curated", "TP53 c.743G>A curated as Likely pathogenic — Oncogenicity report generated.", "info");
    if (n % 13 === 0) pushToast("CPIC action", "HLA-B*57:01 positive confirmed — abacavir contraindication flagged in the EHR.", "warn");
    if (n % 17 === 0) pushToast("Cascade complete", "Tom Bailey's PALB2 cascade: all 4 relatives tested — surveillance enrolled.", "ok");
    if (n % 20 === 0) pushToast("Tumor board match", "James Doyle (BRAF V600E, TMB 42) matched to combination BRAF/MEK inhibitor + pembrolizumab.", "ok");
  }, [tick, pushToast]);

  /* ---------------- derived views ---------------- */
  const filteredVariants = useMemo(() => {
    const q = query.toLowerCase();
    return variants.filter((v) => {
      if (filter !== "All" && v.cls !== filter) return false;
      if (!q) return true;
      return [v.id, v.gene, v.hgvs, v.source, v.review].join(" ").toLowerCase().includes(q);
    });
  }, [variants, query, filter]);

  const filteredPgx = useMemo(() => {
    const q = query.toLowerCase();
    return pgx.filter((p) => {
      if (filter !== "All" && p.cpic !== filter) return false;
      if (!q) return true;
      return [p.id, p.patient, p.gene, p.diplot, p.phenotype, p.drug].join(" ").toLowerCase().includes(q);
    });
  }, [pgx, query, filter]);

  const filteredHered = useMemo(() => {
    const q = query.toLowerCase();
    return hered.filter((h) => {
      if (filter !== "All" && h.status !== filter) return false;
      if (!q) return true;
      return [h.id, h.patient, h.panel, h.syndrome, h.tb].join(" ").toLowerCase().includes(q);
    });
  }, [hered, query, filter]);

  const stats = useMemo(() => {
    const path = variants.filter((v) => v.cls === "Pathogenic" || v.cls === "Likely pathogenic").length;
    const pending = variants.filter((v) => v.status === "Pending").length;
    const levelA = pgx.filter((p) => p.cpic === "A").length;
    const actioned = pgx.filter((p) => p.status === "Actioned").length;
    const cascade = hered.filter((h) => h.status === "Cascade testing").length;
    const surveillance = hered.filter((h) => h.status === "Surveillance").length;
    const tb = hered.filter((h) => h.tb !== "—").length;
    const veryHigh = hered.filter((h) => h.risk === "Very high").length;
    return { path, pending, levelA, actioned, cascade, surveillance, tb, veryHigh };
  }, [variants, pgx, hered]);

  /* ---------------- actions ---------------- */
  const resetSim = () => {
    setVariants(SEED_VARIANTS);
    setPgx(SEED_PGX);
    setHered(SEED_HERED);
    tickerRef.current = 0;
    setLastRun("reset");
    setTimeout(() => setLastRun("live"), 1500);
    pushToast("Simulation reset", "Variant, PGx and hereditary/tumor-board state restored to baseline.", "info");
  };

  const advanceVariant = (v) => {
    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, status: "Reviewed", review: x.review === "—" ? "Dr. Lindqvist" : x.review } : x)));
    pushToast("Variant reviewed", `${v.gene} ${v.hgvs} finalised — signed out by molecular genetics.`, "ok");
  };

  const actionPgx = (p) => {
    setPgx((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "Actioned" } : x)));
    pushToast("CPIC action applied", `${p.action} — order set + EHR alert created for ${p.drug}.`, "ok");
  };

  const exportCsv = () => {
    let rows = [];
    let header = [];
    if (tab === "variants") {
      header = ["Variant ID", "Gene", "HGVS", "Allele freq", "CADD", "Zygosity", "Class", "Source", "Status", "Reviewer", "Ref"];
      rows = filteredVariants.map((v) => [v.id, v.gene, v.hgvs, v.af, v.cadd, v.zygosity, v.cls, v.source, v.status, v.review, v.ref]);
    } else if (tab === "pgx") {
      header = ["Result ID", "Patient", "Gene", "Diplotype", "Phenotype", "Drug", "CPIC", "Action", "Status"];
      rows = filteredPgx.map((p) => [p.id, p.patient, p.gene, p.diplot, p.phenotype, p.drug, p.cpic, p.action, p.status]);
    } else {
      header = ["Case ID", "Patient", "Panel", "Syndrome / Tumor board", "Risk", "Cascade", "Next", "Status"];
      rows = filteredHered.map((h) => [h.id, h.patient, h.panel, h.syndrome || h.tb, h.risk, h.cascade, h.next, h.status]);
    }
    downloadCsv(`genomics-precision-${tab}-${Date.now()}.csv`, [header, ...rows]);
    pushToast("Export ready", `${rows.length} rows exported to CSV.`, "info");
  };

  /* ---------------- render helpers ---------------- */
  const classFilters = tab === "variants" ? ["All", "Pathogenic", "Likely pathogenic", "VUS", "Likely benign", "Benign"] : null;
  const statusFilters =
    tab === "pgx" ? ["All", "A", "B", "C", "D"] : tab === "hered" ? ["All", "Cascade testing", "Surveillance", "Tumor board", "Tumor board — therapy match"] : null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-200 sm:px-6">
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 p-2">
              <Beaker className="h-5 w-5 text-fuchsia-300" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Genomics &amp; Precision Medicine</h1>
              <p className="text-xs text-slate-500">
                Variant interpretation · pharmacogenomics · hereditary risk &amp; tumor board
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${running ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-slate-600"}`} />
            {running ? "LIVE · genomics pipeline" : "PAUSED"}
          </span>
          <button onClick={() => setRunning((r) => !r)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:border-slate-600">
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s.label}
              onClick={() => setSpeed(s.mult)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                speed === s.mult ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
          <button onClick={resetSim} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-300 hover:border-slate-600">
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatCard icon={AlertTriangle} label="Pathogenic" value={stats.path} sub="actionable findings" accent="text-rose-400" />
        <StatCard icon={Clock} label="Awaiting review" value={stats.pending} sub="curation queue" accent="text-amber-400" />
        <StatCard icon={ShieldCheck} label="CPIC level A" value={stats.levelA} sub="strong guideline" accent="text-emerald-300" />
        <StatCard icon={CheckCircle2} label="PGx actioned" value={stats.actioned} sub="EHR alerts live" accent="text-cyan-300" />
        <StatCard icon={Users} label="Cascade testing" value={stats.cascade} sub="relatives pending" accent="text-violet-300" />
        <StatCard icon={CalendarDays} label="Surveillance" value={stats.surveillance} sub="screening active" accent="text-sky-300" />
        <StatCard icon={Target} label="Tumor board" value={stats.tb} sub="NGS cases staged" accent="text-fuchsia-300" />
        <StatCard icon={Zap} label="Very high risk" value={stats.veryHigh} sub="Li-Fraumeni class" accent="text-lime-300" />
      </div>

      {/* tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: "variants", label: "Variant Interpretation", icon: Beaker },
          { key: "pgx", label: "Pharmacogenomics", icon: Syringe },
          { key: "hered", label: "Hereditary Risk & Tumor Board", icon: Users },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setQuery("");
              setFilter("All");
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition ${
              tab === t.key
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search genes, drugs, syndromes…"
              className="w-48 bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none"
            />
          </div>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-300 hover:border-slate-600">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
        {(classFilters || statusFilters).map((f) => (
          <FilterChip key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
      </div>

      {/* ================= TAB: VARIANT INTERPRETATION ================= */}
      {tab === "variants" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-fuchsia-400" />
            <span className="text-slate-400">ACMG/AMP framework:</span> every variant is scored against population AF (gnomAD), in-silico predictors (CADD, REVEL), ClinVar/COSMIC cross-refs, and segregation evidence — curators sign out Pathogenic / VUS decisions with full evidence trail.
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Variant</th>
                  <th className="px-3 py-2.5">Gene</th>
                  <th className="px-3 py-2.5">AF / CADD</th>
                  <th className="px-3 py-2.5">Zygosity</th>
                  <th className="px-3 py-2.5">Class</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Reviewer</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map((v) => (
                  <tr key={v.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[11px] text-slate-200">{v.hgvs}</div>
                      <div className="text-[10px] text-slate-500">{v.id} · {v.ref}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">{v.gene}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-slate-300">{v.af}</span>
                      <span className="mx-1 text-slate-600">/</span>
                      <span className="font-mono text-slate-300">{v.cadd}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{v.zygosity}</td>
                    <td className="px-3 py-2.5"><Chip cls={CLASS_META[v.cls].cls}>{v.cls}</Chip></td>
                    <td className="px-3 py-2.5 text-slate-400">{v.source}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={v.status === "Reviewed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : v.status === "Curated" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-400 border-slate-700"}>
                        {v.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{v.review}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "variant", item: v })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {v.status !== "Reviewed" && (
                          <button onClick={() => advanceVariant(v)} className="rounded-md border border-emerald-600/40 p-1.5 text-emerald-400 hover:bg-emerald-500/10" title="Sign out">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVariants.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-slate-500">No variants match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: PHARMACOGENOMICS ================= */}
      {tab === "pgx" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { k: "CPIC A — action", v: pgx.filter((p) => p.cpic === "A").length, cls: "text-emerald-300" },
              { k: "CPIC B — consider", v: pgx.filter((p) => p.cpic === "B").length, cls: "text-sky-300" },
              { k: "Actioned", v: pgx.filter((p) => p.status === "Actioned").length, cls: "text-cyan-300" },
              { k: "Pending", v: pgx.filter((p) => p.status === "Pending").length, cls: "text-amber-300" },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  <Syringe className={`h-4 w-4 ${c.cls}`} />
                  <span className="text-xs text-slate-400">{c.k}</span>
                </div>
                <span className="text-xl font-bold text-slate-100">{c.v}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Gene / Diplotype</th>
                  <th className="px-3 py-2.5">Phenotype</th>
                  <th className="px-3 py-2.5">Drug</th>
                  <th className="px-3 py-2.5">CPIC</th>
                  <th className="px-3 py-2.5">Recommended action</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredPgx.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{p.patient}</div>
                      <div className="text-[10px] text-slate-500">{p.id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[11px] text-slate-200">{p.gene} {p.diplot}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{p.phenotype}</td>
                    <td className="px-3 py-2.5 text-slate-300">{p.drug}</td>
                    <td className="px-3 py-2.5"><Chip cls={PGX_META[p.cpic].cls}>Level {p.cpic}</Chip></td>
                    <td className="px-3 py-2.5 max-w-[260px] text-slate-400">{p.action}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={p.status === "Actioned" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : p.status === "Reviewed" ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}>
                        {p.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInspect({ kind: "pgx", item: p })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {p.status !== "Actioned" && (
                          <button onClick={() => actionPgx(p)} className="rounded-md border border-emerald-600/40 p-1.5 text-emerald-400 hover:bg-emerald-500/10" title="Apply action">
                            <Zap className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPgx.length === 0 && (
                  <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No PGx results match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB: HEREDITARY & TUMOR BOARD ================= */}
      {tab === "hered" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { k: "Cascade testing", v: stats.cascade, cls: "text-violet-300" },
              { k: "Surveillance", v: stats.surveillance, cls: "text-emerald-300" },
              { k: "Tumor board", v: stats.tb, cls: "text-fuchsia-300" },
              { k: "Very high risk", v: stats.veryHigh, cls: "text-rose-300" },
            ].map((c) => (
              <div key={c.k} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  <Users className={`h-4 w-4 ${c.cls}`} />
                  <span className="text-xs text-slate-400">{c.k}</span>
                </div>
                <span className="text-xl font-bold text-slate-100">{c.v}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <Target className="mr-1 inline h-3.5 w-3.5 text-fuchsia-400" />
            <span className="text-slate-400">Tumor board cases:</span> NGS 500-gene panels report TMB, MSI status and targetable alterations; the matching engine proposes FDA-approved therapies and trial eligibility before weekly multidisciplinary review.
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Panel</th>
                  <th className="px-3 py-2.5">Syndrome / Findings</th>
                  <th className="px-3 py-2.5">Risk</th>
                  <th className="px-3 py-2.5">Cascade testing</th>
                  <th className="px-3 py-2.5">Next</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredHered.map((h) => (
                  <tr key={h.id} className="border-b border-slate-800/60 hover:bg-slate-800/20">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-200">{h.patient}</div>
                      <div className="text-[10px] text-slate-500">{h.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">{h.panel}</td>
                    <td className="px-3 py-2.5">
                      <div className={h.tb !== "—" ? "font-mono text-[11px] text-fuchsia-300" : "text-slate-300"}>{h.tb !== "—" ? h.tb : h.syndrome}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {h.risk !== "—" ? (
                        <Chip cls={h.risk === "Very high" ? "bg-rose-500/15 text-rose-300 border-rose-500/40" : h.risk === "High" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}>
                          {h.risk}
                        </Chip>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {h.cascade !== "—" ? (
                        <div className="w-32">
                          <div className="mb-1 font-mono text-[11px] text-slate-300">{h.cascade}</div>
                          <ProgressMeter pct={(parseInt(h.cascade, 10) / parseInt(h.cascade.match(/of (\d+)/)[1], 10)) * 100} cls="bg-violet-500" />
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-400">{h.next}</td>
                    <td className="px-3 py-2.5">
                      <Chip cls={h.status.includes("Tumor board") ? "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40" : h.status === "Cascade testing" ? "bg-violet-500/15 text-violet-300 border-violet-500/40" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"}>
                        {h.status}
                      </Chip>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setInspect({ kind: "hered", item: h })} className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredHered.length === 0 && (
                  <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No hereditary or tumor-board cases match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= INSPECT MODAL ================= */}
      {inspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setInspect(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                {inspect.kind === "variant" && <Beaker className="h-4 w-4 text-fuchsia-300" />}
                {inspect.kind === "pgx" && <Syringe className="h-4 w-4 text-emerald-300" />}
                {inspect.kind === "hered" && <Users className="h-4 w-4 text-violet-300" />}
                <h3 className="text-sm font-bold text-slate-100">
                  {inspect.kind === "variant" ? `${inspect.item.gene} ${inspect.item.hgvs}` : inspect.kind === "pgx" ? `${inspect.item.gene} · ${inspect.item.patient}` : inspect.item.patient}
                </h3>
              </div>
              <button onClick={() => setInspect(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs">
              {inspect.kind === "variant" && (
                <>
                  <DetailRow k="Variant ID" v={inspect.item.id} />
                  <DetailRow k="HGVS notation" v={inspect.item.hgvs} />
                  <DetailRow k="Allele frequency" v={`${inspect.item.af} (gnomAD)`} />
                  <DetailRow k="CADD score" v={inspect.item.cadd} />
                  <DetailRow k="Zygosity" v={inspect.item.zygosity} />
                  <DetailRow k="Classification" v={inspect.item.cls} />
                  <DetailRow k="Source assay" v={inspect.item.source} />
                  <DetailRow k="Cross-reference" v={inspect.item.ref} />
                  <DetailRow k="Reviewer" v={inspect.item.review} />
                  <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Sparkles className="mr-1 inline h-3.5 w-3.5 text-fuchsia-300" />
                    ACMG/AMP evidence: population frequency ≤ 0.1% for dominant disease genes (PM2), in-silico pathogenicity concordance (PP3), ClinVar entry reviewed (PS4 when applicable). Result feeds the oncology clinical decision support.
                  </div>
                </>
              )}
              {inspect.kind === "pgx" && (
                <>
                  <DetailRow k="Result ID" v={inspect.item.id} />
                  <DetailRow k="Patient" v={inspect.item.patient} />
                  <DetailRow k="Gene / diplotype" v={`${inspect.item.gene} ${inspect.item.diplot}`} />
                  <DetailRow k="Phenotype" v={inspect.item.phenotype} />
                  <DetailRow k="Drug pair" v={inspect.item.drug} />
                  <DetailRow k="CPIC level" v={`Level ${inspect.item.cpic}`} />
                  <DetailRow k="Recommended action" v={inspect.item.action} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-300" />
                    CPIC guideline level A/B: action is written into the EHR as a pre-emptive alert, with pharmacist verification and patient-facing decision support before first dispense.
                  </div>
                </>
              )}
              {inspect.kind === "hered" && (
                <>
                  <DetailRow k="Case ID" v={inspect.item.id} />
                  <DetailRow k="Panel" v={inspect.item.panel} />
                  <DetailRow k="Syndrome / findings" v={inspect.item.syndrome || inspect.item.tb} />
                  <DetailRow k="Risk level" v={inspect.item.risk} />
                  <DetailRow k="Cascade testing" v={inspect.item.cascade} />
                  <DetailRow k="Next action" v={inspect.item.next} />
                  <DetailRow k="Status" v={inspect.item.status} />
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-[11px] leading-relaxed text-slate-400">
                    <Target className="mr-1 inline h-3.5 w-3.5 text-violet-300" />
                    {inspect.item.tb !== "—"
                      ? "Tumor board: TMB + MSI + targetable alteration matrix presented weekly; therapy match validated against NCCN compendium and trial registries."
                      : "Hereditary pathway: genetic counseling, cascade testing for first-degree relatives, risk-reducing surveillance per NCCN guidelines, and family-history updates at every encounter."}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TOASTS ================= */}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl border p-3 shadow-lg backdrop-blur ${
            t.tone === "ok" ? "border-emerald-500/40 bg-emerald-950/90" : t.tone === "warn" ? "border-amber-500/40 bg-amber-950/90" : "border-slate-700 bg-slate-900/95"
          }`}>
            <div className="flex items-center gap-2">
              {t.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : t.tone === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <Bell className="h-4 w-4 text-cyan-400" />}
              <span className="text-xs font-semibold text-slate-100">{t.title}</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t.body}</p>
          </div>
        ))}
      </div>

      {/* footer note */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-800/60 pt-4 text-[10px] text-slate-600">
        <span>Genomics &amp; Precision Medicine · ACMG/AMP 2015 · CPIC 2026 · NCCN · CLIA/CAP NGS</span>
        <span>sim tick {tickerRef.current} · {lastRun}</span>
      </div>
    </div>
  );
}

function DetailRow({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-2">
      <span className="shrink-0 text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-200">{v}</span>
    </div>
  );
}

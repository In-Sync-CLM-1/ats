import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  UserPlus,
  Briefcase,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Phone,
  MessageSquare,
  BarChart3,
  Brain,
  Rocket,
  Zap,
  CheckCircle,
  GripVertical,
  Send,
  PhoneCall,
  Clock,
  Star,
  FileText,
  QrCode,
  ScanLine,
  Target,
} from "lucide-react";

/* ── Timing ───────────────────────────────────────────── */

const SCENES = [
  { id: "intro", label: "Intro", duration: 4000 },
  { id: "dashboard", label: "Dashboard", duration: 12000 },
  { id: "pipeline", label: "Pipeline", duration: 12000 },
  { id: "ai-resume", label: "AI Parser", duration: 12000 },
  { id: "calling", label: "Calling & WhatsApp", duration: 12000 },
  { id: "qr", label: "Public Apply", duration: 12000 },
  { id: "outro", label: "Get Started", duration: 4000 },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

/* ── Animation helpers ────────────────────────────────── */

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.4 },
};

const slideUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay } },
});

/* ── SVG components ───────────────────────────────────── */

function PlacementsChart() {
  // 7-day placement trend, ticking up
  const points: [number, number][] = [
    [0, 70],
    [50, 60],
    [100, 55],
    [150, 38],
    [200, 32],
    [250, 22],
    [300, 14],
  ];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = line + " L300,90 L0,90 Z";
  return (
    <svg viewBox="0 0 300 90" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="placementsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(20,184,166)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(20,184,166)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[22, 45, 67].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="currentColor" strokeOpacity="0.07" />
      ))}
      <motion.path
        d={area}
        fill="url(#placementsGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="rgb(20,184,166)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
      />
      {points.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r="3"
          fill="rgb(20,184,166)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + i * 0.12 }}
        />
      ))}
    </svg>
  );
}

function MatchDonut({ pct, color, label }: { pct: number; color: string; label: string }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const off = circ - (pct / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="7" />
      <motion.circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeDasharray={circ}
        strokeLinecap="round"
        style={{ rotate: "-90deg", transformOrigin: "center" }}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: off }}
        transition={{ duration: 1.2, delay: 0.6, ease: "easeOut" }}
      />
      <text x="50" y="45" textAnchor="middle" dominantBaseline="middle" fontSize="18" fontWeight="700" fill="currentColor">
        {pct}%
      </text>
      <text x="50" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.5">
        {label}
      </text>
    </svg>
  );
}

function FakeQR() {
  // Tiny pseudo-QR mosaic
  const cells = Array.from({ length: 13 * 13 }, (_, i) => {
    const r = Math.floor(i / 13);
    const c = i % 13;
    // Big finder squares
    const inFinder =
      (r < 4 && c < 4) || (r < 4 && c > 8) || (r > 8 && c < 4);
    if (inFinder) {
      const onBorder =
        (r === 0 || r === 3 || c === 0 || c === 3) ||
        (r === 0 || r === 3 || c === 9 || c === 12) ||
        (r === 9 || r === 12 || c === 0 || c === 3);
      return inFinder && onBorder ? 1 : (r === 1 || r === 2) && (c === 1 || c === 2) ? 1 : 0;
    }
    // Pseudo-random pattern from index hash
    return ((i * 7 + (r * c)) % 5) < 2 ? 1 : 0;
  });
  return (
    <svg viewBox="0 0 13 13" className="h-full w-full">
      {cells.map((v, i) => {
        const r = Math.floor(i / 13);
        const c = i % 13;
        return v ? <rect key={i} x={c} y={r} width={1} height={1} fill="currentColor" /> : null;
      })}
    </svg>
  );
}

/* ── Typewriter ───────────────────────────────────────── */

function useTypewriter(text: string, speed = 30, startDelay = 800) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);
  return displayed;
}

/* ── Scenes ───────────────────────────────────────────── */

/* 1. Intro */
function IntroScene() {
  const pills = [
    { icon: UserPlus, text: "Candidate Management" },
    { icon: Briefcase, text: "Mandate Pipeline" },
    { icon: Phone, text: "Built-in Calling" },
    { icon: Brain, text: "AI Resume Parsing" },
    { icon: QrCode, text: "Public Apply (QR)" },
  ];
  return (
    <motion.div {...fade} className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
      <motion.div {...slideUp(0)}>
        <Rocket className="mx-auto mb-3 h-10 w-10 text-teal-500" />
      </motion.div>
      <motion.h2 {...slideUp(0.1)} className="text-2xl font-bold text-foreground">
        Your Recruitment Command Center
      </motion.h2>
      <motion.p {...slideUp(0.2)} className="max-w-sm text-sm text-muted-foreground">
        Everything your team needs to source, engage, and place candidates — in one platform.
      </motion.p>
      <motion.div {...slideUp(0.3)} className="mt-2 flex max-w-md flex-wrap justify-center gap-2">
        {pills.map((p, i) => (
          <motion.span
            key={p.text}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 300 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-600"
          >
            <p.icon className="h-3.5 w-3.5" />
            {p.text}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* 2. Dashboard */
function DashboardScene() {
  const kpis = [
    { label: "Active Candidates", value: "1,247", change: "+24%", icon: UserPlus },
    { label: "Open Mandates", value: "89", change: "+12%", icon: Briefcase },
    { label: "Placements MTD", value: "47", change: "+18%", icon: TrendingUp },
    { label: "Closure Rate", value: "32%", change: "+5%", icon: Target },
  ];
  const activities = [
    { text: "Priya placed Senior ICU Nurse @ Apollo — ₹6.5L", time: "2m ago", color: "bg-teal-500" },
    { text: "New candidate via QR: Rajesh K · 4y exp", time: "8m ago", color: "bg-blue-500" },
    { text: "Mandate filled: Pharmacy Lead @ Fortis", time: "15m ago", color: "bg-amber-500" },
  ];
  return (
    <motion.div {...fade} className="flex h-full flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Every metric that matters</h2>
        <p className="text-sm text-muted-foreground">Pipeline health, recruiter activity, and placements at a glance</p>
      </motion.div>

      <div className="grid grid-cols-4 gap-2">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            {...slideUp(0.1 + i * 0.08)}
            className="flex flex-col gap-1 rounded-xl border bg-card p-2.5"
          >
            <div className="flex items-center justify-between">
              <k.icon className="h-4 w-4 text-teal-500" />
              <span className="text-[11px] font-semibold text-teal-600">{k.change}</span>
            </div>
            <span className="text-2xl font-bold leading-tight text-foreground">{k.value}</span>
            <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-2">
        <motion.div {...slideUp(0.4)} className="col-span-3 flex flex-col rounded-xl border bg-card p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Placements Trend</span>
            <span className="text-[11px] text-muted-foreground">Last 7 days</span>
          </div>
          <div className="min-h-0 flex-1">
            <PlacementsChart />
          </div>
        </motion.div>

        <motion.div {...slideUp(0.5)} className="col-span-2 flex flex-col rounded-xl border bg-card p-3">
          <span className="mb-2 text-sm font-semibold text-foreground">Live Activity</span>
          <div className="flex-1 space-y-2.5">
            {activities.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.25 }}
                className="flex items-start gap-2"
              >
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.color}`} />
                <div>
                  <p className="text-xs font-medium leading-snug text-foreground">{a.text}</p>
                  <p className="text-[11px] text-muted-foreground">{a.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* 3. Pipeline (candidates moving across stages) */
function PipelineScene() {
  const columns = [
    {
      title: "Sourced",
      color: "bg-slate-500",
      count: 45,
      cards: [
        { name: "Rajesh Kumar", role: "Staff Nurse · 4y", hot: false },
        { name: "Sneha Iyer", role: "Lab Tech · 3y", hot: false },
      ],
    },
    {
      title: "Screened",
      color: "bg-blue-500",
      count: 28,
      cards: [
        { name: "Amit Pandey", role: "Pharmacist · 5y", hot: true },
        { name: "Neha Mehta", role: "OT Nurse · 4y", hot: false },
      ],
    },
    {
      title: "Interviewing",
      color: "bg-violet-500",
      count: 12,
      cards: [
        { name: "Dr. David Lee", role: "Radiologist · 9y", hot: true },
        { name: "Sara Mathew", role: "ICU Nurse · 6y", hot: false },
      ],
    },
    {
      title: "Offered",
      color: "bg-amber-500",
      count: 6,
      cards: [{ name: "Asha Pillai", role: "Senior Nurse · 8y", hot: true }],
    },
  ];

  return (
    <motion.div {...fade} className="flex h-full flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Candidates flow to placement</h2>
        <p className="text-sm text-muted-foreground">Drag through your hiring pipeline — every stage, every recruiter</p>
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-2">
        {columns.map((col, ci) => (
          <motion.div
            key={col.title}
            {...slideUp(0.1 + ci * 0.1)}
            className="flex flex-col rounded-xl border bg-muted/30 p-2"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold text-foreground">{col.title}</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {col.count}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {col.cards.map((card, di) => (
                <motion.div
                  key={card.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + ci * 0.12 + di * 0.1 }}
                  className="cursor-grab space-y-1.5 rounded-lg border bg-card p-2.5"
                >
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                    <span className="truncate text-sm font-medium text-foreground">{card.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{card.role}</span>
                    {card.hot && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-600 dark:bg-amber-900/30">
                        Hot fit
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <motion.div animate={{ x: [0, 40, 40, 0] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}>
          <ArrowRight className="h-3.5 w-3.5 text-teal-500" />
        </motion.div>
        <span>Drag candidates across stages to update</span>
      </motion.div>
    </motion.div>
  );
}

/* 4. AI Resume Parsing */
function AIResumeScene() {
  const aiText = useTypewriter(
    "Strong fit for 'Senior ICU Nurse — Apollo Bangalore'. 7 years critical care, ACLS-certified, current location matches. Recommend moving to Screening and scheduling a discovery call today.",
    24,
    1400,
  );

  const skills = ["ICU", "Critical Care", "BLS", "ACLS", "Hindi · English"];

  return (
    <motion.div {...fade} className="flex h-full flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Resumes parse themselves</h2>
        <p className="text-sm text-muted-foreground">Drop a PDF, watch the candidate profile fill in front of you</p>
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        {/* Resume drop zone */}
        <motion.div {...slideUp(0.15)} className="flex flex-col rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-500" />
            <span className="text-sm font-semibold text-foreground">Resume Drop Zone</span>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-500/30 bg-teal-500/[0.04] p-4"
          >
            <FileText className="h-10 w-10 text-teal-500" />
            <p className="text-sm font-medium text-foreground">priya_sharma_resume.pdf</p>
            <p className="text-[11px] text-muted-foreground">2.1 MB · uploaded just now</p>
            <motion.div
              className="mt-2 flex w-full items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-teal-500"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.6, delay: 0.7 }}
                />
              </div>
              <span className="text-[11px] font-medium text-teal-600">Parsing...</span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Extracted profile */}
        <motion.div {...slideUp(0.25)} className="flex flex-col rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-fuchsia-500" />
              <span className="text-sm font-semibold text-foreground">Extracted Profile</span>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Live</span>
          </div>
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-3">
              <MatchDonut pct={96} color="rgb(16,185,129)" label="match" />
              <div className="flex-1">
                <motion.p
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.6 }}
                  className="text-sm font-semibold text-foreground"
                >
                  Priya Sharma
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.7 }}
                  className="text-xs text-muted-foreground"
                >
                  Senior Staff Nurse · 7 yrs · Bangalore
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.9 }}
                  className="mt-2 flex flex-wrap gap-1"
                >
                  {skills.map((s, i) => (
                    <motion.span
                      key={s}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 2.0 + i * 0.1 }}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {s}
                    </motion.span>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="mt-3 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-500" />
              <p className="text-xs leading-relaxed text-foreground">
                {aiText}
                <motion.span
                  className="ml-0.5 inline-block h-3 w-0.5 align-middle bg-fuchsia-500"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* 5. Calling & WhatsApp */
function CallingScene() {
  const agents = [
    { name: "Anita Rao", calls: 47, talk: "3h 12m", conv: "38%", status: "On Call" },
    { name: "Vikram Shah", calls: 42, talk: "2h 58m", conv: "34%", status: "Available" },
    { name: "Priyanka Nair", calls: 35, talk: "2h 24m", conv: "41%", status: "On Call" },
  ];
  const callLog = [
    { contact: "Rajesh Kumar", role: "Staff Nurse", duration: "4:32", outcome: "Interview Set", icon: CheckCircle, color: "text-teal-500" },
    { contact: "Maria D'Souza", role: "Lab Tech", duration: "2:15", outcome: "Call Back", icon: Clock, color: "text-amber-500" },
    { contact: "James Verma", role: "Pharmacist", duration: "6:18", outcome: "Qualified", icon: Star, color: "text-blue-500" },
  ];

  return (
    <motion.div {...fade} className="flex h-full flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Every conversation logged</h2>
        <p className="text-sm text-muted-foreground">Click-to-call via Exotel + templated WhatsApp — without leaving the candidate</p>
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-2">
        {/* Recruiter performance */}
        <motion.div {...slideUp(0.15)} className="col-span-2 flex flex-col rounded-xl border bg-card p-3">
          <span className="mb-2 text-sm font-semibold text-foreground">Recruiter Performance</span>
          <div className="flex-1 space-y-2">
            {agents.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15 }}
                className="flex items-center gap-2 rounded-lg bg-muted/40 p-2"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                  <Phone className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{a.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                        a.status === "On Call" ? "bg-teal-500/10 text-teal-600" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex gap-3 text-[11px] text-muted-foreground">
                    <span>{a.calls} calls</span>
                    <span>{a.talk}</span>
                    <span className="font-medium text-teal-600">{a.conv}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent calls + WhatsApp send */}
        <motion.div {...slideUp(0.25)} className="col-span-3 flex flex-col rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Recent Calls</span>
            <motion.div
              className="flex items-center gap-1.5 text-[11px] font-medium text-teal-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                className="h-2 w-2 rounded-full bg-teal-500"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              2 live calls
            </motion.div>
          </div>
          <div className="flex-1 space-y-2">
            {callLog.map((c, i) => (
              <motion.div
                key={c.contact}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.18 }}
                className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card">
                  {i === 0 ? (
                    <PhoneCall className="h-4 w-4 text-teal-500" />
                  ) : i === 1 ? (
                    <Clock className="h-4 w-4 text-amber-500" />
                  ) : (
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{c.contact}</span>
                    <span className="text-[11px] text-muted-foreground">{c.duration}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{c.role}</span>
                    <span className={`text-[11px] font-medium ${c.color}`}>{c.outcome}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          {/* WhatsApp template send */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="mt-3 flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-2.5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10">
              <MessageSquare className="h-4 w-4 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Interview Confirmation · 47 candidates</span>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8 }}
                  className="text-[11px] font-medium text-green-600"
                >
                  Delivered 47/47
                </motion.span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-green-500"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1, delay: 1.5 }}
                />
              </div>
            </div>
            <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Send className="h-3.5 w-3.5 text-green-600" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Summary bar */}
      <motion.div
        {...slideUp(0.6)}
        className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5"
      >
        {[
          { label: "Calls Today", value: "124" },
          { label: "Avg Talk Time", value: "3:45" },
          { label: "WhatsApp Sent", value: "247" },
          { label: "Interviews Set", value: "18" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* 6. Public Apply (QR) */
function QRScene() {
  const flowSteps = [
    { icon: ScanLine, title: "Candidate scans QR", text: "Unique to each recruiter" },
    { icon: FileText, title: "Fills 60-second form", text: "Resume + basics, no login" },
    { icon: UserPlus, title: "Lands in your pipeline", text: "Auto-tagged to the recruiter" },
  ];

  return (
    <motion.div {...fade} className="flex h-full flex-col gap-3">
      <motion.div {...slideUp(0)}>
        <h2 className="text-2xl font-bold text-foreground">Source candidates without lifting a finger</h2>
        <p className="text-sm text-muted-foreground">Every recruiter gets a public QR — applications go straight into the pipeline</p>
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-3">
        {/* QR + recruiter card */}
        <motion.div {...slideUp(0.15)} className="col-span-2 flex flex-col items-center justify-center rounded-xl border bg-card p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 250 }}
            className="rounded-xl border-2 border-foreground/80 bg-background p-3 text-foreground/90"
            style={{ width: 160, height: 160 }}
          >
            <FakeQR />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-3 text-sm font-semibold text-foreground"
          >
            Anita Rao
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-[11px] text-muted-foreground"
          >
            apply/anita-rao
          </motion.p>
        </motion.div>

        {/* Flow */}
        <motion.div {...slideUp(0.25)} className="col-span-3 flex flex-col gap-2 rounded-xl border bg-card p-3">
          <span className="mb-1 text-sm font-semibold text-foreground">How a candidate enters your pipeline</span>
          {flowSteps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.25 }}
              className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                <s.icon className="h-4 w-4 text-teal-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-[11px] text-muted-foreground">{s.text}</p>
              </div>
              <span className="text-[11px] font-bold text-teal-600">{`Step ${i + 1}`}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        {...slideUp(0.6)}
        className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5"
      >
        {[
          { label: "Applications Today", value: "47" },
          { label: "Auto-Qualified", value: "12" },
          { label: "Time Saved / Day", value: "5 hrs" },
          { label: "Cost / Lead", value: "₹0" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* 7. Outro */
function OutroScene() {
  const features = [
    { icon: UserPlus, label: "Candidates" },
    { icon: Briefcase, label: "Mandates" },
    { icon: Phone, label: "Calling" },
    { icon: MessageSquare, label: "WhatsApp" },
    { icon: Brain, label: "AI Parser" },
    { icon: BarChart3, label: "Analytics" },
  ];
  return (
    <motion.div {...fade} className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
      <motion.div {...slideUp(0)}>
        <Zap className="mx-auto mb-2 h-10 w-10 text-teal-500" />
      </motion.div>
      <motion.h2 {...slideUp(0.1)} className="text-2xl font-bold text-foreground">
        Ready to place candidates faster?
      </motion.h2>
      <motion.p {...slideUp(0.2)} className="max-w-xs text-sm text-muted-foreground">
        Healthcare staffing teams across India are hiring 3x faster with In-Sync ATS.
      </motion.p>
      <motion.div {...slideUp(0.25)} className="mt-1 flex flex-wrap justify-center gap-3">
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.08 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
              <f.icon className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{f.label}</span>
          </motion.div>
        ))}
      </motion.div>
      <motion.div {...slideUp(0.5)}>
        <Link to="/create-org">
          <Button size="lg" className="gap-2 bg-teal-600 px-6 text-sm text-white hover:bg-teal-700">
            Start 14-Day Trial
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* ── Scene router ─────────────────────────────────────── */

function SceneContent({ id }: { id: SceneId }) {
  switch (id) {
    case "intro":
      return <IntroScene />;
    case "dashboard":
      return <DashboardScene />;
    case "pipeline":
      return <PipelineScene />;
    case "ai-resume":
      return <AIResumeScene />;
    case "calling":
      return <CallingScene />;
    case "qr":
      return <QRScene />;
    case "outro":
      return <OutroScene />;
  }
}

/* ── Main Component ───────────────────────────────────── */

export default function LandingDemo() {
  const [step, setStep] = useState(0);
  const sceneIndex = step % SCENES.length;
  const scene = SCENES[sceneIndex];

  const advance = useCallback(() => setStep((s) => s + 1), []);

  useEffect(() => {
    const timer = setTimeout(advance, scene.duration);
    return () => clearTimeout(timer);
  }, [step, scene.duration, advance]);

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / scene.duration, 1));
      if (elapsed < scene.duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, scene.duration]);

  return (
    <div className="flex h-full max-h-[540px] w-full flex-col overflow-hidden rounded-2xl bg-background text-foreground">
      <div className="relative min-h-0 flex-1 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="h-full"
          >
            <SceneContent id={scene.id} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2 px-6 pb-3 pt-1">
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            key={step}
            className="h-full rounded-full bg-teal-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-2">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep((prev) => prev - (prev % SCENES.length) + i)}
              className="group flex items-center gap-1"
            >
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === sceneIndex ? "w-5 bg-teal-500" : "w-1.5 bg-muted-foreground/25 group-hover:bg-muted-foreground/50"
                }`}
              />
              {i === sceneIndex && (
                <span className="text-[11px] font-medium text-teal-600">{s.label}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

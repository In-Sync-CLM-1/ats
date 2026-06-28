import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import atsLogo from "@/assets/ats-logo.png";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Briefcase,
  Phone,
  MessageSquare,
  Mail,
  BarChart3,
  Upload,
  QrCode,
  Brain,
  Shield,
  ArrowRight,
  CheckCircle,
  Check,
  Sparkles,
  Zap,
  Clock,
  Building2,
  Target,
  UserPlus,
  Send,
  ClipboardList,
  Layers,
  Users2,
  Globe,
} from "lucide-react";

/* ── data ─────────────────────────────────────────────── */

const features = [
  {
    icon: Users,
    title: "Candidate Management",
    description:
      "Every applicant, organised. Full profiles with KYC, skills, resume, call history, and pipeline stage — all in one tab.",
    gradient: "from-teal-500/20 to-cyan-500/20",
    iconColor: "text-teal-500",
  },
  {
    icon: Briefcase,
    title: "Mandate Management",
    description:
      "Create job orders with JD, skills, salary bands, and target closure. Assign recruiters and link candidates instantly.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-500",
  },
  {
    icon: Phone,
    title: "Built-in Calling",
    description:
      "Click-to-call via Exotel. Every call recorded, logged, and tagged with a disposition — no app switching.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp & Email",
    description:
      "Templated WhatsApp, SMS, and rich HTML email with merge tags. Send to one candidate or thousands.",
    gradient: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-500",
  },
  {
    icon: Brain,
    title: "AI Resume Parsing",
    description:
      "Drop a PDF, watch the profile fill itself. Gemini-powered extraction of skills, experience, and contact details.",
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    iconColor: "text-fuchsia-500",
  },
  {
    icon: QrCode,
    title: "Public Apply & QR",
    description:
      "Every recruiter gets a QR code. Candidates scan and apply — no login. Applications land straight in the pipeline.",
    gradient: "from-sky-500/20 to-blue-500/20",
    iconColor: "text-sky-500",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reporting",
    description:
      "Recruiter performance, calling KPIs, disposition charts, and pipeline analytics — real time, no spreadsheets.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-500",
  },
  {
    icon: Upload,
    title: "Bulk Import & Export",
    description:
      "Import thousands of candidates, mandates, or clients from CSV with smart column mapping, validation, and revert.",
    gradient: "from-cyan-500/20 to-sky-500/20",
    iconColor: "text-cyan-500",
  },
];

const steps = [
  {
    icon: UserPlus,
    title: "Set Up Your Workspace",
    description:
      "Create your organisation, configure your hiring pipeline, and invite your team. Two minutes, not two weeks.",
  },
  {
    icon: Upload,
    title: "Bring in Your Pipeline",
    description:
      "Drop a CSV of candidates and mandates, or let AI parse PDF resumes. We map columns and clean the data for you.",
  },
  {
    icon: Send,
    title: "Engage Candidates",
    description:
      "Call, WhatsApp, and email candidates directly from the platform. Every action logged against their profile.",
  },
  {
    icon: Target,
    title: "Place & Close Mandates",
    description:
      "Move candidates through pipeline stages, fill positions, and measure recruiter performance — all in real time.",
  },
];

const stats = [
  { value: 25, suffix: "+", label: "Recruitment Teams Live" },
  { value: 50, suffix: "K+", label: "Candidates Tracked" },
  { value: 99.9, suffix: "%", label: "Uptime" },
  { value: 8, suffix: "+", label: "Industries Served" },
];

const pricingPlans = [
  {
    name: "14-Day Trial",
    price: "Free",
    period: "",
    billing: "",
    description: "Full access to every feature. No credit card required.",
    features: [
      "Unlimited recruiters for 14 days",
      "Full pipeline management",
      "Built-in calling, WhatsApp & email",
      "AI resume parsing",
      "Public Apply via QR",
    ],
    cta: "Start 14-Day Trial",
    ctaLink: "/create-org",
    popular: false,
    footnote: "",
  },
  {
    name: "Professional",
    price: "₹999",
    period: "/recruiter/mo",
    billing: "Billed quarterly",
    description: "Everything a hiring team needs to place candidates faster.",
    features: [
      "Unlimited candidates & mandates",
      "Pipeline analytics & forecasting",
      "WhatsApp, SMS & email campaigns",
      "Built-in calling with auto-record",
      "AI resume parsing",
      "Custom reports & dashboards",
      "Bulk import / export",
    ],
    cta: "Start 14-Day Trial",
    ctaLink: "/create-org",
    popular: true,
    footnote: "Calling minutes and WhatsApp messages billed at usage; min recharge ₹500.",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    billing: "",
    description: "For staffing agencies and large recruitment teams.",
    features: [
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations & API access",
      "SSO & advanced security",
      "Headcount agreements & zonal portal",
      "SLA guarantee",
    ],
    cta: "Talk to Sales",
    ctaLink: "/create-org",
    popular: false,
    footnote: "",
  },
];

const trustLogos = [
  { src: "/uhc-logo.png", alt: "UHC" },
  { src: "/rmpl-logo.png", alt: "RMPL" },
];

/* ── animation helpers ────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(value % 1 !== 0 ? parseFloat(start.toFixed(1)) : Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

/* ── Main component ───────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Authenticated visitors don't need to see the marketing page — send them
  // to their dashboard and let AppLayout's gate route to /platform-admin /
  // /create-org / /onboarding as appropriate.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.rpc("is_platform_admin", { _user_id: session.user.id }).then(({ data }) => {
        navigate(data ? "/platform-admin" : "/dashboard", { replace: true });
      });
    });
  }, [navigate]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* ── Global subtle background ─────────────── */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,_rgba(20,184,166,0.06),_transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.12) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Sticky Header ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={`sticky top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-border/50 bg-background/90 backdrop-blur-xl shadow-sm"
            : "border-transparent bg-slate-900/80 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/welcome" className="flex items-center gap-3">
            <img src={atsLogo} alt="In-Sync ATS" className="h-10 w-auto" />
            <span
              className={`text-lg font-bold tracking-tight transition-colors ${
                scrolled ? "text-foreground" : "text-white"
              }`}
            >
              In-Sync ATS
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { id: "features", label: "Features" },
              { id: "how-it-works", label: "How It Works" },
              { id: "ai", label: "AI" },
              { id: "pricing", label: "Pricing" },
            ].map(({ id, label }) => (
              <Button
                key={id}
                variant="ghost"
                className={`text-sm ${scrolled ? "" : "text-slate-200 hover:text-white hover:bg-white/10"}`}
                onClick={() => scrollToId(id)}
              >
                {label}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={
                scrolled
                  ? ""
                  : "border-white/30 text-white bg-white/10 hover:bg-white/20 hover:text-white"
              }
              onClick={() => navigate("/auth")}
            >
              Login
            </Button>
            <Button
              onClick={() => navigate("/create-org")}
              className="shadow-lg shadow-teal-500/25 bg-teal-500 hover:bg-teal-600 text-white"
            >
              Start Trial
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative z-0 overflow-hidden bg-slate-900">
        {/* Grid lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* Dot accents */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-[18%] left-[22%] h-2 w-2 rounded-full bg-teal-400/40" />
          <div className="absolute top-[35%] right-[20%] h-1.5 w-1.5 rounded-full bg-orange-400/35" />
          <div className="absolute bottom-[25%] left-[35%] h-2.5 w-2.5 rounded-full bg-teal-400/30" />
          <div className="absolute top-[55%] right-[30%] h-2 w-2 rounded-full bg-white/20" />
          <div className="absolute bottom-[40%] right-[12%] h-1.5 w-1.5 rounded-full bg-teal-400/25" />
        </div>
        {/* Glow accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/25 blur-[130px]" />
          <div className="absolute bottom-0 right-1/4 h-[450px] w-[450px] rounded-full bg-orange-500/15 blur-[120px]" />
          <div className="absolute top-1/3 left-1/2 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-teal-400/10 blur-[100px]" />
        </div>

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-32 lg:pt-40"
        >
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-5 py-2 text-sm font-medium text-teal-300 backdrop-blur-sm"
            >
              <Zap className="h-3.5 w-3.5" />
              Built for healthcare & high-volume staffing &bull; Powered by In-Sync
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              Hire faster.{" "}
              <br className="hidden sm:block" />
              Track{" "}
              <span className="relative">
                <span className="text-teal-400">smarter.</span>
                <motion.span
                  className="absolute -bottom-2 left-0 h-1 rounded-full bg-teal-400"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, delay: 0.9 }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl"
            >
              Candidates, mandates, calling, WhatsApp, and AI resume parsing — one platform for
              recruitment teams that move fast.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                size="lg"
                onClick={() => navigate("/create-org")}
                className="group relative overflow-hidden text-base px-8 shadow-xl shadow-teal-500/25 hover:shadow-2xl hover:shadow-teal-500/30 bg-teal-500 hover:bg-teal-600 text-white transition-shadow"
              >
                Start 14-Day Trial
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToId("features")}
                className="text-base px-8 border-white/30 text-white bg-white/10 hover:bg-white/20 hover:text-white backdrop-blur-sm"
              >
                See All Features
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400"
            >
              {["14-day full-access trial", "Setup in 2 minutes", "No credit card required"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-400" /> {t}
                </span>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* ── Walkthrough demo (embedded) ── */}
        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6 sm:pb-28"
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black shadow-2xl shadow-teal-500/10">
            {/* Browser-style top bar */}
            <div className="flex items-center gap-2 border-b border-white/10 bg-black/80 px-4 py-2.5">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <div className="ml-3 flex-1 rounded-md bg-white/10 px-3 py-1 text-[11px] text-white/40">
                ats.in-sync.co.in/dashboard
              </div>
            </div>
            <iframe
              src="/landing-demo"
              title="In-Sync ATS Product Demo"
              className="w-full border-0"
              style={{ height: "min(70vh, 540px)" }}
              loading="eager"
            />
          </div>
        </motion.div>
      </section>

      {/* ── Trusted By ── */}
      <section className="relative z-10 border-t border-border/50 bg-muted/40 py-14 sm:py-16">
        <AnimatedSection className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.p
            variants={fadeUp}
            className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Trusted by healthcare staffing teams across India
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
            {trustLogos.map((l) => (
              <div
                key={l.alt}
                className="flex h-14 w-32 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/80 px-4 py-2 grayscale opacity-60 transition-all duration-300 hover:border-border hover:opacity-100 hover:grayscale-0 hover:shadow-md"
              >
                <img src={l.src} alt={l.alt} className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
            ))}
          </motion.div>
        </AnimatedSection>
      </section>

      {/* ── Feature Cards ── */}
      <section id="features" className="relative z-10 overflow-hidden border-t border-border/50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/[0.03] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Layers className="h-3.5 w-3.5" />
              Features
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              One platform.{" "}
              <span className="text-primary">Every recruitment workflow.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-muted-foreground">
              From sourcing to placement — every tool your hiring team needs is already here.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-7 backdrop-blur-sm transition-colors hover:border-primary/30"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} ring-1 ring-border/50`}
                  >
                    <f.icon className={`h-6 w-6 ${f.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 border-t border-border/50 bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Clock className="h-3.5 w-3.5" />
              How It Works
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Up and running in <span className="text-primary">minutes</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-muted-foreground">
              Four simple steps from sign-up to your first placement.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="relative mt-20">
            <div className="pointer-events-none absolute top-14 left-[12%] right-[12%] hidden h-px border-t-2 border-dashed border-border lg:block" />
            <div className="pointer-events-none absolute top-0 bottom-0 left-[39px] w-px border-l-2 border-dashed border-border sm:left-1/2 sm:-translate-x-px lg:hidden" />

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  className="relative pl-20 text-left sm:pl-0 sm:text-center"
                >
                  <div className="absolute left-0 top-0 sm:relative sm:left-auto sm:top-auto sm:mx-auto mb-6 flex h-28 w-28 items-center justify-center max-sm:h-20 max-sm:w-20">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20" />
                    <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25">
                      {i + 1}
                    </div>
                    <step.icon className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-[240px] text-sm leading-relaxed text-muted-foreground max-sm:mx-0">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative z-10 border-t border-border/50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center mb-16">
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Built for{" "}
              <span className="text-primary">staffing agencies & in-house recruitment</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground">
              Trusted by healthcare staffing firms, BPO hiring teams, and in-house TA functions.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
            {stats.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="group rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <p className="text-4xl font-extrabold text-primary sm:text-5xl">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── AI Edge ── */}
      <section id="ai" className="relative z-10 border-t border-white/10 overflow-hidden bg-slate-900">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-fuchsia-500/15 blur-[140px]" />
          <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-teal-500/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <AnimatedSection>
              <motion.div
                variants={fadeUp}
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-fuchsia-400/15 px-4 py-1.5 text-sm font-medium text-fuchsia-300"
              >
                <Brain className="h-3.5 w-3.5" />
                AI-Powered
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Resumes parse themselves.{" "}
                <span className="text-fuchsia-400">You take the credit.</span>
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-5 text-lg text-slate-300">
                Drop a resume and watch the candidate profile fill in front of you. AI extracts skills,
                experience, education, and contact details — then suggests where they fit in your pipeline.
              </motion.p>
            </AnimatedSection>

            <AnimatedSection className="hidden lg:block">
              <motion.div
                variants={fadeUp}
                className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 shadow-2xl p-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-fuchsia-400" />
                    <span className="text-sm font-semibold text-white">Resume Parser</span>
                    <span className="ml-auto text-[11px] text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">
                      Live
                    </span>
                  </div>
                  {/* Mock parsed candidate */}
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Priya Sharma</p>
                        <p className="text-xs text-slate-400">Senior Staff Nurse · 7 yrs</p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">
                        96% match
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["ICU", "Critical Care", "BLS", "ACLS", "Hindi · English"].map((s) => (
                        <span key={s} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* AI recommendation */}
                  <div className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/[0.06] p-3">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-fuchsia-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Strong fit for "Senior ICU Nurse — Apollo Bangalore". Recommend moving to Screening
                        and scheduling a discovery call.
                      </p>
                    </div>
                  </div>
                  {/* Today's stats */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[
                      { label: "Resumes Parsed", value: "127" },
                      { label: "Matches Found", value: "34" },
                      { label: "Time Saved", value: "9 hrs" },
                    ].map((a) => (
                      <div key={a.label} className="rounded-lg bg-white/5 p-2 text-center">
                        <p className="text-sm font-bold text-white">{a.value}</p>
                        <p className="text-[10px] text-slate-400">{a.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>

          <AnimatedSection className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Brain,
                title: "Smart Resume Parsing",
                description:
                  "Gemini Vision extracts skills, experience, and contact details from PDF or image resumes — no manual entry.",
                stat: "9 hrs",
                statLabel: "saved per recruiter / week",
                color: "bg-fuchsia-400/15 text-fuchsia-400",
                border: "border-fuchsia-400/20",
              },
              {
                icon: Target,
                title: "Pipeline Insights",
                description:
                  "Real-time dashboards on disposition mix, recruiter activity, and mandate progress. No reports to build.",
                stat: "Real-time",
                statLabel: "no manual reporting",
                color: "bg-teal-400/15 text-teal-400",
                border: "border-teal-400/20",
              },
              {
                icon: Phone,
                title: "Auto-Logged Calls",
                description:
                  "Every Exotel call recorded, transcribed-ready, and tagged with disposition codes you control.",
                stat: "100%",
                statLabel: "of calls captured",
                color: "bg-amber-400/15 text-amber-400",
                border: "border-amber-400/20",
              },
            ].map((ai) => (
              <motion.div
                key={ai.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`group relative overflow-hidden rounded-2xl border ${ai.border} bg-white/5 p-7 backdrop-blur-sm`}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ai.color}`}>
                    <ai.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{ai.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">{ai.description}</p>
                <div className="mt-5 flex items-baseline gap-2 border-t border-white/10 pt-4">
                  <span className="text-2xl font-extrabold text-white">{ai.stat}</span>
                  <span className="text-sm text-slate-400">{ai.statLabel}</span>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>

          <AnimatedSection className="mt-12">
            <motion.div
              variants={fadeUp}
              className="mx-auto max-w-3xl rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.06] px-8 py-6 text-center backdrop-blur-sm"
            >
              <p className="text-base italic leading-relaxed text-slate-200">
                &ldquo;We were burning eight hours a week just typing resumes into our old tool. With In-Sync,
                that time goes back into actually talking to candidates.&rdquo;
              </p>
              <p className="mt-3 text-sm font-medium text-slate-400">
                &mdash; Recruitment Lead, Healthcare Staffing Firm
              </p>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Beyond ATS ── */}
      <section className="relative z-10 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Beyond a basic ATS
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Not just an ATS.{" "}
              <span className="text-primary">A complete hiring engine.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-muted-foreground">
              Multi-tenant by design, role-aware, and built to run real staffing operations.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: "Multi-tenant workspaces",
                description:
                  "Org-level isolation with row-level security. Run multiple business units, clients, or zones from one platform without leaking data.",
              },
              {
                icon: Shield,
                title: "Role-based access",
                description:
                  "Platform admin, super admin, manager, recruiter, and zonal coordinator roles — each with the right level of access.",
              },
              {
                icon: ClipboardList,
                title: "Headcount agreements",
                description:
                  "Manage staffing commitments across sites and zones. Zonal coordinators get a dedicated portal with their own access.",
              },
              {
                icon: QrCode,
                title: "Public Apply, no login",
                description:
                  "Every recruiter gets a unique QR code for sourcing. Applications go straight into the pipeline, tagged to the recruiter.",
              },
              {
                icon: Users2,
                title: "Teams & assignments",
                description:
                  "Group recruiters into teams, set leads, and assign mandates with bulk actions. Performance dashboards per team.",
              },
              {
                icon: Globe,
                title: "Webhooks & integrations",
                description:
                  "Inbound webhooks with field mapping for job-board ingestion. Outbound webhooks for HRIS, payroll, and onboarding tools.",
              },
            ].map((b) => (
              <motion.div
                key={b.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl border border-border/60 bg-card/80 p-7 backdrop-blur-sm transition-colors hover:border-primary/30"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.description}</p>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 border-t border-border/50 bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Pricing
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Simple, transparent <span className="text-primary">pricing</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-5 text-lg text-muted-foreground">
              Start with a 14-day full-access trial. No credit card required.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`relative ${plan.popular ? "lg:scale-105" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <Card
                  className={`relative flex h-full flex-col overflow-hidden ${
                    plan.popular ? "ring-2 ring-primary shadow-xl shadow-primary/10" : ""
                  }`}
                >
                  <CardHeader className="p-6 pb-0">
                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                    <div className="mt-5">
                      <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                      {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                    </div>
                    {plan.billing && (
                      <p className="mt-1.5 text-xs font-medium text-primary">{plan.billing}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 p-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {plan.footnote && (
                      <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                        {plan.footnote}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      className="w-full shadow-lg shadow-primary/20"
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      onClick={() => navigate(plan.ctaLink)}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative z-10 border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection>
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-teal-600 px-6 py-20 text-center sm:px-16"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-2xl" />
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                    backgroundSize: "40px 40px",
                  }}
                />
              </div>

              <div className="relative">
                <h2 className="text-3xl font-bold text-primary-foreground sm:text-5xl">
                  Your candidates, mandates, calls
                  <br className="hidden sm:block" />
                  and AI &mdash; all in sync.
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80">
                  Built-in calling, WhatsApp campaigns, AI resume parsing, and pipeline analytics. Set up
                  in 2 minutes — no credit card.
                </p>
                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => navigate("/create-org")}
                    className="group text-base px-8 shadow-xl bg-white text-primary hover:bg-white/90"
                  >
                    Start 14-Day Trial
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/auth")}
                    className="text-base px-8 border-white/30 text-primary-foreground bg-transparent hover:bg-white/10 hover:text-primary-foreground"
                  >
                    Sign In
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
                  {["14-day full-access trial", "No credit card required", "Cancel anytime"].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/50 bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <img src={atsLogo} alt="In-Sync ATS" className="h-8 w-auto" />
              <span className="font-semibold text-foreground">In-Sync ATS</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="transition-colors hover:text-foreground">
                Privacy Policy
              </a>
              <a href="#" className="transition-colors hover:text-foreground">
                Terms of Service
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} ECR Technical Innovations Pvt. Ltd. &bull; in-sync.co.in
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

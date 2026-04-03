import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Zap,
  GraduationCap,
  Library,
  Globe,
  Shield,
  Play,
  LayoutGrid,
  Sparkles,
  Brain,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/AuthDialog";
import { Logo } from "@/components/Logo";
import { useAuthContext } from "@/contexts/AuthContext";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const features = [
  { icon: Zap, title: "Instant Synthesis", desc: "Turn hours of video into structured, scannable notes in seconds." },
  { icon: GraduationCap, title: "Study Tools", desc: "Auto-generate quizzes, flashcards, and learning roadmaps." },
  { icon: Library, title: "Smart Spaces", desc: "Organize everything by topic, course, or project." },
  { icon: Brain, title: "Mind Maps", desc: "Visualize concepts and relationships in interactive diagrams." },
  { icon: MessageSquare, title: "AI Chat", desc: "Ask questions about any video — get answers with timestamps." },
  { icon: BookOpen, title: "Deep Analysis", desc: "Get expert-level breakdowns tailored to your skill level." },
];

const steps = [
  { num: "01", title: "Paste a link", desc: "Drop any YouTube URL and choose your analysis depth." },
  { num: "02", title: "AI does the work", desc: "We extract, transcribe, and synthesize — automatically." },
  { num: "03", title: "Learn & organize", desc: "Review insights, take quizzes, and save to your spaces." },
];

export default function LandingPage() {
  const { fetchUserData, isAuthenticated, isLoading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* ── Background Orbs ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="animate-orb-1 absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div className="animate-orb-2 absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[hsl(234,89%,64%)]/[0.07] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/[0.03] blur-[150px]" />
      </div>

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Logo className="hover:opacity-90 transition-opacity" />

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
          </div>

          <div>
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button className="h-9 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <AuthDialog onSuccess={fetchUserData} />
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-32 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          <motion.div
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-4 py-1.5 mb-8"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">AI-Powered Video Learning</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="max-w-4xl text-center text-5xl font-extrabold tracking-tight leading-[1.08] mb-6 md:text-7xl lg:text-[5rem]"
          >
            Turn any video into{" "}
            <span className="text-gradient">structured knowledge</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-2xl text-center text-lg leading-8 text-muted-foreground mb-10"
          >
            VidCrunch uses AI to transform YouTube content into summaries, mind maps, quizzes, flashcards, and learning paths — so you can learn faster and retain more.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col items-center gap-4 sm:flex-row"
          >
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="lg" className="h-13 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 gap-2 transition-all hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5">
                  Go to Dashboard <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <AuthDialog
                trigger={
                  <Button size="lg" className="h-13 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 gap-2 transition-all hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5">
                    Get started free <ArrowRight className="h-5 w-5" />
                  </Button>
                }
                onSuccess={fetchUserData}
              />
            )}
            <Button variant="outline" size="lg" className="h-13 rounded-full border-white/[0.08] bg-white/[0.03] px-8 text-base font-semibold text-foreground hover:bg-white/[0.06] gap-2">
              <Play className="h-4 w-4" /> Watch demo
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="mt-12 flex flex-wrap items-center justify-center gap-5">
            {[
              { value: "1-Click", label: "Analysis" },
              { value: "8+ Tools", label: "Generated" },
              { value: "10x Faster", label: "Learning" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 rounded-full border border-white/[0.06] bg-white/[0.03] px-5 py-2.5">
                <span className="text-sm font-bold text-foreground">{stat.value}</span>
                <span className="h-1 w-1 rounded-full bg-primary/50" />
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Product Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-20 w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-xl shadow-2xl shadow-black/20"
        >
          <div className="border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="rounded-lg bg-white/[0.04] px-16 py-1.5 text-xs text-muted-foreground font-medium">
                vidcrunch.ai/dashboard
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-[1.4fr_0.6fr] gap-px bg-white/[0.04]">
            <div className="bg-background/80 p-8">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Analysis in progress
              </div>
              <div className="space-y-3">
                {["Summary & key points generated", "Mind map created", "Quiz with 10 questions ready"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-background/60 p-8 flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">What you get</p>
              <div className="grid grid-cols-2 gap-2">
                {["Summaries", "Mind Maps", "Flashcards", "Quizzes", "Roadmaps", "AI Chat"].map((item) => (
                  <div key={item} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-center text-xs font-semibold text-foreground/80">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="relative z-10 border-t border-white/[0.06] py-24 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-primary">Features</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Everything you need to <span className="text-gradient">learn smarter</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              A complete AI-powered toolkit for turning video content into deep understanding.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-6 rounded-2xl border border-white/[0.06] bg-card/40 backdrop-blur-sm hover:border-primary/20 hover:bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center mb-5 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-bold mb-2 text-foreground">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 py-24 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-primary">How it works</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
              Three steps to <span className="text-gradient">deeper learning</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative p-6 rounded-2xl border border-white/[0.06] bg-card/40 backdrop-blur-sm"
              >
                <span className="text-4xl font-black text-primary/15 mb-4 block">{step.num}</span>
                <h3 className="text-lg font-bold mb-2 text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-24 px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent p-12 md:p-16 relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-[60px]" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-[hsl(234,89%,64%)]/10 blur-[60px]" />
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 relative">
            Ready to learn <span className="text-gradient">10x faster</span>?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 relative">
            Join thousands of learners using AI to master video content.
          </p>
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button size="lg" className="h-13 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 gap-2 relative">
                Go to Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <AuthDialog
              trigger={
                <Button size="lg" className="h-13 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 shadow-xl shadow-primary/25 gap-2 relative">
                  Start free now <ArrowRight className="h-5 w-5" />
                </Button>
              }
              onSuccess={fetchUserData}
            />
          )}
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-10 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="scale-75 origin-left opacity-80 hover:opacity-100 transition-opacity">
            <Logo />
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            © 2026 VidCrunch AI. All rights reserved.
          </div>
          <div className="flex gap-6 text-xs font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

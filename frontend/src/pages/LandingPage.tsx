import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap, GraduationCap, Library, Globe, Shield, Play, LayoutGrid } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuthContext } from "@/contexts/AuthContext";

export default function LandingPage() {
  const { fetchUserData, isAuthenticated, isLoading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">TB</span>
          </div>
          <span className="font-bold text-xl tracking-tight">TubeBrain</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#about" className="hover:text-foreground transition-colors">About</a>
        </div>

        <div>
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button className="rounded-2xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg shadow-primary/10">
                <LayoutGrid className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <AuthDialog onSuccess={fetchUserData} />
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-12 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary border border-border mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Now with AI Roadmap Generation</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[0.9]"
        >
          Master any <span className="text-muted-foreground/50">video</span> in minutes.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
        >
          TubeBrain uses advanced AI to synthesize YouTube videos into structured knowledge, quizzes, and learning paths. Stop watching, start mastering.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button size="lg" className="rounded-2xl h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-bold gap-2 shadow-xl shadow-primary/10">
                Go to Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <AuthDialog 
              trigger={
                <Button size="lg" className="rounded-2xl h-14 px-8 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-bold gap-2 shadow-xl shadow-primary/10">
                  Get Started for Free <ArrowRight className="h-5 w-5" />
                </Button>
              }
              onSuccess={fetchUserData} 
            />
          )}
          <Button variant="outline" size="lg" className="rounded-2xl h-14 px-8 border-border text-base font-bold">
            Watch Demo
          </Button>
        </motion.div>

        {/* Hero Visual */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-20 w-full max-w-5xl aspect-video bg-secondary rounded-[40px] border border-border shadow-2xl overflow-hidden relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-20 h-20 bg-card rounded-full shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
               <Play className="h-8 w-8 text-foreground ml-1" />
             </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-8 left-8 w-64 h-32 bg-card/80 backdrop-blur rounded-2xl shadow-xl border border-border/50 p-4 text-left">
             <div className="w-8 h-2 bg-muted rounded mb-3" />
             <div className="w-full h-2 bg-secondary rounded mb-2" />
             <div className="w-4/5 h-2 bg-secondary rounded " />
          </div>
          <div className="absolute bottom-8 right-8 w-48 h-48 bg-card/80 backdrop-blur rounded-[32px] shadow-xl border border-border/50 p-6 flex flex-col justify-between">
             <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
               <Zap className="h-6 w-6 text-primary-foreground" />
             </div>
             <div className="text-left">
               <div className="text-2xl font-black text-foreground">98%</div>
               <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Efficiency GAIN</div>
             </div>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 lg:px-12 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Everything you need to learn faster.</h2>
            <p className="text-muted-foreground">Advanced AI tools built for serious learners.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Instant Synthesis", desc: "Convert hour-long lectures into 5-minute actionable summaries." },
              { icon: GraduationCap, title: "Mastery Tools", desc: "Generate quizzes, flashcards, and mind maps automatically." },
              { icon: Library, title: "Personal Library", desc: "Organize your knowledge into custom learning spaces." },
              { icon: Globe, title: "Multilingual Support", desc: "Analyze videos in any language and get summaries in yours." },
              { icon: Shield, title: "Source Verified", desc: "Every insight is backed by timestamps directly from the video." },
              { icon: ArrowRight, title: "And much more...", desc: "Roadmaps, expert modes, and deep-dives at your fingertips." },
            ].map((f, i) => (
              <div key={i} className="p-8 bg-card rounded-[32px] border border-border hover:border-primary/20 hover:shadow-xl transition-all group">
                <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 lg:px-12 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50 gray-scale">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[10px]">TB</span>
            </div>
            <span className="font-bold text-sm tracking-tight">TubeBrain</span>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            © 2026 TubeBrain AI. All rights reserved. Built for production.
          </div>
          <div className="flex gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

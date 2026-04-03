import { motion } from "framer-motion";
import { FolderOpen, PlusCircle, History as HistoryIcon, Sparkles, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import UrlInput from "@/components/UrlInput";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAnalysisContext } from "@/contexts/AnalysisContext";
import { useSpacesContext } from "@/contexts/SpacesContext";
import { getRelativeDate } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const {
    handleSubmit,
    isLoading,
    analysisStyle,
    setAnalysisStyle,
    handleLoadHistoryItem,
  } = useAnalysisContext();
  const { spaces, historyItems } = useSpacesContext();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-24"
    >
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-8">
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <motion.div variants={fadeUp} className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.08] px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Workspace
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Welcome back, <span className="text-gradient">{user?.name?.split(" ")[0] || "there"}</span>
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              Paste a video link to start learning, or pick up where you left off.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Spaces", value: spaces.length, color: "from-primary/15 to-primary/5" },
              { label: "Recents", value: historyItems.length, color: "from-blue-500/15 to-blue-500/5" },
              { label: "Style", value: analysisStyle || "Auto", color: "from-emerald-500/15 to-emerald-500/5" },
            ].map((item) => (
              <div key={item.label} className={`min-w-[90px] rounded-xl border border-white/[0.06] bg-gradient-to-br ${item.color} px-4 py-3.5`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <p className="mt-1.5 text-xl font-extrabold tracking-tight text-foreground">{item.value}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Analysis Input Section */}
      <section className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.06] bg-card/40 backdrop-blur-sm p-6 shadow-xl shadow-black/5"
        >
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">New analysis</p>
                <h2 className="mt-1.5 text-lg font-bold tracking-tight text-foreground">Paste a link or upload a file</h2>
              </div>

              <UrlInput
                onSubmit={handleSubmit}
                isLoading={isLoading}
                onUploadComplete={(_, analysisId) => {
                  toast.success("Video uploaded. Processing started.");
                  if (analysisId) {
                    navigate(`/analysis/${analysisId}`);
                  }
                }}
                analysisStyle={analysisStyle}
                onStyleChange={setAnalysisStyle}
              />
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">How it works</p>
              <div className="space-y-3">
                {[
                  { title: "Add source", desc: "Drop in a URL, paste text, or upload media." },
                  { title: "AI synthesis", desc: "Get summaries, quizzes, mind maps, and more." },
                  { title: "Save & learn", desc: "Organize into spaces and review anytime." },
                ].map((step, index) => (
                  <div key={step.title} className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3.5 py-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="max-w-5xl mx-auto px-6 mt-10 space-y-10">
        {/* Spaces */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Spaces</h3>
            <Link to="/library" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-primary flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {spaces.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {spaces.slice(0, 6).map((space, i) => (
                <motion.div key={space.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                  <Link
                    to={`/space/${space.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-sm p-5 text-left transition-all duration-300 hover:border-primary/20 hover:bg-card/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 min-h-[120px]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/10 transition-colors group-hover:bg-primary/15">
                      <FolderOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-4">
                      <span className="block truncate text-sm font-bold text-foreground">{space.name}</span>
                      <span className="text-xs text-muted-foreground">{space.videoIds.length} items</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
                <PlusCircle className="h-7 w-7 text-primary/50" />
              </div>
              <p className="text-sm font-bold text-foreground">Create your first space</p>
              <p className="mt-1 text-xs text-muted-foreground">Organize learning by topic, project, or course.</p>
              <Button
                onClick={() => toast.info("Use the sidebar to create new spaces!")}
                variant="outline"
                className="mt-5 h-9 rounded-full border-white/[0.08] bg-white/[0.03] px-5 text-xs font-semibold hover:bg-white/[0.06]"
              >
                Add space
              </Button>
            </div>
          )}
        </motion.section>

        {/* Recents */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent analyses</h3>
            <Link to="/history" className="text-xs font-semibold text-muted-foreground transition-colors hover:text-primary flex items-center gap-1">
              View history <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {historyItems.slice(0, 3).map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                onClick={() => handleLoadHistoryItem(item)}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-sm text-left transition-all duration-300 hover:border-primary/20 hover:bg-card/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-secondary/20">
                  <img
                    src={`https://img.youtube.com/vi/${item.videoIds[0]}/maxresdefault.jpg`}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-background/70 backdrop-blur-sm px-2 py-1">
                    <Zap className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-semibold text-foreground">Analyzed</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground">{getRelativeDate(item.date)}</span>
                    <span className="h-1 w-1 rounded-full bg-primary/30" />
                    <span className="max-w-[100px] truncate text-[10px] font-medium text-muted-foreground">{item.videoData?.channel}</span>
                  </div>
                </div>
              </motion.button>
            ))}

            {historyItems.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] py-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
                  <HistoryIcon className="h-7 w-7 text-primary/50" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">No recent activity</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Start by analyzing a video above</p>
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}

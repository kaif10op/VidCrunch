import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Youtube, Sparkles, Zap, BookOpen, Clock } from "lucide-react";
import UrlInput from "@/components/UrlInput";
import VideoPreview from "@/components/VideoPreview";
import SummaryDisplay from "@/components/SummaryDisplay";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { toast } from "sonner";

// Extract YouTube video ID from URL
const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Mock summary data (will be replaced by AI backend)
const mockSummary = {
  overview: "This video provides a comprehensive deep-dive into modern web development practices, covering everything from component architecture to deployment strategies. The presenter walks through real-world examples demonstrating how to build scalable applications using the latest frameworks and tooling.",
  keyPoints: [
    "Component-based architecture enables better code reusability and maintainability across large applications",
    "Server-side rendering and static generation can dramatically improve performance and SEO",
    "Type safety with TypeScript catches bugs at compile time rather than runtime",
    "Modern CSS solutions like Tailwind provide utility-first approaches that scale with team size",
    "Edge computing and serverless functions reduce infrastructure complexity",
    "Testing strategies should cover unit, integration, and end-to-end scenarios",
  ],
  takeaways: [
    "Start with a solid design system before writing component code",
    "Invest in developer experience tooling early — it pays off exponentially",
    "Performance optimization should be iterative, not premature",
    "Choose boring technology for critical paths, experiment at the edges",
  ],
  timestamps: [
    { time: "0:00", label: "Introduction and overview" },
    { time: "2:34", label: "Setting up the project architecture" },
    { time: "8:15", label: "Building the component library" },
    { time: "15:42", label: "State management patterns" },
    { time: "23:10", label: "API integration and data fetching" },
    { time: "31:05", label: "Testing strategies and best practices" },
    { time: "38:20", label: "Deployment and CI/CD pipeline" },
    { time: "44:50", label: "Q&A and closing thoughts" },
  ],
  tags: ["Web Development", "React", "TypeScript", "Architecture", "Performance"],
};

const mockVideo = {
  title: "The Ultimate Guide to Modern Web Development in 2026",
  channel: "Tech Explained",
  duration: "47:23",
  views: "1.2M views",
  likes: "45K",
  published: "Mar 5, 2026",
};

const features = [
  { icon: <Sparkles className="h-5 w-5" />, title: "AI-Powered", desc: "Smart summaries using advanced AI" },
  { icon: <Zap className="h-5 w-5" />, title: "Instant", desc: "Get summaries in seconds" },
  { icon: <BookOpen className="h-5 w-5" />, title: "Comprehensive", desc: "Key points, timestamps & more" },
  { icon: <Clock className="h-5 w-5" />, title: "Time-Saver", desc: "Hours of content in minutes" },
];

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [videoData, setVideoData] = useState<typeof mockVideo | null>(null);
  const [summaryData, setSummaryData] = useState<typeof mockSummary | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const handleSubmit = async (url: string) => {
    const id = extractVideoId(url);
    if (!id) {
      toast.error("Invalid YouTube URL. Please paste a valid link.");
      return;
    }

    setVideoId(id);
    setIsLoading(true);
    setSummaryData(null);
    setVideoData(null);

    // Simulate fetching video info
    setTimeout(() => {
      setVideoData({
        ...mockVideo,
      });
    }, 500);

    // Simulate AI summary generation
    setTimeout(() => {
      setSummaryData(mockSummary);
      setIsLoading(false);
      toast.success("Summary generated successfully!");
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background bg-grid relative">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Youtube className="h-4 w-4" />
            YouTube Summarizer
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-4 text-gradient leading-tight">
            Summarize Any
            <br />
            YouTube Video
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Paste a link and get an AI-powered summary with key points, timestamps, and actionable takeaways.
          </p>
        </motion.div>

        {/* URL Input */}
        <UrlInput onSubmit={handleSubmit} isLoading={isLoading} />

        {/* Features (show when no results) */}
        <AnimatePresence>
          {!videoData && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-16"
            >
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="glass-card rounded-xl p-4 text-center"
                >
                  <div className="text-primary mb-2 flex justify-center">{f.icon}</div>
                  <h3 className="font-display font-semibold text-sm text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground text-xs mt-1">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="mt-8 space-y-6">
          <AnimatePresence>
            {videoData && videoId && (
              <VideoPreview
                videoId={videoId}
                thumbnail={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                {...videoData}
              />
            )}
          </AnimatePresence>

          {isLoading && <LoadingSkeleton />}

          <AnimatePresence>
            {summaryData && !isLoading && <SummaryDisplay {...summaryData} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Index;

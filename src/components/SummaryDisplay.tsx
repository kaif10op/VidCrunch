import { motion } from "framer-motion";
import { Copy, Check, BookOpen, Lightbulb, ListChecks, Clock, Hash } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SummarySection {
  title: string;
  icon: React.ReactNode;
  content: string;
}

interface Timestamp {
  time: string;
  label: string;
}

interface SummaryDisplayProps {
  overview: string;
  keyPoints: string[];
  takeaways: string[];
  timestamps: Timestamp[];
  tags: string[];
}

const SummaryDisplay = ({ overview, keyPoints, takeaways, timestamps, tags }: SummaryDisplayProps) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAll = () => {
    const full = `## Overview\n${overview}\n\n## Key Points\n${keyPoints.map(p => `• ${p}`).join("\n")}\n\n## Takeaways\n${takeaways.map(t => `• ${t}`).join("\n")}\n\n## Timestamps\n${timestamps.map(t => `${t.time} - ${t.label}`).join("\n")}`;
    copyToClipboard(full, "all");
  };

  const sections: SummarySection[] = [
    { title: "Overview", icon: <BookOpen className="h-4 w-4" />, content: overview },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-foreground">Summary</h2>
        <Button variant="glass" size="sm" onClick={copyAll} className="gap-2">
          {copiedSection === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedSection === "all" ? "Copied!" : "Copy All"}
        </Button>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
              <Hash className="h-3 w-3" />{tag}
            </span>
          ))}
        </motion.div>
      )}

      {/* Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-card rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Overview</h3>
        </div>
        <p className="text-secondary-foreground leading-relaxed text-sm">{overview}</p>
      </motion.div>

      {/* Key Points */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Key Points</h3>
        </div>
        <ul className="space-y-2.5">
          {keyPoints.map((point, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="flex items-start gap-3 text-sm text-secondary-foreground"
            >
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              {point}
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Timestamps */}
      {timestamps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-xl p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Timestamps</h3>
          </div>
          <div className="space-y-2">
            {timestamps.map((ts, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-primary font-medium min-w-[4rem]">{ts.time}</span>
                <span className="text-secondary-foreground">{ts.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Takeaways */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass-card rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Key Takeaways</h3>
        </div>
        <div className="grid gap-2.5">
          {takeaways.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              className="flex items-start gap-3 text-sm text-secondary-foreground bg-secondary/30 rounded-lg p-3"
            >
              <span className="font-display font-bold text-primary text-xs mt-0.5">{String(i + 1).padStart(2, '0')}</span>
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SummaryDisplay;

import { motion } from "framer-motion";

const ShimmerBar = ({ className }: { className?: string }) => (
  <div className={`relative overflow-hidden bg-secondary rounded-lg ${className || ""}`}>
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-background/40 to-transparent animate-shimmer" />
  </div>
);

const LoadingSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading content"
    >
      {/* Overview card */}
      <div className="bg-card rounded-3xl p-8 space-y-5 border border-border shadow-sm">
        <ShimmerBar className="h-7 w-40" />
        <div className="space-y-3">
          <ShimmerBar className="h-4 w-full" />
          <ShimmerBar className="h-4 w-[90%]" />
          <ShimmerBar className="h-4 w-[75%]" />
        </div>
      </div>

      {/* Key points card */}
      <div className="bg-card rounded-3xl p-8 space-y-5 border border-border shadow-sm">
        <ShimmerBar className="h-7 w-32" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start gap-3">
              <ShimmerBar className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
              <ShimmerBar className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Chapters card */}
      <div className="bg-card rounded-3xl p-8 space-y-5 border border-border shadow-sm">
        <ShimmerBar className="h-7 w-36" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-secondary/30">
            <ShimmerBar className="h-5 w-12 shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-5 w-3/4" />
              <ShimmerBar className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default LoadingSkeleton;

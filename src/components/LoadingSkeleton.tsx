import { motion } from "framer-motion";

const LoadingSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-secondary/60 rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-secondary/60 rounded animate-pulse" />
          <div className="h-3 w-3/5 bg-secondary/60 rounded animate-pulse" />
        </div>
      </div>
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="h-5 w-28 bg-secondary rounded animate-pulse" />
        {[1,2,3,4].map(i => (
          <div key={i} className="h-3 bg-secondary/60 rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
        ))}
      </div>
      <div className="glass-card rounded-xl p-5 space-y-3">
        <div className="h-5 w-36 bg-secondary rounded animate-pulse" />
        {[1,2,3].map(i => (
          <div key={i} className="h-10 bg-secondary/40 rounded-lg animate-pulse" />
        ))}
      </div>
    </motion.div>
  );
};

export default LoadingSkeleton;

import { motion } from "framer-motion";

const LoadingSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100 shadow-sm">
        <div className="h-6 w-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-50 rounded-lg animate-pulse" />
          <div className="h-4 w-4/5 bg-gray-50 rounded-lg animate-pulse" />
          <div className="h-4 w-3/5 bg-gray-50 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100 shadow-sm">
        <div className="h-6 w-28 bg-gray-100 rounded-lg animate-pulse" />
        {[1,2,3,4].map(i => (
          <div key={i} className="h-4 bg-gray-50 rounded-lg animate-pulse" style={{ width: `${80 - i * 10}%` }} />
        ))}
      </div>
      <div className="bg-white rounded-3xl p-6 space-y-4 border border-gray-100 shadow-sm">
        <div className="h-6 w-36 bg-gray-100 rounded-lg animate-pulse" />
        {[1,2,3].map(i => (
          <div key={i} className="h-12 bg-gray-50 rounded-2xl animate-pulse" />
        ))}
      </div>
    </motion.div>
  );
};

export default LoadingSkeleton;

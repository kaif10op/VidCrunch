import { motion, AnimatePresence } from "framer-motion";
import { Eye, ThumbsUp, Calendar, Play, Pause } from "lucide-react";
import { useState } from "react";

interface VideoPreviewProps {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  likes: string;
  published: string;
  thumbnail: string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  compact?: boolean;
}

const VideoPreview = ({ videoId, title, channel, duration, views, likes, published, thumbnail, iframeRef, compact }: VideoPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm"
    >
      {/* Full-width video player */}
      <div className={`relative w-full bg-black ${compact ? "aspect-video" : "aspect-video"}`}>
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full"
            >
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
                title={title}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </motion.div>
          ) : (
            <motion.div
              key="thumbnail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full group cursor-pointer"
              onClick={() => setIsPlaying(true)}
            >
              <img
                src={thumbnail}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-black shadow-xl transform transition-all group-hover:scale-110 border border-white">
                  <Play className="h-6 w-6 fill-current ml-1" />
                </div>
              </div>
              {duration && (
                <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm text-white text-[10px] font-black px-2 py-1 rounded-md tracking-wider uppercase">
                  {duration}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default VideoPreview;

import { motion, AnimatePresence } from "framer-motion";
import { Eye, ThumbsUp, Play } from "lucide-react";
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
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl overflow-hidden border border-gray-100"
    >
      {/* Video player */}
      <div className="relative w-full bg-black aspect-video">
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
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`}
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
                <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-black shadow-xl transform transition-all group-hover:scale-110 border border-white" role="button" aria-label={`Play ${title}`}>
                  <Play className="h-6 w-6 fill-current ml-1" />
                </div>
              </div>
              {duration && duration !== "N/A" && (
                <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-md">
                  {duration}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video info bar */}
      <div className="bg-white px-5 py-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{channel}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          {views && views !== "N/A" && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{views}</span>
            </div>
          )}
          {likes && likes !== "N/A" && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{likes}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default VideoPreview;

import { motion } from "framer-motion";
import { Clock, Eye, ThumbsUp, Calendar } from "lucide-react";

interface VideoPreviewProps {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  likes: string;
  published: string;
  thumbnail: string;
}

const VideoPreview = ({ videoId, title, channel, duration, views, likes, published, thumbnail }: VideoPreviewProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-card rounded-xl overflow-hidden"
    >
      <div className="flex flex-col md:flex-row">
        <div className="relative md:w-80 shrink-0">
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-48 md:h-full object-cover"
          />
          <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-xs font-medium px-2 py-1 rounded-md">
            {duration}
          </div>
        </div>
        <div className="p-5 flex flex-col justify-center gap-3">
          <h3 className="font-display font-semibold text-lg text-foreground leading-tight">
            {title}
          </h3>
          <p className="text-primary font-medium text-sm">{channel}</p>
          <div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
            <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{views}</span>
            <span className="flex items-center gap-1.5"><ThumbsUp className="h-3.5 w-3.5" />{likes}</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{published}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoPreview;

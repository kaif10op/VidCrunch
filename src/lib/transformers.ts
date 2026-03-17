import type { VideoData, SummaryData, Metadata } from '@/lib/storage';
import type { QuizQuestion, RoadmapStep, MindMapData, Timestamp, LearningContext } from '@/lib/storage';

/**
 * Transforms raw backend API response into frontend TypeScript interfaces.
 * Used by: fetchHistory, pollAnalysis, loadAnalysis
 */
export function transformBackendAnalysis(data: any): {
  videoData: VideoData;
  summaryData: SummaryData;
  metadata: Metadata;
  videoIds: string[];
} {
  const { analysis, video, transcript_text, transcript_segments } = data;

  // Transform VideoData
  const vData: VideoData = {
    title: video.title || "Video Analysis",
    channel: video.channel || "YouTube",
    duration: video.duration_seconds ? String(video.duration_seconds) : "N/A",
    views: video.view_count ? video.view_count.toLocaleString() : "N/A",
    likes: video.like_count ? video.like_count.toLocaleString() : "N/A",
    published: video.created_at
  };

  // Transform timestamps consistently
  const transformTimestamps = (tsArray: any[]): Timestamp[] => {
    return (tsArray || []).map((t) => ({
      time: t.timestamp !== undefined ? String(t.timestamp) : String(t.time || "0:00"),
      label: t.topic || t.label || ""
    }));
  };

  // Transform SummaryData
  const sData: SummaryData = {
    overview: analysis.overview || "",
    keyPoints: analysis.key_points || [],
    takeaways: analysis.takeaways || [],
    timestamps: transformTimestamps(analysis.timestamps),
    tags: analysis.tags || [],
    quiz: analysis.quiz,
    roadmap: analysis.roadmap,
    mind_map: analysis.mind_map,
    flashcards: analysis.flashcards,
    transcript_segments: transcript_segments || analysis.transcript_segments || [],
    learning_context: analysis.learning_context,
    glossary: analysis.glossary || [],
    resources: analysis.resources || []
  };

  // Transform Metadata
  const mData: Metadata = {
    title: vData.title,
    channel: vData.channel,
    duration: vData.duration,
    thumbnails: [{
      url: video.thumbnail_url || `https://img.youtube.com/vi/${video.platform_id}/maxresdefault.jpg`,
      width: 1280,
      height: 720
    }]
  };

  return {
    videoData: vData,
    summaryData: sData,
    metadata: mData,
    videoIds: [video.platform_id]
  };
}

/**
 * Safely parse JSON from localStorage with error recovery
 */
export function safeJSONParse<T>(data: string | null, defaultValue: T): T {
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Failed to parse localStorage data, returning default:', error);
    return defaultValue;
  }
}

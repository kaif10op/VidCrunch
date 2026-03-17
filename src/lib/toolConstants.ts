/**
 * Centralized tool identifiers and mappings.
 * These constants ensure consistency across the codebase.
 */

export const TOOL_IDS = {
  // Generated tools (require API call)
  OVERVIEW: 'overview',
  KEY_POINTS: 'key_points',
  TAKEAWAYS: 'takeaways',
  TAGS: 'tags',
  LEARNING_CONTEXT: 'learning_context',
  QUIZ: 'quiz',
  ROADMAP: 'roadmap',
  MIND_MAP: 'mind_map',
  FLASHCARDS: 'flashcards',
  PODCAST: 'podcast',
  GLOSSARY: 'glossary',
  RESOURCES: 'resources',

  // Utility tools (immediate UI)
  NOTES: 'notes',
  SUMMARY: 'summary',
  SYNTHESIS: 'synthesis',
  CHAPTERS: 'chapters',
  TRANSCRIPT: 'transcript',
  VIDEO: 'video',

  // Special actions
  DEEPDIVE: 'deepdive',
  EXPLAIN: 'explain',
  ASK: 'ask',
} as const;

export const TOOL_TYPE_MAP: Record<string, keyof import('@/lib/storage').SummaryData> = {
  [TOOL_IDS.OVERVIEW]: 'overview',
  [TOOL_IDS.KEY_POINTS]: 'keyPoints',
  [TOOL_IDS.TAKEAWAYS]: 'takeaways',
  [TOOL_IDS.TAGS]: 'tags',
  [TOOL_IDS.LEARNING_CONTEXT]: 'learning_context',
  [TOOL_IDS.QUIZ]: 'quiz',
  [TOOL_IDS.ROADMAP]: 'roadmap',
  [TOOL_IDS.MIND_MAP]: 'mind_map',
  [TOOL_IDS.FLASHCARDS]: 'flashcards',
  [TOOL_IDS.GLOSSARY]: 'glossary',
  [TOOL_IDS.RESOURCES]: 'resources',
} as const;

export const GENERATABLE_TOOLS = [
  TOOL_IDS.OVERVIEW,
  TOOL_IDS.KEY_POINTS,
  TOOL_IDS.TAKEAWAYS,
  TOOL_IDS.TAGS,
  TOOL_IDS.LEARNING_CONTEXT,
  TOOL_IDS.QUIZ,
  TOOL_IDS.ROADMAP,
  TOOL_IDS.MIND_MAP,
  TOOL_IDS.FLASHCARDS,
  TOOL_IDS.PODCAST,
  TOOL_IDS.GLOSSARY,
  TOOL_IDS.RESOURCES,
] as const;

export const UTILITY_TOOLS = [
  TOOL_IDS.NOTES,
  TOOL_IDS.SUMMARY,
  TOOL_IDS.SYNTHESIS,
  TOOL_IDS.CHAPTERS,
  TOOL_IDS.TRANSCRIPT,
  TOOL_IDS.VIDEO,
] as const;

export const ON_DEMAND_TOOLS = [
  ...GENERATABLE_TOOLS,
  ...UTILITY_TOOLS,
  TOOL_IDS.DEEPDIVE,
  TOOL_IDS.EXPLAIN,
  TOOL_IDS.ASK,
] as const;

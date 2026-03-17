/** Lazy-loaded components for better performance */
import { lazy, Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Heavy components that are loaded on-demand
export const LearnTools = lazy(() =>
  import("@/components/LearnTools").then((mod) => ({ default: mod.default }))
);

export const Flashcards = lazy(() =>
  import("@/components/Flashcards").then((mod) => ({ default: mod.default }))
);

export const MindMapDetail = lazy(() =>
  import("@/components/MindMapDetail").then((mod) => ({ default: mod.default }))
);

export const QuizTab = lazy(() =>
  import("@/components/QuizTab").then((mod) => ({ default: mod.default }))
);

export const RoadmapTab = lazy(() =>
  import("@/components/RoadmapTab").then((mod) => ({ default: mod.default }))
);

export const SynthesisTab = lazy(() =>
  import("@/components/SynthesisTab").then((mod) => ({ default: mod.default }))
);

export const NotesTool = lazy(() =>
  import("@/components/NotesTool").then((mod) => ({ default: mod.default }))
);

export const AIChatSidebar = lazy(() =>
  import("@/components/AIChatSidebar").then((mod) => ({ default: mod.default }))
);

// Loading fallback component
export function ComponentLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full animate-pulse" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    </div>
  );
}

// Suspense wrapper with loader
export function withLazyLoading(
  Component: ReturnType<typeof lazy>,
  fallback?: ReactNode
) {
  return function LazyWrapper(props: any) {
    return (
      <Suspense fallback={fallback || <ComponentLoader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}
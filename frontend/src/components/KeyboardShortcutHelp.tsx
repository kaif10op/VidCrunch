import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutItem {
  keys: string;
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: '← / A / [', description: 'Previous' },
  { keys: '→ / D / ]', description: 'Next' },
  { keys: 'Space / F', description: 'Flip' },
  { keys: 'M', description: 'Master' },
  { keys: 'H / I', description: 'Hint' },
  { keys: 'E', description: 'Edit' },
  { keys: 'R', description: 'Reset' },
  { keys: 'G / +', description: 'More' },
  { keys: 'S', description: 'Study Mode' },
];

export const KeyboardShortcutHelp = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?') {
        e.preventDefault();
        onClose(); // toggle handled by parent
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-help-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full"
              aria-label="Close shortcut help"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 id="shortcut-help-title" className="text-lg font-bold mb-4 flex items-center gap-2">
              <Keyboard className="h-5 w-5" /> Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {shortcuts.map(s => (
                <div key={s.description} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {s.description}
                  </span>
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                    {s.keys}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

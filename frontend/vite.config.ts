import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - split by size and purpose
          if (id.includes("node_modules")) {
            // React core
            if (id.includes("react-dom") || id.includes("react/")) {
              return "vendor-react";
            }
            // Router and routing
            if (id.includes("react-router") || id.includes("wouter")) {
              return "vendor-router";
            }
            // Radix UI - group by component type
            if (id.includes("@radix-ui")) {
              if (id.includes("dialog") || id.includes("popover") || id.includes("sheet")) {
                return "vendor-ui-overlay";
              }
              if (id.includes("select") || id.includes("combobox") || id.includes("command")) {
                return "vendor-ui-select";
              }
              return "vendor-ui";
            }
            // Animation
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            // Charts
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
            // Mind maps / flow
            if (id.includes("reactflow") || id.includes("@xyflow")) {
              return "vendor-flow";
            }
            // Video
            if (id.includes("react-youtube")) {
              return "vendor-video";
            }
            // Markdown
            if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-")) {
              return "vendor-markdown";
            }
            // State / data
            if (id.includes("@tanstack") || id.includes("zustand") || id.includes("jotai")) {
              return "vendor-state";
            }
            return "vendor-other";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
}));

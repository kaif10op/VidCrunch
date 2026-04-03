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
          if (id.includes("node_modules")) {
            // Core React/Router - Keep together to prevent "createContext" undefined issues
            if (
              id.includes("react") || 
              id.includes("react-dom") || 
              id.includes("react-router") || 
              id.includes("scheduler")
            ) {
              return "vendor-core";
            }
            
            // Major UI modules
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("framer-motion")) {
              return "vendor-ui";
            }
            
            // Large data components
            if (id.includes("recharts") || id.includes("reactflow") || id.includes("@xyflow")) {
              return "vendor-data-viz";
            }
            
            // Markdown and related
            if (id.includes("markdown") || id.includes("remark") || id.includes("rehype")) {
              return "vendor-content";
            }

            return "vendor-utils";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
}));

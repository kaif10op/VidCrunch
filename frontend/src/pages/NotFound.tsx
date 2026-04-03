import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-orb-1 absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-primary/[0.06] blur-[120px]" />
        <div className="animate-orb-2 absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-[hsl(234,89%,64%)]/[0.05] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center px-6"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", damping: 15 }}
          className="text-[8rem] md:text-[12rem] font-black leading-none text-gradient select-none"
        >
          404
        </motion.div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-4 mb-3">
          Page not found
        </h1>
        <p className="text-muted-foreground text-base max-w-md mx-auto mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="h-10 rounded-full border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold gap-2 hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </Button>
          <Link to="/">
            <Button className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

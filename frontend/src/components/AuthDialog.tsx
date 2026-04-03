
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { authApi, setAuthToken } from "@/lib/api";
import { Github, Mail, Chrome as Google } from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";

export function AuthDialog({ onSuccess, trigger }: { onSuccess?: () => void; trigger?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await (mode === "login" 
        ? authApi.login({ email, password })
        : authApi.register({ email, password, name }));
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Auth failed");
      
      setAuthToken(data.access_token);
      toast.success(mode === "login" ? "Logged in successfully" : "Registered successfully");
      setIsOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: string) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/authorize`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start gap-3 rounded-2xl">
            <Mail className="h-4 w-4" />
            <span>Sign In</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none bg-card/80 backdrop-blur-2xl rounded-[32px] shadow-2xl ring-1 ring-foreground/5">
        <div className="relative">
          {/* Decorative background element */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="p-8 space-y-8 relative z-10">
            <DialogHeader className="space-y-3">
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                  <span className="text-primary-foreground font-black text-xl">TB</span>
                </div>
              </div>
              <DialogTitle className="text-2xl font-black text-center text-foreground tracking-tight">
                {mode === "login" ? "Welcome back to TubeBrain" : "Join the future of learning"}
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground font-medium px-4">
                {mode === "login" 
                  ? "Continue your journey towards mastering any topic with the power of AI." 
                  : "Create an account to start building your personal AI-powered knowledge base."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  variant="outline" 
                  className="rounded-2xl h-14 gap-3 border-border bg-card hover:bg-secondary hover:border-muted-foreground/30 transition-all font-bold shadow-sm" 
                  onClick={() => handleOAuth("google")}
                >
                  <Google className="h-4 w-4" />
                  Google
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-2xl h-14 gap-3 border-border bg-card hover:bg-secondary hover:border-muted-foreground/30 transition-all font-bold shadow-sm" 
                  onClick={() => handleOAuth("github")}
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </Button>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                  <span className="bg-card/50 backdrop-blur-sm px-4 text-muted-foreground/50">Or continue with email</span>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {mode === "register" && (
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                        <Input 
                          id="name" 
                          placeholder="What should we call you?" 
                          value={name} 
                          onChange={e => setName(e.target.value)} 
                          required 
                          className="rounded-2xl h-14 border-border bg-secondary/30 px-6 font-bold focus:bg-background focus:ring-primary transition-all" 
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="you@example.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        className="rounded-2xl h-14 border-border bg-secondary/30 px-6 font-bold focus:bg-background focus:ring-primary transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Password</Label>
                      <Input 
                        id="password" 
                        type="password" 
                        placeholder="••••••••"
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        className="rounded-2xl h-14 border-border bg-secondary/30 px-6 font-bold focus:bg-background focus:ring-primary transition-all" 
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>

                <Button 
                  type="submit" 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-[20px] h-14 font-black text-sm shadow-xl shadow-primary/10 mt-2 active:scale-[0.98] transition-all" 
                  disabled={isLoading}
                >
                  {isLoading ? "Synchronizing..." : mode === "login" ? "Sign In" : "Get Started"}
                </Button>
              </form>

              <p className="text-center text-sm font-bold text-muted-foreground">
                {mode === "login" ? "New to TubeBrain?" : "Already joining us?"}{" "}
                <button 
                  onClick={() => setMode(mode === "login" ? "register" : "login")}
                  className="text-foreground hover:underline underline-offset-4"
                >
                  {mode === "login" ? "Create an account" : "Log in now"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

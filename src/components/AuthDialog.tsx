
import { useState } from "react";
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

export function AuthDialog({ onSuccess }: { onSuccess?: () => void }) {
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
    window.location.href = `${API_BASE_URL}/auth/${provider}/callback`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-3 rounded-2xl">
          <Mail className="h-4 w-4" />
          <span>Sign In</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-3xl border-gray-100">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold text-foreground">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Join 10,000+ learners analyzing videos with AI.
          </DialogDescription>
        </DialogHeader>

        {/* OAuth Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl h-11 gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all" onClick={() => handleOAuth("google")}>
            <Google className="h-4 w-4" />
            <span className="text-sm font-medium">Google</span>
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl h-11 gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all" onClick={() => handleOAuth("github")}>
            <Github className="h-4 w-4" />
            <span className="text-sm font-medium">GitHub</span>
          </Button>
        </div>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-3 text-muted-foreground">Or continue with email</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
              <Input id="name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required className="rounded-xl h-11 border-gray-200 focus:border-gray-300 focus:ring-1 focus:ring-gray-200" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl h-11 border-gray-200 focus:border-gray-300 focus:ring-1 focus:ring-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="rounded-xl h-11 border-gray-200 focus:border-gray-300 focus:ring-1 focus:ring-gray-200" />
          </div>
          <Button type="submit" className="w-full bg-black text-white hover:bg-gray-900 rounded-xl h-11 font-semibold text-sm mt-1" disabled={isLoading}>
            {isLoading ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button 
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-black font-semibold hover:underline"
          >
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}

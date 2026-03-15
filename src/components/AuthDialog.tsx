
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
    window.location.href = `http://localhost:8000/api/auth/${provider}/callback`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-3 rounded-2xl">
          <Mail className="h-4 w-4" />
          <span>Sign In</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </DialogTitle>
          <DialogDescription>
            Join 10,000+ learners analyzing videos with AI.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full bg-black text-white hover:bg-black/90 rounded-xl py-6" disabled={isLoading}>
            {isLoading ? "Loading..." : mode === "login" ? "Login" : "Register"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <div className="flex gap-4">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleOAuth("google")}>
            <Google className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleOAuth("github")}>
            <Github className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button 
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-black font-bold hover:underline"
          >
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}

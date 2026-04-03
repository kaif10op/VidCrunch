import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User as UserIcon, 
  Wallet, 
  Bell, 
  Settings as SettingsIcon,
  LogOut,
  Coins
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useUIContext } from "@/contexts/UIContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { 
    user, 
    credits, 
    expertise, 
    setExpertise, 
    handleUpdateProfile, 
    handleLogout,
    handlePayment,
    isLoading: isAuthLoading 
  } = useAuthContext();
  
  const { 
    theme, 
    setTheme, 
    accessibility, 
    updateAccessibility,
    setIsTopUpOpen 
  } = useUIContext();
  
  const [settingsTab, setSettingsTab] = useState("profile");
  const [newName, setNewName] = useState(user?.name || "");

  useEffect(() => {
    if (user?.name) {
      setNewName(user.name);
    }
  }, [user]);

  const onUpdateProfile = async () => {
    if (!newName.trim() || !user) return;
    await handleUpdateProfile(newName.trim());
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-xl">
        <div className="grid min-h-[700px] grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <div className="flex flex-col gap-8 border-b border-border/70 bg-background/40 p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary">
              <SettingsIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          </div>
          
          <nav className="flex flex-col gap-2">
            {[
              { id: 'profile', label: 'Profile & Experience', icon: UserIcon },
              { id: 'billing', label: 'Credits & Billing', icon: Wallet },
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSettingsTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                  settingsTab === tab.id 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto border-t border-border pt-6">
            <button 
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto p-7 lg:p-10">
          <AnimatePresence mode="wait">
            {settingsTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col gap-6 rounded-[24px] border border-border/70 bg-background/60 p-6 md:flex-row md:items-center">
                  <Avatar className="h-20 w-20 rounded-[24px] border border-border/70">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-primary text-3xl font-black text-primary-foreground">
                      {user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-2xl font-semibold tracking-tight text-foreground">{user.name}</h3>
                    <p className="text-base text-muted-foreground">{user.email}</p>
                    <div className="mt-4 flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-600">
                       <Shield className="h-3.5 w-3.5" />
                       <span className="text-[10px] font-semibold uppercase tracking-widest">Verified Learner</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground ml-1">Full Name</label>
                    <Input 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Your Name"
                      className="h-14 rounded-2xl border-border/70 px-6 font-medium focus:ring-primary bg-background text-base" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground ml-1">Email Address</label>
                    <Input 
                      value={user.email} 
                      disabled
                      className="h-14 rounded-2xl border-border/70 px-6 font-medium bg-secondary text-muted-foreground text-base cursor-not-allowed" 
                    />
                  </div>
                </div>

                <div className="space-y-7">
                  <div className="space-y-5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground ml-1">Cognitive Expertise</label>
                    <div className="flex gap-4">
                      {['Beginner', 'Intermediate', 'Expert'].map((level) => (
                        <button
                          key={level}
                          onClick={() => setExpertise(level as any)}
                          className={cn(
                            "flex-1 rounded-2xl border px-4 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors",
                            expertise === level 
                              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                              : "bg-background text-muted-foreground border-border/70 hover:border-muted-foreground/30"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground ml-1">Adjusts the depth of synthesis and study tools generated for your videos.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-7 pt-2 md:grid-cols-2">
                    <div className="space-y-5">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground ml-1">Appearance</label>
                      <div className="flex gap-2 p-1 bg-secondary rounded-2xl border border-border/70">
                        {['light', 'dark', 'system'].map((t) => (
                          <button
                            key={t}
                            onClick={() => setTheme(t as any)}
                            className={cn(
                              "flex-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors",
                              theme === t 
                                ? "bg-background text-foreground shadow-sm" 
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-5">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground ml-1">Accessibility</label>
                      <div className="flex flex-col gap-3">
                        {[
                          { id: 'highContrast', label: 'High Contrast', key: 'hc' },
                          { id: 'dyslexicFont', label: 'Dyslexic Font', key: 'df' },
                          { id: 'screenReader', label: 'Screen Reader Optim.', key: 'sr' },
                        ].map((feature) => (
                          <button
                            key={feature.id}
                            onClick={() => updateAccessibility(feature.id as any, !accessibility[feature.id as keyof typeof accessibility])}
                            className={cn(
                              "flex items-center justify-between px-5 py-3 rounded-2xl border transition-colors",
                              accessibility[feature.id as keyof typeof accessibility]
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border/70 hover:border-muted-foreground/30"
                            )}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-widest">{feature.label}</span>
                            <div className={cn(
                              "w-8 h-4 rounded-full relative transition-colors",
                              accessibility[feature.id as keyof typeof accessibility] ? "bg-primary-foreground" : "bg-muted"
                            )}>
                              <div className={cn(
                                "absolute top-0.5 w-3 h-3 rounded-full bg-background transition-all shadow-sm",
                                accessibility[feature.id as keyof typeof accessibility] ? "right-0.5" : "left-0.5"
                              )} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <Button 
                    onClick={onUpdateProfile}
                    disabled={isAuthLoading || newName === user.name}
                    className="h-14 px-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold uppercase tracking-widest text-sm"
                  >
                    Save Profile Changes
                  </Button>
                </div>
              </motion.div>
            )}

            {settingsTab === 'billing' && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="relative overflow-hidden rounded-[28px] bg-primary p-8 text-primary-foreground shadow-sm">
                  <div className="relative z-10">
                    <div className="mb-5 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary-foreground/60">Account Balance</span>
                    </div>
                    <div className="flex flex-wrap items-end gap-4">
                      <Coins className="h-12 w-12 fill-amber-400 text-amber-400" />
                      <h4 className="text-6xl font-semibold leading-none">{credits ?? 0}</h4>
                      <span className="mb-2 text-base font-medium text-primary-foreground/55">Credits Available</span>
                    </div>
                    <Button 
                      onClick={() => setIsTopUpOpen(true)}
                      className="mt-7 h-10 rounded-full bg-primary-foreground px-8 text-xs font-semibold uppercase tracking-widest text-primary hover:bg-primary-foreground/90"
                    >
                      Purchase More
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex flex-col justify-between rounded-[24px] border border-border/70 bg-card p-7 shadow-sm">
                    <div>
                      <h5 className="font-semibold text-2xl mb-2">Basic</h5>
                      <p className="text-sm text-muted-foreground mb-8">Occasional learning support.</p>
                      <ul className="space-y-4 mb-10">
                         {['60 mins analysis / day', 'Basic study tools', 'Email support'].map(f => (
                           <li key={f} className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                             {f}
                           </li>
                         ))}
                      </ul>
                    </div>
                    <Button variant="outline" className="h-12 w-full rounded-2xl border-border/70 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground cursor-not-allowed">Active Plan</Button>
                  </div>

                  <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-primary/30 bg-card p-7 shadow-sm">
                    <div className="absolute right-0 top-0 rounded-bl-3xl bg-primary px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">Recommended</div>
                    <div>
                      <h5 className="font-semibold text-2xl mb-2">VidCrunch Pro</h5>
                      <p className="text-sm text-muted-foreground mb-8">Unlimited mastery platform.</p>
                      <ul className="space-y-4 mb-10">
                         {['Unlimited analysis', 'All study sets & tools', 'Priority support', 'Early access to AI models'].map(f => (
                           <li key={f} className="flex items-center gap-3 text-xs font-medium text-foreground">
                             <div className="w-2 h-2 rounded-full bg-primary" />
                             {f}
                           </li>
                         ))}
                      </ul>
                    </div>
                    <Button onClick={() => setIsTopUpOpen(true)} className="h-12 w-full rounded-2xl bg-primary text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 group-hover:scale-[1.01]">Upgrade Now</Button>
                  </div>
                </div>
              </motion.div>
            )}

            {settingsTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="mb-6 flex items-center gap-5">
                  <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center border border-border/70 shadow-sm">
                    <Bell className="h-8 w-8 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-3xl font-semibold tracking-tight text-foreground">Stay Updated</h4>
                    <p className="text-sm text-muted-foreground">Configure how you receive alerts about your learning journey.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'analysis', label: 'Analysis Complete', desc: 'Notify me when a video analysis is ready to view.' },
                    { id: 'quiz', label: 'Quiz Reminders', desc: 'Periodic reminders to review your generated flashcards and quizzes.' },
                    { id: 'billing', label: 'Billing Alerts', desc: 'Updates about your credit balance and transaction history.' },
                    { id: 'newsletter', label: 'Mastery Newsletter', desc: 'Weekly tips, tricks, and new focus techniques.' },
                  ].map((pref) => (
                    <div 
                      key={pref.id}
                      className="flex items-center justify-between rounded-2xl border border-border/70 bg-secondary/50 p-5"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold uppercase tracking-widest text-foreground">{pref.label}</p>
                        <p className="text-xs text-muted-foreground">{pref.desc}</p>
                      </div>
                      <div className="w-12 h-6 rounded-full bg-primary relative cursor-pointer">
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </div>
  );
}

function Shield(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

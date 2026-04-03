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
        <p className="text-gray-500">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-6 w-full">
      <div className="flex flex-col lg:flex-row gap-12 bg-card rounded-[40px] border border-border shadow-2xl overflow-hidden min-h-[700px]">
        {/* Sidebar */}
        <div className="w-full lg:w-72 border-r border-border p-8 flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <SettingsIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-black">Settings</h2>
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
                  "flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all",
                  settingsTab === tab.id 
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/10 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-8 border-t border-border">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all w-full text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-10 lg:p-16 overflow-y-auto">
          <AnimatePresence mode="wait">
            {settingsTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div className="flex items-center gap-8">
                  <Avatar className="h-28 w-28 rounded-[36px] border-4 border-background shadow-2xl">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-4xl font-black">
                      {user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-3xl font-black text-foreground">{user.name}</h3>
                    <p className="text-base font-medium text-muted-foreground">{user.email}</p>
                    <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 w-fit">
                       <Shield className="h-3.5 w-3.5" />
                       <span className="text-[10px] font-black uppercase tracking-widest">Verified Learner</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Full Name</label>
                    <Input 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Your Name"
                      className="h-16 rounded-2xl border-border px-6 font-bold focus:ring-primary bg-background text-lg" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Email Address</label>
                    <Input 
                      value={user.email} 
                      disabled
                      className="h-16 rounded-2xl border-border px-6 font-bold bg-secondary text-muted-foreground text-lg cursor-not-allowed" 
                    />
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="space-y-5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Cognitive Expertise</label>
                    <div className="flex gap-4">
                      {['Beginner', 'Intermediate', 'Expert'].map((level) => (
                        <button
                          key={level}
                          onClick={() => setExpertise(level as any)}
                          className={cn(
                            "flex-1 px-4 py-5 rounded-[24px] text-xs font-black uppercase tracking-widest transition-all border-2",
                            expertise === level 
                              ? "bg-primary text-primary-foreground border-primary shadow-2xl shadow-primary/20" 
                              : "bg-background text-muted-foreground border-border hover:border-muted-foreground/30"
                          )}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium ml-1">Adjusts the depth of synthesis and study tools generated for your videos.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                    <div className="space-y-5">
                      <div className="flex gap-2 p-1 bg-secondary rounded-2xl border border-border">
                        {['light', 'dark', 'system'].map((t) => (
                          <button
                            key={t}
                            onClick={() => setTheme(t as any)}
                            className={cn(
                              "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
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
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Accessibility</label>
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
                              "flex items-center justify-between px-5 py-3 rounded-2xl border-2 transition-all",
                              accessibility[feature.id as keyof typeof accessibility]
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:border-muted-foreground/30"
                            )}
                          >
                            <span className="text-[10px] font-black uppercase tracking-widest">{feature.label}</span>
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

                <div className="pt-8 flex gap-4">
                  <Button 
                    onClick={onUpdateProfile}
                    disabled={isAuthLoading || newName === user.name}
                    className="h-14 px-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xl shadow-primary/20 font-black uppercase tracking-widest text-sm"
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
                className="space-y-12"
              >
                <div className="bg-primary text-primary-foreground p-12 rounded-[48px] shadow-2xl shadow-primary/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-primary-foreground/10 rounded-full blur-[100px] group-hover:bg-primary-foreground/20 transition-all duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary-foreground/50">Account Balance</span>
                    </div>
                    <div className="flex items-end gap-4">
                      <Coins className="h-14 w-14 text-amber-400 fill-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
                      <h4 className="text-8xl font-black leading-none">{credits ?? 0}</h4>
                      <span className="text-xl font-bold text-primary-foreground/40 mb-3">Credits Available</span>
                    </div>
                    <Button 
                      onClick={() => setIsTopUpOpen(true)}
                      className="mt-10 h-10 px-8 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold text-xs uppercase tracking-widest"
                    >
                      Purchase More
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-10 rounded-[40px] border border-border bg-card hover:shadow-2xl hover:shadow-foreground/5 transition-all flex flex-col justify-between">
                    <div>
                      <h5 className="font-black text-2xl mb-2">Basic</h5>
                      <p className="text-sm font-medium text-muted-foreground mb-8">Occasional learning support.</p>
                      <ul className="space-y-4 mb-10">
                         {['60 mins analysis / day', 'Basic study tools', 'Email support'].map(f => (
                           <li key={f} className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                             <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
                             {f}
                           </li>
                         ))}
                      </ul>
                    </div>
                    <Button variant="outline" className="w-full h-14 rounded-2xl border-border text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px] cursor-not-allowed">Active Plan</Button>
                  </div>

                  <div className="p-10 rounded-[40px] border-4 border-primary bg-card shadow-2xl shadow-primary/10 relative overflow-hidden flex flex-col justify-between group">
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-6 py-2 rounded-bl-3xl text-[10px] font-black uppercase tracking-widest">Recommended</div>
                    <div>
                      <h5 className="font-black text-2xl mb-2">TubeBrain Pro</h5>
                      <p className="text-sm font-medium text-muted-foreground mb-8">Unlimited mastery platform.</p>
                      <ul className="space-y-4 mb-10">
                         {['Unlimited analysis', 'All study sets & tools', 'Priority support', 'Early access to AI models'].map(f => (
                           <li key={f} className="flex items-center gap-3 text-xs font-bold text-foreground">
                             <div className="w-2 h-2 rounded-full bg-primary" />
                             {f}
                           </li>
                         ))}
                      </ul>
                    </div>
                    <Button onClick={() => setIsTopUpOpen(true)} className="w-full h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 group-hover:scale-[1.02] transition-transform">Upgrade Now</Button>
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
                className="space-y-12"
              >
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-16 h-16 bg-secondary rounded-3xl flex items-center justify-center border border-border shadow-inner">
                    <Bell className="h-8 w-8 text-foreground" />
                  </div>
                  <div>
                    <h4 className="text-3xl font-black text-foreground">Stay Updated</h4>
                    <p className="text-sm font-medium text-muted-foreground">Configure how you receive alerts about your learning journey.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {[
                    { id: 'analysis', label: 'Analysis Complete', desc: 'Notify me when a video analysis is ready to view.' },
                    { id: 'quiz', label: 'Quiz Reminders', desc: 'Periodic reminders to review your generated flashcards and quizzes.' },
                    { id: 'billing', label: 'Billing Alerts', desc: 'Updates about your credit balance and transaction history.' },
                    { id: 'newsletter', label: 'Mastery Newsletter', desc: 'Weekly tips, tricks, and new focus techniques.' },
                  ].map((pref) => (
                    <div 
                      key={pref.id}
                      className="flex items-center justify-between p-6 bg-secondary rounded-3xl border border-border"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-black text-foreground uppercase tracking-widest">{pref.label}</p>
                        <p className="text-xs text-muted-foreground font-medium">{pref.desc}</p>
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

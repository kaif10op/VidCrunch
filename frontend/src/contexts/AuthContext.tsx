import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth as useAuthHook } from "@/hooks/use-auth";
import { getAuthToken, setAuthToken, authApi, paymentApi, feedbackApi } from "@/lib/api";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { User, Transaction, ExpertiseLevel } from "@/types";

interface AuthContextValue {
  user: User | null;
  credits: number | null;
  transactions: Transaction[];
  isAuthenticated: boolean;
  isLoading: boolean;
  expertise: ExpertiseLevel;
  setExpertise: (level: ExpertiseLevel) => void;
  fetchUserData: () => Promise<void>;
  handleLogout: () => void;
  handleUpdateProfile: (newName: string, settings?: { expertise?: string }) => Promise<boolean>;
  fetchTransactions: () => Promise<void>;
  handlePayment: (plan: string) => Promise<boolean>;
  submitFeedback: (text: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthHook();
  const [isLoading, setIsLoading] = useState(true);
  const [expertise, setExpertise] = useState<ExpertiseLevel>("Intermediate");

  // Handle OAuth redirect on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    const oauthError = params.get("error");

    if (oauthError) {
      toast.error("Sign-in failed. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (oauthToken) {
      setAuthToken(oauthToken);
      window.history.replaceState({}, "", window.location.pathname);
    }

    auth.fetchUserData().finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync expertise from user settings when user data loads
  useEffect(() => {
    if (auth.user && (auth.user as any).settings?.expertise) {
      const exp = (auth.user as any).settings.expertise;
      const capitalized = exp.charAt(0).toUpperCase() + exp.slice(1);
      if (["Beginner", "Intermediate", "Expert"].includes(capitalized)) {
        setExpertise(capitalized as ExpertiseLevel);
      }
    }
  }, [auth.user]);

  const handleUpdateProfile = useCallback(
    async (newName: string, settings?: { expertise?: string }): Promise<boolean> => {
      if (!newName.trim()) return false;
      try {
        const res = await authApi.updateMe({
          name: newName.trim(),
          settings: settings || { expertise: expertise.toLowerCase() },
        });
        if (res.ok) {
          const updatedUser = await res.json();
          // Refresh user data to sync state
          await auth.fetchUserData();
          toast.success("Profile and settings updated!");
          return true;
        } else {
          toast.error("Failed to update profile");
          return false;
        }
      } catch {
        toast.error("An error occurred");
        return false;
      }
    },
    [expertise, auth]
  );

  const handlePayment = useCallback(
    async (plan: string): Promise<boolean> => {
      try {
        if (!(window as any).Razorpay) {
          toast.error("Razorpay SDK not loaded. Please check your internet connection and refresh.");
          return false;
        }

        const res = await paymentApi.createOrder({ plan });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: "Failed to create order" }));
          throw new Error(errData.detail || "Failed to create order");
        }
        
        const order = await res.json();

        return new Promise((resolve) => {
          const options = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: "TubeBrain AI",
            description: `Upgrade to ${plan.toUpperCase()}`,
            order_id: order.order_id,
            handler: async (response: any) => {
              try {
                const verifyRes = await paymentApi.verify({
                  razorpay_order_id: order.order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                if (verifyRes.ok) {
                  toast.success("Payment successful! Credits added.");
                  await auth.fetchUserData();
                  resolve(true);
                } else {
                  const verifyErr = await verifyRes.json().catch(() => ({ detail: "Verification failed" }));
                  toast.error(verifyErr.detail || "Payment verification failed.");
                  resolve(false);
                }
              } catch (vErr) {
                toast.error("An error occurred during verification.");
                resolve(false);
              }
            },
            prefill: {
              name: auth.user?.name,
              email: auth.user?.email,
            },
            theme: {
              color: "#000000",
            },
            modal: {
              ondismiss: function() {
                toast.info("Payment cancelled.");
                resolve(false);
              }
            }
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (response: any) {
            toast.error(`Payment failed: ${response.error.description}`);
            resolve(false);
          });
          rzp.open();
        });
      } catch (err: any) {
        logger.error("Payment initiation error:", err);
        toast.error(err.message || "Payment initiation failed");
        return false;
      }
    },
    [auth]
  );

  const submitFeedback = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim()) return false;
    try {
      const res = await feedbackApi.submit(text);
      if (res.ok) {
        toast.success("Thank you for your feedback!");
        return true;
      } else {
        toast.error("Failed to send feedback");
        return false;
      }
    } catch {
      toast.error("An error occurred");
      return false;
    }
  }, []);

  const handleLogout = useCallback(() => {
    auth.handleLogout();
  }, [auth]);

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        credits: auth.credits,
        transactions: auth.transactions,
        isAuthenticated: !!auth.user && !!getAuthToken(),
        isLoading,
        expertise,
        setExpertise,
        fetchUserData: auth.fetchUserData,
        handleLogout,
        handleUpdateProfile,
        fetchTransactions: async () => {
          // fetchTransactions is already called within fetchUserData
          await auth.fetchUserData();
        },
        handlePayment,
        submitFeedback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}

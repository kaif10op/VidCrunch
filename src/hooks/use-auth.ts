import { useState, useCallback, useEffect } from "react";
import { authApi, creditApi, getAuthToken, removeAuthToken } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

export interface User {
  name: string;
  email: string;
  avatar_url?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  operation: string;
  created_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await creditApi.getHistory();
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (err) {
      logger.error("Failed to fetch transactions:", err);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setCredits(null);
      return;
    }
    try {
      const [userRes, creditRes] = await Promise.all([
        authApi.getMe(),
        creditApi.getBalance(),
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData);
        localStorage.setItem(STORAGE_KEYS.USER_NAME, userData.name || "");
        localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userData.email || "");
      }

      if (creditRes.ok) {
        const creditData = await creditRes.json();
        setCredits(creditData.balance);
        localStorage.setItem(STORAGE_KEYS.USER_BALANCE, String(creditData.balance));
      }
      fetchTransactions();
    } catch (err) {
      logger.error("Auth sync failed", err);
    }
  }, [fetchTransactions]);

  const handleLogout = useCallback(() => {
    removeAuthToken();
    setUser(null);
    setCredits(null);
    localStorage.removeItem(STORAGE_KEYS.USER_NAME);
    localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
    localStorage.removeItem(STORAGE_KEYS.USER_BALANCE);
    toast.info("Logged out");
  }, []);

  const handleUpdateProfile = useCallback(
    async (newName: string): Promise<boolean> => {
      if (!newName.trim()) return false;
      try {
        const res = await authApi.updateMe({ name: newName.trim() });
        if (res.ok) {
          const updatedUser = await res.json();
          setUser(updatedUser);
          localStorage.setItem(STORAGE_KEYS.USER_NAME, updatedUser.name);
          toast.success("Profile updated!");
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
    []
  );

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return {
    user,
    credits,
    transactions,
    fetchUserData,
    handleLogout,
    handleUpdateProfile,
  };
}

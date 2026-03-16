import { API_BASE_URL, STORAGE_KEYS } from "./constants";

export const getAuthToken = (): string | null => localStorage.getItem(STORAGE_KEYS.TOKEN);
export const setAuthToken = (token: string): void => localStorage.setItem(STORAGE_KEYS.TOKEN, token);
export const removeAuthToken = (): void => localStorage.removeItem(STORAGE_KEYS.TOKEN);

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    removeAuthToken();
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_balance");
  }
  
  return response;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload extends LoginPayload {
  name: string;
}

interface UpdateProfilePayload {
  name?: string;
  avatar_url?: string;
  settings?: {
    expertise?: string;
    theme?: string;
    notifications_enabled?: boolean;
  };
}

export const authApi = {
  login: (data: LoginPayload) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data: RegisterPayload) => apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => apiFetch("/auth/me"),
  updateMe: (data: UpdateProfilePayload) => apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
};

interface AnalyzePayload {
  urls: string[];
  expertise?: string;
  full_analysis?: boolean;
  provider?: string;
  model?: string;
  language?: string;
  style?: string;
  chatHistory?: Array<{ role: string; content: string }>;
}

export const videoApi = {
  analyze: (data: AnalyzePayload) => apiFetch("/videos/analyze", { method: "POST", body: JSON.stringify(data) }),
  getAnalysis: (id: string) => apiFetch(`/analysis/${id}`),
};

export const creditApi = {
  getBalance: () => apiFetch("/credits/balance"),
  getHistory: () => apiFetch("/credits/transactions"),
};

interface CreateOrderPayload {
  plan: string;
}

interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const paymentApi = {
  createOrder: (data: CreateOrderPayload) => apiFetch("/payments/create-order", { method: "POST", body: JSON.stringify(data) }),
  verify: (data: VerifyPaymentPayload) => apiFetch("/payments/verify", { method: "POST", body: JSON.stringify(data) }),
  getHistory: () => apiFetch("/payments/history"),
};

export const exportApi = {
  download: (analysisId: string, format: "json" | "markdown") =>
    apiFetch("/export", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId, format }),
    }),
};

export const chatApi = {
  getHistory: (analysisId: string) => apiFetch(`/chat/${analysisId}/history`),
};

export const analysisApi = {
  get: (id: string) => apiFetch(`/analysis/${id}`),
  delete: (analysisId: string) => apiFetch(`/analysis/${analysisId}`, { method: "DELETE" }),
  getStatus: (analysisId: string) => apiFetch(`/analysis/${analysisId}/status`),
  generateTool: (analysisId: string, toolType: string) =>
    apiFetch(`/analysis/${analysisId}/generate?tool_type=${toolType}`, { method: "POST" }),
};

export const searchApi = {
  query: (q: string) => apiFetch(`/search/?q=${encodeURIComponent(q)}`),
};

export const feedbackApi = {
  submit: (content: string) => apiFetch("/feedback", { method: "POST", body: JSON.stringify({ content }) }),
};

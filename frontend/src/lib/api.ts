import { API_BASE_URL, STORAGE_KEYS } from "./constants";

export const getAuthToken = (): string | null => localStorage.getItem(STORAGE_KEYS.TOKEN);
export const setAuthToken = (token: string): void => localStorage.setItem(STORAGE_KEYS.TOKEN, token);
export const removeAuthToken = (): void => localStorage.removeItem(STORAGE_KEYS.TOKEN);

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
  login: (data: LoginPayload) => apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data: RegisterPayload) => apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => apiFetch("/api/auth/me"),
  updateMe: (data: UpdateProfilePayload) => apiFetch("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
};

export const spacesApi = {
  getSpaces: () => apiFetch("/api/spaces/"),
  createSpace: (name: string) => apiFetch("/api/spaces/", {
    method: "POST",
    body: JSON.stringify({ name }),
  }),
  renameSpace: (id: string, name: string) => apiFetch(`/api/spaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  }),
  deleteSpace: (id: string) => apiFetch(`/api/spaces/${id}`, { method: "DELETE" }),
  addVideoToSpace: (spaceId: string, videoId: string) => apiFetch(`/api/spaces/${spaceId}/videos`, {
    method: "POST",
    body: JSON.stringify({ video_id: videoId }),
  }),
  removeVideoFromSpace: (spaceId: string, videoId: string) => apiFetch(`/api/spaces/${spaceId}/videos/${videoId}`, { method: "DELETE" }),
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
  analyze: (data: AnalyzePayload) => apiFetch("/api/videos/analyze", { method: "POST", body: JSON.stringify(data) }),
  getAnalysis: (id: string) => apiFetch(`/api/analysis/${id}`),
};

export const creditApi = {
  getBalance: () => apiFetch("/api/credits/balance"),
  getHistory: () => apiFetch("/api/credits/transactions"),
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
  createOrder: (data: CreateOrderPayload) => apiFetch("/api/payments/create-order", { method: "POST", body: JSON.stringify(data) }),
  verify: (data: VerifyPaymentPayload) => apiFetch("/api/payments/verify", { method: "POST", body: JSON.stringify(data) }),
  getHistory: () => apiFetch("/api/payments/history"),
};

export const exportApi = {
  download: (analysisId: string, format: "json" | "markdown") =>
    apiFetch("/api/export", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId, format }),
    }),
};

export const chatApi = {
  getHistory: (analysisId: string) => apiFetch(`/api/chat/${analysisId}/history`),
};

export const analysisApi = {
  get: (id: string) => apiFetch(`/api/analysis/${id}`),
  delete: (analysisId: string) => apiFetch(`/api/analysis/${analysisId}`, { method: "DELETE" }),
  getStatus: (analysisId: string) => apiFetch(`/api/analysis/${analysisId}/status`),
  generateTool: (analysisId: string, toolType: string, append: boolean = false, force: boolean = false) =>
    apiFetch(`/api/analysis/${analysisId}/generate?tool_type=${toolType}${append ? '&append=true' : ''}${force ? '&force=true' : ''}`, { method: "POST" }),
  regenerate: (id: string, data: any) => apiFetch(`/api/analysis/${id}/regenerate`, { method: "POST", body: JSON.stringify(data) }),
};

export const searchApi = {
  query: (q: string) => apiFetch(`/api/search/?q=${encodeURIComponent(q)}`),
};

export const feedbackApi = {
  submit: (content: string) => apiFetch("/api/feedback", { method: "POST", body: JSON.stringify({ content }) }),
};

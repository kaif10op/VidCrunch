
const API_BASE = "http://localhost:8000/api";

export const getAuthToken = () => localStorage.getItem("token");
export const setAuthToken = (token: string) => localStorage.setItem("token", token);
export const removeAuthToken = () => localStorage.removeItem("token");

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as any;

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // Optional: handle token expiration
    // removeAuthToken();
  }
  
  return response;
}

export const authApi = {
  login: (data: any) => apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data: any) => apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => apiFetch("/auth/me"),
  updateMe: (data: any) => apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
};

export const videoApi = {
  analyze: (data: any) => apiFetch("/videos/analyze", { method: "POST", body: JSON.stringify(data) }),
  getAnalysis: (id: string) => apiFetch(`/analysis/${id}`),
};

export const creditApi = {
  getBalance: () => apiFetch("/credits/balance"),
  getHistory: () => apiFetch("/credits/transactions"),
};

export const paymentApi = {
  createOrder: (data: { plan: string }) => apiFetch("/payments/create-order", { method: "POST", body: JSON.stringify(data) }),
  verify: (data: any) => apiFetch("/payments/verify", { method: "POST", body: JSON.stringify(data) }),
  getHistory: () => apiFetch("/payments/history"),
};

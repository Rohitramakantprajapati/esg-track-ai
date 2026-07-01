import axios from 'axios';

const AUTH_STORAGE_KEY = 'esg-track-auth-token';
const AUTH_USERNAME = import.meta.env.VITE_ESG_USERNAME || 'admin';
const AUTH_PASSWORD = import.meta.env.VITE_ESG_PASSWORD || 'admin123';

const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

let authTokenPromise = null;

const isProtectedRequest = (config) => {
  const url = config?.url || '';
  return url.startsWith('/data/') || url.startsWith('/reports/');
};

const readStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
};

const storeToken = (token) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, token);
};

export const clearAuthToken = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export async function ensureAuthToken() {
  const storedToken = readStoredToken();
  if (storedToken) return storedToken;

  if (!authTokenPromise) {
    const formData = new URLSearchParams();
    formData.set('username', AUTH_USERNAME);
    formData.set('password', AUTH_PASSWORD);

    authTokenPromise = authClient
      .post('/auth/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then(({ data }) => {
        if (!data?.access_token) {
          throw new Error('Missing access token');
        }
        storeToken(data.access_token);
        return data.access_token;
      })
      .finally(() => {
        authTokenPromise = null;
      });
  }

  return authTokenPromise;
}

api.interceptors.request.use(async (config) => {
  if (isProtectedRequest(config)) {
    const token = await ensureAuthToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (
      error?.response?.status === 401 &&
      originalRequest &&
      isProtectedRequest(originalRequest) &&
      !originalRequest._authRetry
    ) {
      originalRequest._authRetry = true;
      clearAuthToken();
      const token = await ensureAuthToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${token}`;
      return api.request(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;

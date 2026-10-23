import axios from 'axios';
import { AuthService } from '@/services/authService';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Tambahkan token ke setiap request
apiClient.interceptors.request.use(
  (config) => {
    const token = AuthService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = AuthService.getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const refreshUrl = baseUrl.endsWith('/api')
      ? `${baseUrl}/auth/refresh`
      : `${baseUrl}/api/auth/refresh`;
    const response = await axios.post(
      refreshUrl,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = response.data?.data ?? response.data;
    if (!data?.token) {
      return null;
    }
    AuthService.setTokens(data.token, data.refreshToken ?? refreshToken);
    return data.token as string;
  } catch {
    return null;
  }
};

// Response Interceptor: refresh token sekali, lalu retry original request
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = String(originalRequest?.url || '');
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const token = await refreshPromise;
      if (token) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      }

      AuthService.logout();
    }
    return Promise.reject(error);
  }
);

export default apiClient;

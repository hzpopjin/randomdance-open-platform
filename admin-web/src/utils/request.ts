import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

// 响应拦截器会返回 response.data，而不是 AxiosResponse。显式描述这一契约，
// 避免所有 service 的 ApiResponse<T> 被 TypeScript 误包成 AxiosResponse<ApiResponse<T>>。
interface ApiClient extends Omit<AxiosInstance, 'get' | 'post' | 'put' | 'patch' | 'delete'> {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>;
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
}) as ApiClient;

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const { code, message: msg } = response.data;
    if (code !== 0 && code !== undefined) {
      if (code === 10002) {
        localStorage.removeItem('admin_token');
        return Promise.reject(new Error('登录已过期'));
      }
      return Promise.reject(new Error(msg || '请求失败'));
    }
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
      return Promise.reject(new Error('登录已过期'));
    }
    const errorMsg = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(errorMsg));
  }
);

export default request;

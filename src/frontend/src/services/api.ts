import axios, { AxiosResponse, AxiosError } from 'axios';
import { ApiResponse } from '@/types';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Generic API methods
export const apiClient = {
  get: <T = any>(url: string, params?: any): Promise<ApiResponse<T>> =>
    api.get(url, { params }).then(res => res.data),

  post: <T = any>(url: string, data?: any): Promise<ApiResponse<T>> =>
    api.post(url, data).then(res => res.data),

  put: <T = any>(url: string, data?: any): Promise<ApiResponse<T>> =>
    api.put(url, data).then(res => res.data),

  patch: <T = any>(url: string, data?: any): Promise<ApiResponse<T>> =>
    api.patch(url, data).then(res => res.data),

  delete: <T = any>(url: string): Promise<ApiResponse<T>> =>
    api.delete(url).then(res => res.data),
};

// Stakeholder API
export const stakeholderApi = {
  list: (params?: any) => apiClient.get('/stakeholders', params),
  get: (id: string) => apiClient.get(`/stakeholders/${id}`),
  create: (data: any) => apiClient.post('/stakeholders', data),
  update: (id: string, data: any) => apiClient.put(`/stakeholders/${id}`, data),
  delete: (id: string) => apiClient.delete(`/stakeholders/${id}`),
  bulkUpdate: (data: any) => apiClient.post('/stakeholders/bulk', data),
};

// Document API
export const documentApi = {
  list: (params?: any) => apiClient.get('/documents', params),
  get: (id: string) => apiClient.get(`/documents/${id}`),
  upload: (formData: FormData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data),
  update: (id: string, data: any) => apiClient.put(`/documents/${id}`, data),
  delete: (id: string) => apiClient.delete(`/documents/${id}`),
  download: (id: string) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  versions: (id: string) => apiClient.get(`/documents/${id}/versions`),
  share: (id: string, data: any) => apiClient.post(`/documents/${id}/share`, data),
};

// Task API
export const taskApi = {
  list: (params?: any) => apiClient.get('/tasks', params),
  get: (id: string) => apiClient.get(`/tasks/${id}`),
  create: (data: any) => apiClient.post('/tasks', data),
  update: (id: string, data: any) => apiClient.put(`/tasks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/tasks/${id}`),
  updateStatus: (id: string, status: string) => 
    apiClient.patch(`/tasks/${id}/status`, { status }),
};

// Communication API
export const communicationApi = {
  list: (params?: any) => apiClient.get('/communications', params),
  get: (id: string) => apiClient.get(`/communications/${id}`),
  create: (data: any) => apiClient.post('/communications', data),
  update: (id: string, data: any) => apiClient.put(`/communications/${id}`, data),
  delete: (id: string) => apiClient.delete(`/communications/${id}`),
};

// Evidence API
export const evidenceApi = {
  list: (params?: any) => apiClient.get('/evidence', params),
  get: (id: string) => apiClient.get(`/evidence/${id}`),
  create: (data: any) => apiClient.post('/evidence', data),
  update: (id: string, data: any) => apiClient.put(`/evidence/${id}`, data),
  delete: (id: string) => apiClient.delete(`/evidence/${id}`),
  updateCustody: (id: string, data: any) => 
    apiClient.post(`/evidence/${id}/custody`, data),
  verify: (id: string, data: any) => 
    apiClient.post(`/evidence/${id}/verify`, data),
};

// Risk API
export const riskApi = {
  events: (params?: any) => apiClient.get('/risk/events', params),
  assessments: (params?: any) => apiClient.get('/risk/assessments', params),
  createEvent: (data: any) => apiClient.post('/risk/events', data),
  updateEvent: (id: string, data: any) => apiClient.put(`/risk/events/${id}`, data),
  createAssessment: (data: any) => apiClient.post('/risk/assessments', data),
  updateAssessment: (id: string, data: any) => 
    apiClient.put(`/risk/assessments/${id}`, data),
};

// PR Messages API
export const prApi = {
  list: (params?: any) => apiClient.get('/pr-messages', params),
  get: (id: string) => apiClient.get(`/pr-messages/${id}`),
  create: (data: any) => apiClient.post('/pr-messages', data),
  update: (id: string, data: any) => apiClient.put(`/pr-messages/${id}`, data),
  delete: (id: string) => apiClient.delete(`/pr-messages/${id}`),
  approve: (id: string, data: any) => 
    apiClient.post(`/pr-messages/${id}/approve`, data),
  publish: (id: string) => apiClient.post(`/pr-messages/${id}/publish`),
};

// Analytics API
export const analyticsApi = {
  dashboard: () => apiClient.get('/analytics/dashboard'),
  stakeholders: (params?: any) => apiClient.get('/analytics/stakeholders', params),
  documents: (params?: any) => apiClient.get('/analytics/documents', params),
  tasks: (params?: any) => apiClient.get('/analytics/tasks', params),
  risk: (params?: any) => apiClient.get('/analytics/risk', params),
  export: (type: string, params?: any) => 
    api.get(`/analytics/export/${type}`, { params, responseType: 'blob' }),
};

// Search API
export const searchApi = {
  global: (query: string, filters?: any) => 
    apiClient.get('/search', { q: query, ...filters }),
  stakeholders: (query: string, filters?: any) => 
    apiClient.get('/search/stakeholders', { q: query, ...filters }),
  documents: (query: string, filters?: any) => 
    apiClient.get('/search/documents', { q: query, ...filters }),
  communications: (query: string, filters?: any) => 
    apiClient.get('/search/communications', { q: query, ...filters }),
  suggestions: (query: string) => 
    apiClient.get('/search/suggestions', { q: query }),
};

// User API
export const userApi = {
  profile: () => apiClient.get('/user/profile'),
  updateProfile: (data: any) => apiClient.put('/user/profile', data),
  preferences: () => apiClient.get('/user/preferences'),
  updatePreferences: (data: any) => apiClient.put('/user/preferences', data),
  notifications: (params?: any) => apiClient.get('/user/notifications', params),
  markNotificationRead: (id: string) => 
    apiClient.patch(`/user/notifications/${id}/read`),
  markAllNotificationsRead: () => 
    apiClient.patch('/user/notifications/read-all'),
};

export default api;
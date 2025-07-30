import axios from 'axios';
import type { Account } from '../types/account';
import type { BetHistoryItem } from '../types/betting';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Tạo axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor để tự động thêm token vào headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor để xử lý response và token hết hạn
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token hết hạn hoặc không hợp lệ
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface User {
  id: string;
  username: string;
}

// Bet History interfaces
export interface BetHistoryFilters {
  status?: string;
  websiteType?: string;
  orderCode?: string;
  region?: string;
  betType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface BetHistoryResponse {
  success: boolean;
  data: {
    betHistories: BetHistoryItem[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

export const authAPI = {
  // Đăng nhập
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  // Lấy thông tin user hiện tại
  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Account API
export const accountAPI = {
  // Lấy tất cả accounts
  getAll: async () => {
    const response = await api.get('/accounts');
    return response.data;
  },
  
  // Thêm account mới
  create: async (accountData: string, websiteType: 'sgd666' | 'one789' = 'sgd666') => {
    const response = await api.post('/accounts', {
      accountData,
      websiteType
    });
    return response.data;
  },
  
  // Cập nhật account
  update: async (id: string, data: Partial<Account>) => {
    const response = await api.put(`/accounts/${id}`, data);
    return response.data;
  },
  
  // Xóa account
  delete: async (id: string) => {
    const response = await api.delete(`/accounts/${id}`);
    return response.data;
  },

  // Kiểm tra username đã tồn tại
  checkUsername: async (username: string, websiteType?: string): Promise<{ exists: boolean }> => {
    const queryParams = websiteType ? `?websiteType=${websiteType}` : '';
    const response = await fetch(`${API_BASE_URL}/accounts/check-username/${username}${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to check username');
    }
    
    return response.json();
  },
  
  // Kiểm tra nhiều username cùng lúc
  checkUsernames: async (usernames: string[], websiteType?: string) => {
    const response = await fetch(`${API_BASE_URL}/accounts/check-usernames`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ usernames, websiteType })
    });
    
    if (!response.ok) {
      throw new Error('Failed to check usernames');
    }
    
    return response.json();
  },
  
  // Kiểm tra tài khoản (login và lấy thông tin)
  checkAccount: async (accountId: string) => {
    const response = await api.post(`/account-check/check-account/${accountId}`);
    return response.data;
  },

  // Kiểm tra nhiều tài khoản cùng lúc
  checkMultipleAccounts: async (accountIds: string[]) => {
    const response = await api.post('/account-check/check-multiple', {
      accountIds
    });
    return response.data;
  },
  
};
// Bet History API
export const betHistoryAPI = {
  // Lấy danh sách lịch sử cược
  getHistory: async (filters: BetHistoryFilters = {}): Promise<BetHistoryResponse> => {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/bet-history?${queryParams.toString()}`);
    return response.data;
  },

  // Lấy chi tiết một đơn cược
  getDetail: async (orderCode: string) => {
    const response = await api.get(`/bet-history/${orderCode}`);
    return response.data;
  }
};

export default api;
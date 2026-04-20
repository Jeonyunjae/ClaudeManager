'use client';

type ApiResponse<T> = {
  data: T;
};

type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
};

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '';
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  clearToken(): void {
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    skipAuth = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token && !skipAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      const error = json as ApiError;
      throw new ApiClientError(
        error.error?.message || 'Request failed',
        error.error?.code || 'UNKNOWN_ERROR',
        response.status,
        error.error?.details
      );
    }

    return json as T;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('GET', path);
  }

  async getPaginated<T>(path: string): Promise<PaginatedResponse<T>> {
    return this.request<PaginatedResponse<T>>('GET', path);
  }

  async post<T>(path: string, body?: unknown, skipAuth = false): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('POST', path, body, skipAuth);
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('PATCH', path, body);
  }

  async del<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('DELETE', path);
  }
}

export class ApiClientError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(message: string, code: string, statusCode: number, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const apiClient = new ApiClient();
export default apiClient;

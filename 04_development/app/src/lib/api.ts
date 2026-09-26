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

/** `handleUnauthorized`가 필요로 하는 `window.location`의 최소 형태 (테스트 용이) */
export type LocationLike = {
  pathname: string;
  search: string;
  replace: (url: string) => void;
};

/** `handleUnauthorized`가 필요로 하는 storage의 최소 형태 (테스트 용이) */
export type StorageLike = {
  removeItem: (key: string) => void;
};

/**
 * API 401 응답 처리 (NFR-003, EVT-SH-3).
 *
 * `requestPath`(방금 401을 받은 API 경로)가 `/api/auth/`로 시작하면
 * (로그인 자체가 401을 반환한 경우 등) 아무 것도 하지 않는다.
 * 그 외에는 토큰을 지우고 현재 화면(`location`)이 이미 `/login`·`/setup`이면
 * `next` 없이, 아니면 현재 경로를 `next`로 붙여 로그인 화면으로 이동한다.
 */
export function handleUnauthorized(
  requestPath: string,
  location: LocationLike,
  storage: StorageLike
): void {
  if (requestPath.startsWith('/api/auth/')) return;

  storage.removeItem('auth_token');

  if (location.pathname === '/login' || location.pathname === '/setup') {
    location.replace('/login');
    return;
  }

  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  location.replace(`/login?next=${next}`);
}

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
    // FormData(파일 업로드)는 브라우저가 boundary를 붙인 Content-Type을 직접 정한다
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = isForm ? {} : { 'Content-Type': 'application/json' };

    const token = this.getToken();
    if (token && !skipAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        handleUnauthorized(path, window.location, localStorage);
      }

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

  /** multipart 업로드 — 인증 헤더·401 처리는 다른 요청과 같은 경로를 쓴다 */
  async upload<T>(path: string, form: FormData): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('POST', path, form);
  }

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('PATCH', path, body);
  }

  async del<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>('DELETE', path, body);
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

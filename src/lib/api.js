import axios from 'axios';

let accessToken = null;
let csrfToken = null;
export function setAccessToken(t) { accessToken = t; }
export function setCsrfToken(t) { csrfToken = t; }

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const http = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

function readCookie(name) {
  const m = document.cookie.match(new RegExp(`(^|; )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

function csrfHeader() {
  const csrf = csrfToken || readCookie('csrf');
  return csrf ? { 'X-CSRF-Token': csrf } : {};
}

function rememberCsrf(data) {
  if (data?.csrfToken) csrfToken = data.csrfToken;
}

async function ensureCsrfToken() {
  if (csrfToken || readCookie('csrf')) return;
  const res = await axios.get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true });
  rememberCsrf(res.data?.data);
}

// Rotate the access token using the httpOnly refresh cookie (+ CSRF double-submit).
// Uses raw axios so it bypasses the unwrap/refresh interceptors below.
async function refreshAccessToken() {
  await ensureCsrfToken();
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
    withCredentials: true, headers: csrfHeader(),
  });
  const data = res.data?.data;
  rememberCsrf(data);
  const token = data?.accessToken;
  if (!token) throw new Error('refresh failed');
  setAccessToken(token);
  return token;
}

// Attach bearer token when present.
http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'patch', 'put', 'delete'].includes(method)) {
    config.headers = { ...csrfHeader(), ...config.headers };
  }
  return config;
});

// Unwrap the { success, data } envelope; turn { success:false } and transport
// failures into a typed ApiError.
http.interceptors.response.use(
  (res) => {
    rememberCsrf(res.data?.data);
    if (res.data && res.data.success === false) {
      const e = res.data.error || {};
      throw new ApiError(e.code || 'UNKNOWN', res.status, e.message || 'Error');
    }
    return res.data?.data;
  },
  async (err) => {
    const res = err.response;
    const original = err.config || {};
    const url = typeof original.url === 'string' ? original.url : '';
    // Don't try to refresh on the credential endpoints themselves (avoids loops).
    const isCredentialCall = /\/auth\/(refresh|login|register)/.test(url);
    // On a stale access token, refresh once and replay the original request.
    if (res?.status === 401 && !original._retried && !isCredentialCall) {
      original._retried = true;
      try {
        await refreshAccessToken();
        return await http(original);
      } catch { /* refresh failed — fall through to surface the original 401 */ }
    }
    const e = res?.data?.error;
    throw new ApiError(e?.code || 'NETWORK', res?.status || 0, e?.message || err.message);
  },
);

export const apiGet = (path) => http.get(path);

export const apiPost = (path, body, opts = {}) =>
  http.post(path, body, opts.idempotency ? { headers: { 'Idempotency-Key': crypto.randomUUID() } } : undefined);

export const apiPatch = (path, body) => http.patch(path, body);

export const apiDelete = (path) => http.delete(path);

export function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

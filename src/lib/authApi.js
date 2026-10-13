import { apiGet, apiPost, apiPatch, withQuery } from './api';

export const login = (creds) => apiPost('/auth/login', creds);
export const register = (info) => apiPost('/auth/register', info);
export const logout = () => apiPost('/auth/logout', {});
export const me = () => apiGet('/auth/me');
export const updateMe = (data) => apiPatch('/auth/me', data);
export const changePassword = (data) => apiPost('/auth/password', data);
export const listSessions = () => apiGet('/auth/sessions');
export const revokeSession = (id) => apiPost(`/auth/sessions/${id}/revoke`, {});
export const listUsers = (params) => apiGet(withQuery('/admin/users', params));
export const updateUserRole = (id, role) => apiPatch(`/admin/users/${id}/role`, { role });

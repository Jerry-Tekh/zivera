import { apiDelete, apiGet, apiPost, apiPatch, withQuery } from './api';

export const listAllEvents = (params) => apiGet(withQuery('/admin/events', params));
export const createEvent = (data) => apiPost('/events', data);
export const updateEvent = (id, data) => apiPatch(`/events/${id}`, data);
export const createCategory = (eventId, data) => apiPost(`/events/${eventId}/categories`, data);
export const updateCategory = (eventId, categoryId, data) => apiPatch(`/events/${eventId}/categories/${categoryId}`, data);
export const eventSales = (id) => apiGet(`/events/${id}/sales`);
export const eventOrders = (id, params) => apiGet(withQuery(`/events/${id}/orders`, params));
export const refundOrder = (orderId) => apiPost(`/orders/${orderId}/refund`, {});
export const eventRefundRequests = (id, params) => apiGet(withQuery(`/events/${id}/refund-requests`, params));
export const reviewRefundRequest = (id, data) => apiPatch(`/refund-requests/${id}`, data);
export const listEventStaff = (id) => apiGet(`/events/${id}/staff`);
export const assignEventStaff = (id, email) => apiPost(`/events/${id}/staff`, { email });
export const removeEventStaff = (eventId, userId) => apiDelete(`/events/${eventId}/staff/${userId}`);

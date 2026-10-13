import { apiGet, withQuery } from './api';

export const platformAnalytics = (period) => apiGet(withQuery('/admin/analytics/summary', period));
export const eventPerformance = (params) => apiGet(withQuery('/analytics/events', params));
export const eventAnalytics = (eventId, period) => apiGet(withQuery(`/events/${eventId}/analytics`, period));

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { eventAnalytics, platformAnalytics } from './analyticsApi';

describe('analyticsApi', () => {
  it('requests the platform summary for an explicit reporting window', async () => {
    let query;
    server.use(http.get('/api/v1/admin/analytics/summary', ({ request }) => {
      query = new URL(request.url).searchParams;
      return HttpResponse.json({ success: true, data: { metrics: { netRevenueCents: 100 } } });
    }));
    const result = await platformAnalytics({ from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' });
    expect(result.metrics.netRevenueCents).toBe(100);
    expect(query.get('from')).toBe('2026-01-01T00:00:00Z');
    expect(query.get('to')).toBe('2026-01-02T00:00:00Z');
  });

  it('requests role-scoped event analytics', async () => {
    let path;
    server.use(http.get('/api/v1/events/e1/analytics', ({ request }) => {
      path = new URL(request.url).pathname;
      return HttpResponse.json({ success: true, data: { event: { id: 'e1' }, daily: [] } });
    }));
    const result = await eventAnalytics('e1', { from: '2026-01-01T00:00:00Z', to: '2026-01-03T00:00:00Z' });
    expect(path).toBe('/api/v1/events/e1/analytics');
    expect(result.event.id).toBe('e1');
  });
});

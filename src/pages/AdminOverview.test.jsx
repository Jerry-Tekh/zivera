import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import { RequireRole } from '../components/RouteGuards.jsx';
import AdminOverview from './AdminOverview.jsx';

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: auth.useAuth }));

const report = {
  period: { timeZone: 'UTC', endExclusive: true },
  usersByRole: { registered_user: 14, organizer: 2, event_staff: 1, super_admin: 1 },
  eventsByStatus: { published: 3, draft: 1, paused: 0, cancelled: 0, completed: 0, archived: 0 },
  metrics: {
    ticketsSold: 12,
    grossRevenueCents: 24000,
    refundedAmountCents: 2500,
    netRevenueCents: 21500,
    attendance: 8,
    openRefundRequests: 2,
  },
};

function renderOverview({ role = 'super_admin', path = '/admin/overview' } = {}) {
  auth.useAuth.mockReturnValue({ user: { role, name: 'Admin', email: 'admin@example.test' }, loading: false });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <RequireRole roles={['super_admin']}><AdminOverview /></RequireRole>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockSummary() {
  server.use(
    http.get('/api/v1/admin/analytics/summary', () => HttpResponse.json({ success: true, data: report })),
    http.get('/api/v1/health', () => HttpResponse.json({ success: true, data: { status: 'ok', db: true, redis: true } })),
  );
}

afterEach(() => auth.useAuth.mockReset());

describe('AdminOverview', () => {
  it('shows platform aggregates and system status from their APIs', async () => {
    mockSummary();
    renderOverview();

    expect(await screen.findByRole('heading', { name: 'Platform overview' })).toBeInTheDocument();
    expect(await screen.findByText('$215.00')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/2 refund requests awaiting review/i)).toBeInTheDocument();
    expect(await screen.findByText('All services operational')).toBeInTheDocument();
  });

  it('uses UTC boundaries and applies an inclusive date selection as an exclusive API end', async () => {
    let query;
    server.use(
      http.get('/api/v1/admin/analytics/summary', ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ success: true, data: report });
      }),
      http.get('/api/v1/health', () => HttpResponse.json({ success: true, data: { status: 'ok', db: true, redis: true } })),
    );
    renderOverview();
    await screen.findByRole('heading', { name: 'Platform overview' });
    await userEvent.clear(screen.getByLabelText('From'));
    await userEvent.type(screen.getByLabelText('From'), '2026-07-01');
    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-07-03');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    expect(await screen.findByText('$215.00')).toBeInTheDocument();
    expect(query.get('from')).toBe('2026-07-01T00:00:00.000Z');
    expect(query.get('to')).toBe('2026-07-04T00:00:00.000Z');
  });

  it('offers a retry after analytics fails instead of displaying unavailable metrics as zero', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/admin/analytics/summary', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Summary unavailable.' } }, { status: 503 })
          : HttpResponse.json({ success: true, data: { ...report, metrics: { ...report.metrics, ticketsSold: 0 } } });
      }),
      http.get('/api/v1/health', () => HttpResponse.json({ success: true, data: { status: 'ok', db: true, redis: true } })),
    );
    renderOverview();

    expect(await screen.findByRole('alert')).toHaveTextContent('Summary unavailable.');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry platform metrics' }));
    expect(await within(screen.getByText('Tickets sold').closest('section')).findByText('0')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('keeps an empty report distinct from a failed report', async () => {
    server.use(
      http.get('/api/v1/admin/analytics/summary', () => HttpResponse.json({ success: true, data: {
        usersByRole: {}, eventsByStatus: {},
        metrics: { ticketsSold: 0, grossRevenueCents: 0, refundedAmountCents: 0, netRevenueCents: 0, attendance: 0, openRefundRequests: 0 },
      } })),
      http.get('/api/v1/health', () => HttpResponse.json({ success: true, data: { status: 'ok', db: true, redis: true } })),
    );
    renderOverview();

    expect(await screen.findByText('No ticket sales, refunds, or attendance were recorded in this reporting window.')).toBeInTheDocument();
    expect(screen.getByText('No user accounts have been created.')).toBeInTheDocument();
    expect(screen.getByText('No events have been created.')).toBeInTheDocument();
  });

  it('restricts the overview to super admins', () => {
    renderOverview({ role: 'organizer' });
    expect(screen.getByText(/workspace is not available for your role/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Platform overview' })).not.toBeInTheDocument();
  });
});

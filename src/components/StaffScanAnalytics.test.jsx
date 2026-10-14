import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import StaffScanAnalytics from './StaffScanAnalytics.jsx';

function report() {
  return {
    success: true,
    data: {
      period: { timeZone: 'UTC', endExclusive: true, interval: 'day' },
      metrics: { totalScans: 4, accepted: 2, rejected: 2 },
      byResult: [
        { result: 'accepted', count: 2 },
        { result: 'already_used', count: 1 },
        { result: 'wrong_event', count: 0 },
        { result: 'not_found', count: 0 },
        { result: 'invalid_signature', count: 1 },
        { result: 'revoked', count: 0 },
      ],
      daily: [{
        day: '2026-07-01',
        byResult: {
          accepted: 2, already_used: 1, wrong_event: 0,
          not_found: 0, invalid_signature: 1, revoked: 0,
        },
        total: 4,
      }],
    },
  };
}

function renderAnalytics() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffScanAnalytics />
    </QueryClientProvider>,
  );
}

describe('StaffScanAnalytics', () => {
  it('shows date-bounded scan totals and daily result details', async () => {
    server.use(http.get('/api/v1/staff/analytics/scans', () => HttpResponse.json(report())));
    renderAnalytics();

    expect(await screen.findByRole('heading', { name: /scan activity/i })).toBeInTheDocument();
    expect(await screen.findByText('All scan attempts')).toBeInTheDocument();
    expect(screen.getByText('All scan attempts').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Admitted scans').parentElement).toHaveTextContent('2');
    await userEvent.click(screen.getByText(/view daily totals/i));
    expect(screen.getByRole('row', { name: /2026-07-01/ })).toHaveTextContent('4');
    expect(screen.getByText(/reporting days use utc/i)).toBeInTheDocument();
  });

  it('shows a retry action when scan analytics fail', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/staff/analytics/scans', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Scan report unavailable.' } }, { status: 503 })
        : HttpResponse.json(report());
    }));
    renderAnalytics();

    expect(await screen.findByRole('alert')).toHaveTextContent('Scan report unavailable.');
    await userEvent.click(screen.getByRole('button', { name: /retry scan analytics/i }));
    expect(await screen.findByText('All scan attempts')).toBeInTheDocument();
    expect(screen.getByText('All scan attempts').parentElement).toHaveTextContent('4');
    expect(calls).toBe(2);
  });

  it('rejects report windows longer than 366 days without making another request', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/staff/analytics/scans', () => {
      calls += 1;
      return HttpResponse.json(report());
    }));
    renderAnalytics();

    await screen.findByRole('heading', { name: /scan activity/i });
    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: '2026-01-02' } });
    await userEvent.click(screen.getByRole('button', { name: /apply dates/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no more than 366 days/i);
    expect(calls).toBe(1);
  });
});

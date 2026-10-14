import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

// Mock the camera library: start() immediately reports one decoded token.
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    async start(_camera, _config, onSuccess) { onSuccess('CAM-TOKEN'); }
    async stop() {}
    clear() {}
  },
}));
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import Scanner from './Scanner.jsx';

function renderScanner() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><Scanner /></MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockEvents() {
  server.use(http.get('/api/v1/staff/events', () => HttpResponse.json({ success: true, data: [{ id: 'e1', title: 'Gate Night', location: 'Hall' }] })));
}

function mockScanAnalytics() {
  server.use(http.get('/api/v1/staff/analytics/scans', () => HttpResponse.json({
    success: true,
    data: {
      period: { timeZone: 'UTC', endExclusive: true, interval: 'day' },
      metrics: { totalScans: 1, accepted: 1, rejected: 0 },
      byResult: [
        { result: 'accepted', count: 1 },
        { result: 'already_used', count: 0 },
        { result: 'wrong_event', count: 0 },
        { result: 'not_found', count: 0 },
        { result: 'invalid_signature', count: 0 },
        { result: 'revoked', count: 0 },
      ],
      daily: [{
        day: '2026-07-01',
        byResult: {
          accepted: 1, already_used: 0, wrong_event: 0,
          not_found: 0, invalid_signature: 0, revoked: 0,
        },
        total: 1,
      }],
    },
  })));
}

async function fillAndScan(token) {
  const tokenInput = screen.getByLabelText(/ticket code/i);
  await userEvent.clear(tokenInput);
  await userEvent.type(tokenInput, token);
  await userEvent.click(screen.getByRole('button', { name: /scan/i }));
}

describe('Scanner', () => {
  it('admits a valid ticket then rejects a duplicate', async () => {
    mockEvents();
    mockScanAnalytics();
    server.use(
      http.post('/api/v1/events/e1/scan', () => HttpResponse.json({ success: true, data: { result: 'accepted', ticketId: 't1' } })),
    );
    renderScanner();
    expect(screen.queryByLabelText(/event id/i)).not.toBeInTheDocument();
    await screen.findByRole('option', { name: /gate night/i });
    await userEvent.selectOptions(screen.getByLabelText(/^event$/i), 'e1');
    await fillAndScan('TKN');
    expect(await screen.findByText(/Admitted ✓/i)).toBeInTheDocument();

    server.use(
      http.post('/api/v1/events/e1/scan', () => HttpResponse.json(
        { success: false, error: { code: 'TICKET_ALREADY_USED', message: 'used' } }, { status: 409 })),
    );
    await fillAndScan('TKN');
    expect(await screen.findByText(/already scanned/i)).toBeInTheDocument();
  });

  it('scans via the camera and admits', async () => {
    mockEvents();
    mockScanAnalytics();
    server.use(http.post('/api/v1/events/e1/scan', () => HttpResponse.json({ success: true, data: { result: 'accepted' } })));
    renderScanner();
    await screen.findByRole('option', { name: /gate night/i });
    await userEvent.selectOptions(await screen.findByLabelText(/^event$/i), 'e1');
    await userEvent.click(screen.getByRole('button', { name: /use camera/i }));
    expect(await screen.findByText(/Admitted ✓/i)).toBeInTheDocument();
  });

  it('shows when no events are assigned to the staff user', async () => {
    mockScanAnalytics();
    server.use(http.get('/api/v1/staff/events', () => HttpResponse.json({ success: true, data: [] })));
    renderScanner();
    expect(await screen.findByText(/no assigned events/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^scan$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /use camera/i })).toBeDisabled();
  });

  it('shows an assigned-event load error and retries successfully', async () => {
    mockScanAnalytics();
    let calls = 0;
    server.use(http.get('/api/v1/staff/events', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Service unavailable.' } }, { status: 503 })
        : HttpResponse.json({ success: true, data: [{ id: 'e1', title: 'Gate Night', location: 'Hall' }] });
    }));
    renderScanner();

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable.');
    expect(screen.queryByText(/no assigned events/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry assigned events/i }));
    expect(await screen.findByRole('option', { name: /gate night/i })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('uses the selected event, shows its context, and clears results when switching events', async () => {
    mockScanAnalytics();
    server.use(
      http.get('/api/v1/staff/events', () => HttpResponse.json({
        success: true,
        data: [
          { id: 'e1', title: 'Gate Night', location: 'Hall One', starts_at: '2026-11-15T19:00:00Z' },
          { id: 'e2', title: 'Matinee', location: 'Hall Two', starts_at: null },
        ],
      })),
      http.post('/api/v1/events/e1/scan', () => HttpResponse.json({ success: true, data: { result: 'accepted' } })),
      http.post('/api/v1/events/e2/scan', () => HttpResponse.json({ success: true, data: { result: 'accepted' } })),
    );
    renderScanner();

    await screen.findByRole('option', { name: /gate night/i });
    const eventSelect = await screen.findByLabelText(/^event$/i);
    await userEvent.selectOptions(eventSelect, 'e1');
    const selectedContext = screen.getByRole('region', { name: /selected event/i });
    expect(selectedContext).toHaveTextContent('Gate Night');
    expect(selectedContext).toHaveTextContent('Hall One');
    expect(selectedContext).toHaveTextContent(/2026/);
    await fillAndScan('TKN');
    expect(await screen.findByText(/Admitted ✓/i)).toBeInTheDocument();

    await userEvent.selectOptions(eventSelect, 'e2');
    expect(screen.queryByText(/Admitted ✓/i)).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /selected event/i })).toHaveTextContent('Matinee');
    expect(screen.getByLabelText(/ticket code/i)).toHaveValue('');
  });
});

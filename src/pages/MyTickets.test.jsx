import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import MyTickets from './MyTickets.jsx';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><MyTickets /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyTickets', () => {
  it('lists the user orders with event title and a QR per ticket', async () => {
    server.use(http.get('/api/v1/orders', () => HttpResponse.json({
      success: true, data: [{
        id: 'o1', amount_cents: 2000, status: 'paid', created_at: '', quantity: 2,
        category_name: 'GA', event_id: 'e1', event_title: 'My Show', event_starts_at: null,
        tickets: [{ id: 't1', order_id: 'o1', qr_token: 'A', status: 'issued' }, { id: 't2', order_id: 'o1', qr_token: 'B', status: 'issued' }],
      }],
    })));
    renderPage();
    expect(await screen.findByText('My Show')).toBeInTheDocument();
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
    expect(await screen.findAllByRole('img', { name: /ticket/i })).toHaveLength(2);
  });

  it('shows an empty state when there are no orders', async () => {
    server.use(http.get('/api/v1/orders', () => HttpResponse.json({ success: true, data: [] })));
    renderPage();
    expect(await screen.findByText(/no tickets yet/i)).toBeInTheDocument();
  });

  it('shows the order API error and retries instead of reporting an empty wallet', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/orders', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Wallet unavailable.' } }, { status: 503 })
          : HttpResponse.json({ success: true, data: [] });
      }),
      http.get('/api/v1/refund-requests', () => HttpResponse.json({ success: true, data: [] })),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Wallet unavailable.');
    expect(screen.queryByText(/no tickets yet/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry loading tickets/i }));
    expect(await screen.findByText(/no tickets yet/i)).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('keeps orders visible and shows a separate retry state when refund statuses fail', async () => {
    let refundCalls = 0;
    server.use(
      http.get('/api/v1/orders', () => HttpResponse.json({
        success: true,
        data: [{
          id: 'o1', amount_cents: 2000, status: 'paid', created_at: '', quantity: 1,
          category_name: 'GA', event_id: 'e1', event_title: 'My Show', event_starts_at: null, tickets: [],
        }],
      })),
      http.get('/api/v1/refund-requests', () => {
        refundCalls += 1;
        return refundCalls === 1
          ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Refund statuses unavailable.' } }, { status: 503 })
          : HttpResponse.json({ success: true, data: [] });
      }),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Refund statuses unavailable.');
    expect(screen.getByRole('heading', { name: 'My Show' })).toBeInTheDocument();
    expect(screen.getByText(/retry before submitting a request/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request refund/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry refund statuses/i }));
    expect(await screen.findByRole('button', { name: /request refund/i })).toBeInTheDocument();
    expect(refundCalls).toBe(2);
  });
});

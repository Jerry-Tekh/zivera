import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
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
    server.use(
      http.get('/api/v1/orders', () => HttpResponse.json({
        success: true, data: [{
          id: 'o1', amount_cents: 2000, status: 'paid', created_at: '', quantity: 2,
          category_name: 'GA', event_id: 'e1', event_title: 'My Show', event_starts_at: null,
          tickets: [{ id: 't1', order_id: 'o1', qr_token: 'A', status: 'issued' }, { id: 't2', order_id: 'o1', qr_token: 'B', status: 'issued' }],
        }],
      })),
      http.get('/api/v1/refund-requests', () => HttpResponse.json({ success: true, data: [] })),
    );
    renderPage();
    expect(await screen.findByText('My Show')).toBeInTheDocument();
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('img', { name: /ticket/i })).toHaveLength(2));
  });

  it('shows an empty state when there are no orders', async () => {
    server.use(
      http.get('/api/v1/orders', () => HttpResponse.json({ success: true, data: [] })),
      http.get('/api/v1/refund-requests', () => HttpResponse.json({ success: true, data: [] })),
    );
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

  it('groups wallet orders and only shows QR codes for issued tickets', async () => {
    server.use(
      http.get('/api/v1/orders', () => HttpResponse.json({
        success: true,
        data: [
          {
            id: 'upcoming', amount_cents: 2000, status: 'paid', created_at: '', quantity: 2,
            category_name: 'GA', event_id: 'e1', event_title: 'Future Show',
            event_starts_at: '2099-10-13T18:00:00.000Z',
            tickets: [
              { id: 't1', order_id: 'upcoming', qr_token: 'A', status: 'issued' },
              { id: 't2', order_id: 'upcoming', qr_token: 'B', status: 'used' },
            ],
          },
          {
            id: 'past', amount_cents: 1000, status: 'paid', created_at: '', quantity: 1,
            category_name: 'GA', event_id: 'e2', event_title: 'Past Show',
            event_starts_at: '2000-10-13T18:00:00.000Z',
            tickets: [{ id: 't3', order_id: 'past', qr_token: 'C', status: 'used' }],
          },
          {
            id: 'refunded', amount_cents: 1000, status: 'refunded', created_at: '', quantity: 1,
            category_name: 'GA', event_id: 'e3', event_title: 'Refunded Show',
            event_starts_at: '2099-10-13T18:00:00.000Z',
            tickets: [{ id: 't4', order_id: 'refunded', qr_token: 'D', status: 'revoked' }],
          },
          {
            id: 'cancelled', amount_cents: 1000, status: 'cancelled', created_at: '', quantity: 1,
            category_name: 'GA', event_id: 'e4', event_title: 'Cancelled Show',
            event_starts_at: '2099-10-13T18:00:00.000Z', tickets: [],
          },
        ],
      })),
      http.get('/api/v1/refund-requests', () => HttpResponse.json({
        success: true,
        data: [{
          id: 'rr-approved', order_id: 'past', status: 'approved',
          created_at: '2026-10-10T12:00:00.000Z', reviewed_at: '2026-10-11T12:00:00.000Z',
          reviewer_note: 'Refund completed.', order_status: 'refunded',
        }],
      })),
    );
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Future Show' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Past' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Refunded / cancelled' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancelled Show' })).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByText(/Refund completed\./)).toBeInTheDocument();
    expect(screen.getByText(/Order status: refunded/i)).toBeInTheDocument();
    expect(screen.getAllByText('used')).toHaveLength(2);
    expect(screen.getByText('revoked')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('img', { name: /ticket/i })).toHaveLength(1));
  });

  it('shows refund request details and allows a new request after rejection', async () => {
    let postCount = 0;
    let refundListCalls = 0;
    server.use(
      http.get('/api/v1/orders', () => HttpResponse.json({
        success: true,
        data: [{
          id: 'o1', amount_cents: 2000, status: 'paid', created_at: '', quantity: 1,
          category_name: 'GA', event_id: 'e1', event_title: 'My Show',
          event_starts_at: '2099-10-13T18:00:00.000Z',
          tickets: [{ id: 't1', order_id: 'o1', qr_token: 'A', status: 'issued' }],
        }],
      })),
      http.get('/api/v1/refund-requests', () => {
        refundListCalls += 1;
        return HttpResponse.json({
          success: true,
          data: refundListCalls === 1
            ? [{
              id: 'rr1', order_id: 'o1', status: 'rejected', created_at: '2026-10-10T12:00:00.000Z',
              reviewed_at: '2026-10-11T12:00:00.000Z', reviewer_note: 'Please provide more information.',
              order_status: 'paid',
            }]
            : [
              { id: 'rr2', order_id: 'o1', status: 'pending', created_at: '2026-10-13T12:00:00.000Z' },
              {
                id: 'rr1', order_id: 'o1', status: 'rejected', created_at: '2026-10-10T12:00:00.000Z',
                reviewed_at: '2026-10-11T12:00:00.000Z', reviewer_note: 'Please provide more information.',
                order_status: 'paid',
              },
            ],
        });
      }),
      http.post('/api/v1/orders/o1/refund-requests', async ({ request }) => {
        postCount += 1;
        expect(await request.json()).toEqual({ reason: 'More information' });
        return HttpResponse.json({
          success: true,
          data: { id: 'rr2', order_id: 'o1', status: 'pending' },
        }, { status: 201 });
      }),
    );
    renderPage();

    expect(await screen.findByText(/Please provide more information\./)).toBeInTheDocument();
    expect(screen.getByText(/Order status: paid/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request refund/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/request a refund/i), 'More information');
    await userEvent.click(screen.getByRole('button', { name: /request refund/i }));

    expect(await screen.findByText(/refund request is awaiting review/i)).toBeInTheDocument();
    expect(postCount).toBe(1);
  });

  it('does not offer duplicate refund submissions while a request is pending', async () => {
    server.use(
      http.get('/api/v1/orders', () => HttpResponse.json({
        success: true,
        data: [{
          id: 'o1', amount_cents: 2000, status: 'paid', created_at: '', quantity: 1,
          category_name: 'GA', event_id: 'e1', event_title: 'My Show',
          event_starts_at: '2099-10-13T18:00:00.000Z', tickets: [],
        }],
      })),
      http.get('/api/v1/refund-requests', () => HttpResponse.json({
        success: true,
        data: [{ id: 'rr1', order_id: 'o1', status: 'pending', created_at: '2026-10-10T12:00:00.000Z' }],
      })),
    );
    renderPage();

    expect(await screen.findByText(/refund request is awaiting review/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request refund/i })).not.toBeInTheDocument();
  });
});

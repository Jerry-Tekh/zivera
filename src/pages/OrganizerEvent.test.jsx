import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import OrganizerEvent from './OrganizerEvent.jsx';

function renderAt(id) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/organizer/events/${id}`]}>
        <Routes><Route path="/organizer/events/:id" element={<OrganizerEvent />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const draft = { id: 'e1', title: 'My Event', status: 'draft', location: null, starts_at: null, description: null, created_at: '', categories: [] };
const sales = { eventId: 'e1', title: 'My Event', categories: [], totals: { sold: 3, revenueCents: 4500 } };
const emptyPage = { rows: [], page: 1, pageSize: 20, total: 0, totalPages: 0 };
const analytics = {
  event: { id: 'e1', title: 'My Event' },
  period: { timeZone: 'UTC', endExclusive: true, interval: 'day' },
  metrics: { ticketsSold: 3, grossRevenueCents: 4500, refundedAmountCents: 0, netRevenueCents: 4500, attendance: 2 },
  daily: [{ day: '2026-07-01', grossRevenueCents: 4500, refundedAmountCents: 0, ticketsSold: 3, attendance: 2 }],
  ticketCategories: [{ id: 'c1', name: 'General', sold: 3 }],
};
const analyticsHandler = () => http.get('/api/v1/events/e1/analytics', () => HttpResponse.json({ success: true, data: analytics }));

describe('OrganizerEvent', () => {
  it('shows the event, its sales totals, and publishes a draft', async () => {
    let status = 'draft';
    server.use(
      http.get('/api/v1/admin/events/e1', () => HttpResponse.json({ success: true, data: { ...draft, status } })),
      http.get('/api/v1/events/e1/sales', () => HttpResponse.json({ success: true, data: sales })),
      analyticsHandler(),
      http.get('/api/v1/events/e1/orders', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/refund-requests', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/staff', () => HttpResponse.json({ success: true, data: [] })),
      http.patch('/api/v1/events/e1', async ({ request }) => { const b = await request.json(); status = b.status ?? status; return HttpResponse.json({ success: true, data: { ...draft, status } }); }),
    );
    renderAt('e1');
    expect(await screen.findByRole('heading', { name: 'My Event' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Daily revenue and refunds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 sold' })).toBeInTheDocument();
    expect(screen.getByText(/\$45\.00/, { selector: 'p' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /publish/i }));
    expect(await screen.findByText(/^published$/i, { selector: '.badge' })).toBeInTheDocument();
  });

  it('adds a ticket category', async () => {
    let categories = [];
    server.use(
      http.get('/api/v1/admin/events/e1', () => HttpResponse.json({ success: true, data: { ...draft, categories } })),
      http.get('/api/v1/events/e1/sales', () => HttpResponse.json({ success: true, data: sales })),
      analyticsHandler(),
      http.get('/api/v1/events/e1/orders', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/refund-requests', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/staff', () => HttpResponse.json({ success: true, data: [] })),
      http.post('/api/v1/events/e1/categories', async ({ request }) => {
        const b = await request.json();
        const c = { id: 'c1', event_id: 'e1', name: b.name, price_cents: b.priceCents, total_quantity: b.totalQuantity, available_quantity: b.totalQuantity, max_per_customer: 10, sales_open_at: null, sales_close_at: null };
        categories = [c];
        return HttpResponse.json({ success: true, data: c }, { status: 201 });
      }),
    );
    renderAt('e1');
    await screen.findByRole('heading', { name: 'My Event' });
    await userEvent.type(screen.getByLabelText(/category name/i), 'VIP');
    await userEvent.type(screen.getByLabelText(/price.*cents/i), '5000');
    await userEvent.type(screen.getByLabelText(/quantity/i), '20');
    await userEvent.click(screen.getByRole('button', { name: /add category/i }));
    expect(await screen.findByText(/VIP/)).toBeInTheDocument();
  });

  it('refunds a paid order from the orders list', async () => {
    let orders = [{ id: 'o1', email: 'buyer@b.co', category_name: 'GA', quantity: 2, amount_cents: 2000, status: 'paid', created_at: '' }];
    let refunded = false;
    server.use(
      http.get('/api/v1/admin/events/e1', () => HttpResponse.json({ success: true, data: { ...draft, status: 'published' } })),
      http.get('/api/v1/events/e1/sales', () => HttpResponse.json({ success: true, data: sales })),
      analyticsHandler(),
      http.get('/api/v1/events/e1/orders', () => HttpResponse.json({ success: true, data: { ...emptyPage, rows: orders, total: orders.length, totalPages: 1 } })),
      http.get('/api/v1/events/e1/refund-requests', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/staff', () => HttpResponse.json({ success: true, data: [] })),
      http.post('/api/v1/orders/o1/refund', () => {
        refunded = true;
        orders = orders.map((o) => ({ ...o, status: 'refunded' }));
        return HttpResponse.json({ success: true, data: { result: 'refunded', orderId: 'o1' } });
      }),
    );
    renderAt('e1');
    expect(await screen.findByText('buyer@b.co')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /refund/i }));
    await screen.findByText('refunded');
    expect(refunded).toBe(true);
  });

  it('shows retryable failures and empty states for staff, refund requests, and orders', async () => {
    let staffCalls = 0;
    let refundCalls = 0;
    let orderCalls = 0;
    const unavailable = () => HttpResponse.json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Service is unavailable.' },
    }, { status: 503 });
    server.use(
      http.get('/api/v1/admin/events/e1', () => HttpResponse.json({ success: true, data: draft })),
      http.get('/api/v1/events/e1/sales', () => HttpResponse.json({ success: true, data: sales })),
      analyticsHandler(),
      http.get('/api/v1/events/e1/staff', () => (++staffCalls === 1
        ? unavailable()
        : HttpResponse.json({ success: true, data: [] }))),
      http.get('/api/v1/events/e1/refund-requests', () => (++refundCalls === 1
        ? unavailable()
        : HttpResponse.json({ success: true, data: emptyPage }))),
      http.get('/api/v1/events/e1/orders', () => (++orderCalls === 1
        ? unavailable()
        : HttpResponse.json({ success: true, data: emptyPage }))),
    );
    renderAt('e1');

    await userEvent.click(await screen.findByRole('button', { name: 'Retry staff' }));
    expect(await screen.findByText('No staff assigned.')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Retry refund requests' }));
    expect(await screen.findByText('No refund requests.')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Retry orders' }));
    expect(await screen.findByText('No orders yet.')).toBeInTheDocument();
    expect(staffCalls).toBe(2);
    expect(refundCalls).toBe(2);
    expect(orderCalls).toBe(2);
  });

  it('applies an inclusive calendar date range as the exclusive UTC API end', async () => {
    let requestParams;
    server.use(
      http.get('/api/v1/admin/events/e1', () => HttpResponse.json({ success: true, data: draft })),
      http.get('/api/v1/events/e1/sales', () => HttpResponse.json({ success: true, data: sales })),
      http.get('/api/v1/events/e1/analytics', ({ request }) => {
        requestParams = new URL(request.url).searchParams;
        return HttpResponse.json({ success: true, data: analytics });
      }),
      http.get('/api/v1/events/e1/orders', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/refund-requests', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/staff', () => HttpResponse.json({ success: true, data: [] })),
    );
    renderAt('e1');
    await screen.findByRole('heading', { name: 'My Event' });
    await userEvent.clear(screen.getByLabelText('From'));
    await userEvent.type(screen.getByLabelText('From'), '2026-07-01');
    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-07-03');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    expect(await screen.findByRole('img', { name: 'Daily ticket activity' })).toBeInTheDocument();
    expect(requestParams.get('from')).toBe('2026-07-01T00:00:00.000Z');
    expect(requestParams.get('to')).toBe('2026-07-04T00:00:00.000Z');
  });

  it('keeps analytics failures separate and offers an explicit retry', async () => {
    let analyticsCalls = 0;
    server.use(
      http.get('/api/v1/admin/events/e1', () => HttpResponse.json({ success: true, data: draft })),
      http.get('/api/v1/events/e1/sales', () => HttpResponse.json({ success: true, data: sales })),
      http.get('/api/v1/events/e1/analytics', () => {
        analyticsCalls += 1;
        return analyticsCalls === 1
          ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Analytics unavailable.' } }, { status: 503 })
          : HttpResponse.json({ success: true, data: analytics });
      }),
      http.get('/api/v1/events/e1/orders', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/refund-requests', () => HttpResponse.json({ success: true, data: emptyPage })),
      http.get('/api/v1/events/e1/staff', () => HttpResponse.json({ success: true, data: [] })),
    );
    renderAt('e1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable.');
    expect(screen.getByText(/3 sold/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry event analytics' }));
    expect(await screen.findByRole('img', { name: 'Daily revenue and refunds' })).toBeInTheDocument();
    expect(analyticsCalls).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import OrganizerDashboard from './OrganizerDashboard.jsx';

const performanceEvent = {
  id: 'e1',
  title: 'Existing',
  status: 'draft',
  startsAt: null,
  capacity: 40,
  capacityRemaining: 22,
  ticketsSold: 5,
  grossRevenueCents: 12000,
  refundedAmountCents: 2000,
  netRevenueCents: 10000,
};

function performanceResponse(rows, total = rows.length, statusCounts = { draft: total, published: 0 }, page = 1) {
  return {
    success: true,
    data: {
      rows,
      page,
      pageSize: 20,
      total,
      totalPages: Math.ceil(total / 20),
      statusCounts,
      period: { timeZone: 'UTC', endExclusive: true },
    },
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><OrganizerDashboard /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OrganizerDashboard', () => {
  it('lists events and creates a new one', async () => {
    let events = [performanceEvent];
    server.use(
      http.get('/api/v1/analytics/events', () => HttpResponse.json(performanceResponse(events))),
      http.post('/api/v1/events', async ({ request }) => {
        const b = await request.json();
        const ev = { id: 'e2', title: b.title, status: b.status ?? 'draft', starts_at: null };
        events = [ev, ...events];
        return HttpResponse.json({ success: true, data: ev }, { status: 201 });
      }),
    );
    renderPage();
    expect(await screen.findByText('Existing')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Net revenue' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '$100.00' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '22 / 40' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/event title/i), 'Brand New');
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));
    expect(await screen.findByText('Brand New')).toBeInTheDocument();
  });

  it('offers retry when the event list fails to load', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/analytics/events', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Events unavailable.' } }, { status: 503 })
        : HttpResponse.json(performanceResponse([], 0, { draft: 0, published: 0 }));
    }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Events unavailable.');
    expect(screen.queryByText(/no events yet/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry loading events/i }));
    expect(await screen.findByText(/no events yet/i)).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('paginates and filters the managed event list using server query parameters', async () => {
    let requestParams;
    server.use(http.get('/api/v1/analytics/events', ({ request }) => {
      requestParams = new URL(request.url).searchParams;
      const page = Number(requestParams.get('page'));
      const isFiltered = requestParams.get('search') === 'Night' && requestParams.get('status') === 'published';
      const title = page === 1 ? (isFiltered ? 'Filtered Night' : 'First Night') : 'Second Night';
      return HttpResponse.json(performanceResponse([{
        ...performanceEvent,
        id: page === 1 ? 'e1' : 'e2',
        title,
        status: 'published',
      }], isFiltered ? 21 : 25, { draft: 4, published: 21 }, page));
    }));
    renderPage();
    expect(await screen.findByText('First Night')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/search events/i), 'Night');
    await userEvent.selectOptions(screen.getAllByLabelText(/^status$/i)[1], 'published');
    await userEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Filtered Night')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText('Second Night')).toBeInTheDocument();
    expect(requestParams.get('page')).toBe('2');
    expect(requestParams.get('search')).toBe('Night');
    expect(requestParams.get('status')).toBe('published');
  });

  it('requests the selected UTC window for performance figures and rejects an overlong range', async () => {
    let requestParams;
    server.use(http.get('/api/v1/analytics/events', ({ request }) => {
      requestParams = new URL(request.url).searchParams;
      return HttpResponse.json(performanceResponse([performanceEvent]));
    }));
    renderPage();
    await screen.findByText('Existing');
    await userEvent.clear(screen.getByLabelText('From'));
    await userEvent.type(screen.getByLabelText('From'), '2026-01-01');
    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-01-03');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));

    expect(await screen.findByText('$100.00')).toBeInTheDocument();
    expect(requestParams.get('from')).toBe('2026-01-01T00:00:00.000Z');
    expect(requestParams.get('to')).toBe('2026-01-04T00:00:00.000Z');

    await userEvent.clear(screen.getByLabelText('From'));
    await userEvent.type(screen.getByLabelText('From'), '2025-01-01');
    await userEvent.clear(screen.getByLabelText('To'));
    await userEvent.type(screen.getByLabelText('To'), '2026-01-02');
    await userEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
    expect(screen.getByRole('alert')).toHaveTextContent('no more than 366 days');
  });
});

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import OrganizerDashboard from './OrganizerDashboard.jsx';

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
    let events = [{ id: 'e1', title: 'Existing', status: 'draft', starts_at: null }];
    server.use(
      http.get('/api/v1/admin/events', () => HttpResponse.json({ success: true, data: {
        rows: events,
        page: 1,
        pageSize: 20,
        total: events.length,
        totalPages: 1,
        statusCounts: { draft: events.filter((event) => event.status === 'draft').length, published: events.filter((event) => event.status === 'published').length },
      } })),
      http.post('/api/v1/events', async ({ request }) => {
        const b = await request.json();
        const ev = { id: 'e2', title: b.title, status: b.status ?? 'draft', starts_at: null };
        events = [ev, ...events];
        return HttpResponse.json({ success: true, data: ev }, { status: 201 });
      }),
    );
    renderPage();
    expect(await screen.findByText('Existing')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/event title/i), 'Brand New');
    await userEvent.click(screen.getByRole('button', { name: /create event/i }));
    expect(await screen.findByText('Brand New')).toBeInTheDocument();
  });

  it('offers retry when the event list fails to load', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/admin/events', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Events unavailable.' } }, { status: 503 })
        : HttpResponse.json({ success: true, data: {
          rows: [], page: 1, pageSize: 20, total: 0, totalPages: 0, statusCounts: { draft: 0, published: 0 },
        } });
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
    server.use(http.get('/api/v1/admin/events', ({ request }) => {
      requestParams = new URL(request.url).searchParams;
      const page = Number(requestParams.get('page'));
      const isFiltered = requestParams.get('search') === 'Night' && requestParams.get('status') === 'published';
      return HttpResponse.json({ success: true, data: {
        rows: [{ id: page === 1 ? 'e1' : 'e2', title: page === 1 ? (isFiltered ? 'Filtered Night' : 'First Night') : 'Second Night', status: 'published' }],
        page,
        pageSize: 20,
        total: isFiltered ? 21 : 25,
        totalPages: 2,
        statusCounts: { draft: 4, published: 21 },
      } });
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
});

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import Browse from './Browse.jsx';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><Browse /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Browse', () => {
  it('renders event cards from GET /events', async () => {
    server.use(http.get('/api/v1/events', () => HttpResponse.json({
      success: true,
      data: [{ id: 'e1', title: 'Midnight Symphony', location: 'Royal Hall', starts_at: '2026-07-12T20:00:00Z', status: 'published', description: null, created_at: '' }],
      meta: { page: 1, pageSize: 20, count: 1 },
    })));
    renderPage();
    const results = await screen.findByRole('region', { name: /explore all events/i });
    expect(await within(results).findByText('Midnight Symphony')).toBeInTheDocument();
    expect(await screen.findByText('Upcoming')).toBeInTheDocument();
  });

  it('shows clear empty states when no published events are returned', async () => {
    server.use(http.get('/api/v1/events', () => HttpResponse.json({
      success: true,
      data: [],
      meta: { page: 1, pageSize: 8, count: 0 },
    })));
    renderPage();
    expect(await screen.findByText(/no featured events/i)).toBeInTheDocument();
    expect(await screen.findByText(/no events available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no published events yet/i).length).toBeGreaterThan(0);
  });

  it('filters the grid by the search box', async () => {
    server.use(http.get('/api/v1/events', () => HttpResponse.json({
      success: true,
      data: [
        { id: 'e1', title: 'Midnight Symphony', location: 'Royal Hall', starts_at: null, status: 'published', description: null, created_at: '' },
        { id: 'e2', title: 'Neon Pulse Festival', location: 'Harbour', starts_at: null, status: 'published', description: null, created_at: '' },
      ],
    })));
    renderPage();
    const results = await screen.findByRole('region', { name: /explore all events/i });
    expect(await within(results).findByText('Midnight Symphony')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/search events/i), 'neon');
    expect(await within(results).findByText('Neon Pulse Festival')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(results).queryByText('Midnight Symphony')).not.toBeInTheDocument();
    });
  });
});

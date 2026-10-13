import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import AdminUsers from './AdminUsers.jsx';

function renderAdminUsers() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><AdminUsers /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminUsers', () => {
  it('lists users and updates a role', async () => {
    let users = [
      { id: 'u1', name: 'Ada', email: 'ada@tessera.local', role: 'registered_user', created_at: '' },
      { id: 'u2', name: 'Ola', email: 'ola@tessera.local', role: 'event_staff', created_at: '' },
    ];
    let roleBody = null;
    server.use(
      http.get('/api/v1/admin/users', () => HttpResponse.json({ success: true, data: {
        rows: users,
        page: 1,
        pageSize: 20,
        total: users.length,
        totalPages: 1,
      } })),
      http.patch('/api/v1/admin/users/u1/role', async ({ request }) => {
        roleBody = await request.json();
        users = users.map((user) => (user.id === 'u1' ? { ...user, role: roleBody.role } : user));
        return HttpResponse.json({ success: true, data: users[0] });
      }),
    );

    renderAdminUsers();
    expect(await screen.findByText('ada@tessera.local')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getAllByLabelText(/role/i)[1], 'organizer');
    await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);

    expect(await screen.findByText(/user role updated/i)).toBeInTheDocument();
    expect(roleBody).toEqual({ role: 'organizer' });
  });

  it('shows a retryable users error and only shows empty after a successful response', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/admin/users', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Users unavailable.' } }, { status: 503 })
        : HttpResponse.json({ success: true, data: { rows: [], page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    }));
    renderAdminUsers();

    expect(await screen.findByRole('alert')).toHaveTextContent('Users unavailable.');
    expect(screen.queryByText('No users found.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry loading users/i }));
    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('filters and paginates the users using server-side query parameters', async () => {
    let params;
    server.use(http.get('/api/v1/admin/users', ({ request }) => {
      params = new URL(request.url).searchParams;
      const page = Number(params.get('page'));
      const filtered = params.get('search') === 'Ada' && params.get('role') === 'organizer';
      return HttpResponse.json({ success: true, data: {
        rows: [{ id: `u${page}`, name: page === 1 ? (filtered ? 'Ada Filtered' : 'First User') : 'Second User', email: `u${page}@example.test`, role: 'organizer' }],
        page,
        pageSize: 20,
        total: 21,
        totalPages: 2,
      } });
    }));
    renderAdminUsers();
    expect(await screen.findByText('First User')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/search users/i), 'Ada');
    await userEvent.selectOptions(screen.getAllByLabelText(/^role$/i)[0], 'organizer');
    await userEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Ada Filtered')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(await screen.findByText('Second User')).toBeInTheDocument();
    expect(params.get('page')).toBe('2');
    expect(params.get('search')).toBe('Ada');
    expect(params.get('role')).toBe('organizer');
  });
});

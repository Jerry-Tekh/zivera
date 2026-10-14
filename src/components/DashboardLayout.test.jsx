import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { server } from '../test/server';

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../lib/auth.jsx', () => ({ useAuth: mocks.useAuth }));

import DashboardLayout from './DashboardLayout.jsx';

function renderDashboard(role, initialPath = '/tickets') {
  mocks.useAuth.mockReturnValue({ user: { role, name: 'Taylor User', email: 'taylor@example.com' } });
  function CurrentPath() {
    return <p data-testid="current-path">{useLocation().pathname}</p>;
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="*" element={<><p>Dashboard content</p><CurrentPath /></>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    mocks.useAuth.mockReset();
    server.use(http.get('/api/v1/health', () => HttpResponse.json({
      success: true, data: { status: 'ok', db: true, redis: true },
    })));
  });

  it('shows only the attendee workspace links for registered users', async () => {
    renderDashboard('registered_user');
    expect(screen.getByRole('link', { name: /my tickets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /account/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ticket scanner/i })).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    expect(await screen.findByText('System online')).toBeInTheDocument();
  });

  it('shows organizer tools and allows collapsing the sidebar', async () => {
    renderDashboard('organizer', '/organizer');
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^events$/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });

  it('shows the administrator navigation and opens a closable mobile menu', async () => {
    renderDashboard('super_admin', '/admin/users');
    expect(screen.getByRole('link', { name: /platform overview/i })).toHaveAttribute('href', '/admin/overview');
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ticket scanner/i })).toBeInTheDocument();
    const menu = screen.getByRole('button', { name: /open navigation/i });
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('lands super admins on the platform overview dashboard route', () => {
    renderDashboard('super_admin', '/dashboard');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/overview');
  });
});

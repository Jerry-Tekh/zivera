import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import { AuthProvider } from '../lib/auth.jsx';
import Account from './Account.jsx';

const authUser = { id: 'u1', name: 'Tessera User', email: 'user@tessera.local', role: 'registered_user' };

function renderAccount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter><Account /></MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Account', () => {
  it('lists active sessions and revokes one', async () => {
    let sessions = [
      { id: 's1', user_agent: 'Firefox', ip: '10.0.0.1', last_used_at: '2026-06-26T10:00:00Z', created_at: '' },
      { id: 's2', user_agent: 'Safari', ip: '10.0.0.2', last_used_at: '2026-06-26T09:00:00Z', created_at: '' },
    ];
    let revokeCalls = 0;
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json({ success: true, data: authUser })),
      http.get('/api/v1/auth/sessions', () => HttpResponse.json({ success: true, data: sessions })),
      http.post('/api/v1/auth/sessions/s2/revoke', () => {
        revokeCalls += 1;
        if (revokeCalls === 1) {
          return HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Could not revoke session.' } }, { status: 503 });
        }
        sessions = sessions.filter((s) => s.id !== 's2');
        return HttpResponse.json({ success: true, data: { ok: true } });
      }),
    );
    renderAccount();
    expect(await screen.findByText(/Firefox/)).toBeInTheDocument();
    expect(screen.getByText(/Safari/)).toBeInTheDocument();
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    await userEvent.click(revokeButtons[1]);
    expect(await screen.findByRole('status')).toHaveTextContent('Could not revoke session.');
    await userEvent.click(screen.getAllByRole('button', { name: /revoke/i })[1]);
    await screen.findByText(/Firefox/);
    expect(screen.queryByText(/Safari/)).not.toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Session revoked.');
  });

  it('shows a retryable session-list error and an empty state after recovery', async () => {
    let calls = 0;
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json({ success: true, data: authUser })),
      http.get('/api/v1/auth/sessions', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Sessions unavailable.' } }, { status: 503 })
          : HttpResponse.json({ success: true, data: [] });
      }),
    );
    renderAccount();

    expect(await screen.findByRole('alert')).toHaveTextContent('Sessions unavailable.');
    expect(screen.queryByText('No active sessions.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry loading sessions/i }));
    expect(await screen.findByText('No active sessions.')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('updates profile and password', async () => {
    let profileBody = null;
    let passwordBody = null;
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json({ success: true, data: authUser })),
      http.get('/api/v1/auth/sessions', () => HttpResponse.json({ success: true, data: [] })),
      http.patch('/api/v1/auth/me', async ({ request }) => {
        profileBody = await request.json();
        return HttpResponse.json({
          success: true,
          data: { ...authUser, name: profileBody.name, email: profileBody.email },
        });
      }),
      http.post('/api/v1/auth/password', async ({ request }) => {
        passwordBody = await request.json();
        return HttpResponse.json({ success: true, data: { ok: true } });
      }),
    );

    renderAccount();
    await screen.findByDisplayValue('Tessera User');
    await userEvent.clear(screen.getByLabelText(/^name$/i));
    await userEvent.type(screen.getByLabelText(/^name$/i), 'Updated User');
    await userEvent.clear(screen.getByLabelText(/^email$/i));
    await userEvent.type(screen.getByLabelText(/^email$/i), 'updated@tessera.local');
    await userEvent.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText(/profile updated/i)).toBeInTheDocument();
    expect(profileBody).toEqual({ name: 'Updated User', email: 'updated@tessera.local' });
    expect(screen.getByRole('heading', { name: /updated user/i })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/current password/i), 'oldPassword123');
    await userEvent.type(screen.getByLabelText(/new password/i), 'newPassword123');
    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(passwordBody).toEqual({ currentPassword: 'oldPassword123', newPassword: 'newPassword123' });
  });
});

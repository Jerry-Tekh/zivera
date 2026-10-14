import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '../test/server';
import { AuthProvider } from '../lib/auth.jsx';
import Register from './Register.jsx';

function renderRegister() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Register', () => {
  it('registers and redirects home', async () => {
    server.use(http.post('/api/v1/auth/register', () => HttpResponse.json({
      success: true, data: { accessToken: 't', user: { id: 'u1', name: 'A', email: 'a@b.co', role: 'registered_user' } },
    }, { status: 201 })));
    renderRegister();
    await userEvent.type(screen.getByLabelText(/name/i), 'A');
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/password/i), 'password1234');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('surfaces a taken-email error', async () => {
    server.use(http.post('/api/v1/auth/register', () => HttpResponse.json(
      { success: false, error: { code: 'EMAIL_TAKEN', message: 'Email already registered' } }, { status: 409 })));
    renderRegister();
    await userEvent.type(screen.getByLabelText(/name/i), 'A');
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/password/i), 'password1234');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });
});

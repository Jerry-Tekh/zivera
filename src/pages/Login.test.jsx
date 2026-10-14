import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '../test/server';
import { AuthProvider } from '../lib/auth.jsx';
import Login from './Login.jsx';

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Login', () => {
  it('logs in and redirects home', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json({
      success: true, data: { accessToken: 'tok', user: { id: 'u1', name: 'A', email: 'a@b.co', role: 'registered_user' } },
    })));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/password/i), 'password1234');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  it('shows an error on invalid credentials', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, { status: 401 })));
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});

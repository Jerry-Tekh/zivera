import { describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../test/server';
import SystemHealth from './SystemHealth.jsx';

function renderHealth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SystemHealth />
    </QueryClientProvider>,
  );
}

describe('SystemHealth', () => {
  it('shows a checking state before the health response arrives', async () => {
    server.use(http.get('/api/v1/health', async () => {
      await delay(100);
      return HttpResponse.json({ success: true, data: { status: 'ok', db: true, redis: true } });
    }));
    renderHealth();

    expect(screen.getByRole('status')).toHaveTextContent('Checking system');
    expect(await screen.findByText('System online')).toBeInTheDocument();
  });

  it('shows healthy and degraded health distinctly, including a 503 degraded response', async () => {
    server.use(http.get('/api/v1/health', () => HttpResponse.json({
      success: true, data: { status: 'ok', db: true, redis: true },
    })));
    const healthy = renderHealth();
    expect(await screen.findByText('System online')).toBeInTheDocument();
    healthy.unmount();

    server.use(http.get('/api/v1/health', () => HttpResponse.json({
      success: true, data: { status: 'degraded', db: false, redis: true },
    }, { status: 503 })));
    renderHealth();
    expect(await screen.findByText('System degraded')).toBeInTheDocument();
  });

  it('reports an unavailable health endpoint and allows a manual retry', async () => {
    let calls = 0;
    server.use(http.get('/api/v1/health', () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.error()
        : HttpResponse.json({ success: true, data: { status: 'ok', db: true, redis: true } });
    }));
    renderHealth();

    expect(await screen.findByText('Health check unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    expect(await screen.findByText('System online')).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

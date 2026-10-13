import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyAnalytics from './DailyAnalytics.jsx';

const daily = [
  { day: '2026-07-01', grossRevenueCents: 12000, refundedAmountCents: 0, ticketsSold: 4, attendance: 2 },
  { day: '2026-07-02', grossRevenueCents: 0, refundedAmountCents: 2500, ticketsSold: 0, attendance: 0 },
];

describe('DailyAnalytics', () => {
  it('renders independently labelled chart visualizations for reporting data', () => {
    const { container } = render(<DailyAnalytics
      daily={daily}
      ticketCategories={[
        { id: 'c1', name: 'General', sold: 3 },
        { id: 'c2', name: 'VIP', sold: 1 },
      ]}
    />);

    expect(screen.getByRole('img', { name: 'Daily revenue and refunds' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Daily ticket activity' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'General share of tickets sold' })).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByRole('progressbar', { name: 'VIP share of tickets sold' })).toHaveAttribute('aria-valuenow', '25');
    expect(container.querySelectorAll('.daily-chart-bar')).toHaveLength(8);
  });

  it('provides an accessible table for exact daily values', async () => {
    render(<DailyAnalytics daily={daily} ticketCategories={[]} />);
    await userEvent.click(screen.getByText('View daily analytics as a table'));

    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /2026-07-01.*\$120\.00.*\$0\.00.*4.*2/i })).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /2026-07-02.*\$0\.00.*\$25\.00.*0.*0/i })).toBeInTheDocument();
    expect(screen.getByText('No ticket categories are configured for this event.')).toBeInTheDocument();
  });
});

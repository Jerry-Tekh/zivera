import { lazy, Suspense } from 'react';
import './DailyAnalytics.css';

const DailyBarChart = lazy(() => import('./AnalyticsCharts.jsx')
  .then((module) => ({ default: module.DailyBarChart })));
const CategorySalesChart = lazy(() => import('./AnalyticsCharts.jsx')
  .then((module) => ({ default: module.CategorySalesChart })));

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const compactMoney = (cents) => `$${new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(cents / 100)}`;
const number = (value) => new Intl.NumberFormat('en-US').format(value);

export default function DailyAnalytics({ daily, ticketCategories = [], showCategories = true }) {
  return (
    <div className="daily-analytics">
      <div className="grid-2">
        <figure className="daily-chart-figure" aria-labelledby="daily-revenue-title">
          <figcaption id="daily-revenue-title">Daily revenue and refunds</figcaption>
          <div className="daily-chart" role="group" aria-labelledby="daily-revenue-title">
            <Suspense fallback={<div className="chart-loading" aria-live="polite">Loading chart…</div>}>
              <DailyBarChart
                daily={daily}
                firstKey="grossRevenueCents"
                secondKey="refundedAmountCents"
                firstLabel="Gross sales"
                secondLabel="Refunds"
                formatValue={money}
                formatAxisValue={compactMoney}
              />
            </Suspense>
          </div>
        </figure>
        <figure className="daily-chart-figure" aria-labelledby="daily-ticket-title">
          <figcaption id="daily-ticket-title">Daily ticket activity</figcaption>
          <div className="daily-chart" role="group" aria-labelledby="daily-ticket-title">
            <Suspense fallback={<div className="chart-loading" aria-live="polite">Loading chart…</div>}>
              <DailyBarChart
                daily={daily}
                firstKey="ticketsSold"
                secondKey="attendance"
                firstLabel="Tickets sold"
                secondLabel="Attendance"
                formatValue={number}
                formatAxisValue={number}
              />
            </Suspense>
          </div>
        </figure>
      </div>

      {showCategories && (
        <section className="daily-category-report" aria-labelledby="category-report-heading">
          <div>
            <span className="eyebrow">Ticket tiers</span>
            <h3 id="category-report-heading">Sales by category</h3>
            <p className="muted">Tickets sold in each category during the selected reporting window.</p>
          </div>
          {ticketCategories.length
            ? (
              <figure className="daily-chart-figure category-sales-chart" aria-labelledby="category-sales-chart-title">
                <figcaption id="category-sales-chart-title">Ticket sales by category</figcaption>
                <div className="daily-chart category-sales-chart-plot" role="group" aria-labelledby="category-sales-chart-title">
                  <Suspense fallback={<div className="chart-loading" aria-live="polite">Loading chart…</div>}>
                    <CategorySalesChart ticketCategories={ticketCategories} />
                  </Suspense>
                </div>
                <details className="daily-category-data">
                  <summary>View category totals</summary>
                  <ul>
                    {ticketCategories.map((category) => (
                      <li key={category.id}>{category.name}: {number(category.sold)} sold</li>
                    ))}
                  </ul>
                </details>
              </figure>
            )
            : <p className="muted">No ticket categories are configured for this event.</p>}
        </section>
      )}

      <details className="daily-data-details">
        <summary>View daily analytics as a table</summary>
        <div className="table-card">
          <table>
            <thead>
              <tr><th scope="col">UTC date</th><th scope="col">Gross sales</th><th scope="col">Refunds</th><th scope="col">Tickets sold</th><th scope="col">Attendance</th></tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.day}>
                  <th scope="row">{day.day}</th>
                  <td>{money(day.grossRevenueCents)}</td>
                  <td>{money(day.refundedAmountCents)}</td>
                  <td>{number(day.ticketsSold)}</td>
                  <td>{number(day.attendance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

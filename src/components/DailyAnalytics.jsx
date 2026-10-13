import './DailyAnalytics.css';

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const dateLabel = (date) => new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function DailyBarChart({ daily, firstKey, secondKey, firstLabel, secondLabel, formatValue, title }) {
  const chartWidth = Math.max(720, daily.length * 26);
  const chartHeight = 220;
  const plotTop = 12;
  const plotBottom = 174;
  const plotHeight = plotBottom - plotTop;
  const values = daily.flatMap((day) => [day[firstKey], day[secondKey]]);
  const maxValue = Math.max(1, ...values);
  const groupWidth = chartWidth / Math.max(daily.length, 1);
  const barWidth = Math.max(2, Math.min(9, groupWidth * 0.32));
  const labelInterval = Math.max(1, Math.ceil(daily.length / 8));
  const titleId = `daily-chart-${firstKey}-${secondKey}`;

  return (
    <figure className="daily-chart-figure">
      <figcaption id={titleId}>{title}</figcaption>
      <div className="daily-chart-scroll">
        <svg
          className="daily-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-labelledby={titleId}
          preserveAspectRatio="none"
          style={{ minWidth: `${chartWidth}px` }}
        >
          <line x1="0" y1={plotBottom} x2={chartWidth} y2={plotBottom} className="daily-chart-baseline" />
          {daily.map((day, index) => {
            const groupCenter = (index + 0.5) * groupWidth;
            const firstHeight = (day[firstKey] / maxValue) * plotHeight;
            const secondHeight = (day[secondKey] / maxValue) * plotHeight;
            const xFirst = groupCenter - barWidth - 1;
            const xSecond = groupCenter + 1;
            const labelX = groupCenter;
            return (
              <g key={day.day}>
                <rect
                  x={xFirst}
                  y={plotBottom - firstHeight}
                  width={barWidth}
                  height={Math.max(firstHeight, day[firstKey] > 0 ? 1 : 0)}
                  rx="2"
                  className="daily-chart-bar primary"
                >
                  <title>{`${dateLabel(day.day)} · ${firstLabel}: ${formatValue(day[firstKey])}`}</title>
                </rect>
                <rect
                  x={xSecond}
                  y={plotBottom - secondHeight}
                  width={barWidth}
                  height={Math.max(secondHeight, day[secondKey] > 0 ? 1 : 0)}
                  rx="2"
                  className="daily-chart-bar secondary"
                >
                  <title>{`${dateLabel(day.day)} · ${secondLabel}: ${formatValue(day[secondKey])}`}</title>
                </rect>
                {(index % labelInterval === 0 || index === daily.length - 1) && (
                  <text x={labelX} y="200" textAnchor="middle" className="daily-chart-date">
                    {dateLabel(day.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="daily-chart-legend">
        <li><span className="daily-chart-swatch primary" />{firstLabel}</li>
        <li><span className="daily-chart-swatch secondary" />{secondLabel}</li>
      </ul>
    </figure>
  );
}

export default function DailyAnalytics({ daily, ticketCategories }) {
  const ticketsSold = ticketCategories.reduce((sum, category) => sum + category.sold, 0);

  return (
    <div className="daily-analytics">
      <div className="grid-2">
        <DailyBarChart
          daily={daily}
          firstKey="grossRevenueCents"
          secondKey="refundedAmountCents"
          firstLabel="Gross sales"
          secondLabel="Refunds"
          formatValue={money}
          title="Daily revenue and refunds"
        />
        <DailyBarChart
          daily={daily}
          firstKey="ticketsSold"
          secondKey="attendance"
          firstLabel="Tickets sold"
          secondLabel="Attendance"
          formatValue={(value) => String(value)}
          title="Daily ticket activity"
        />
      </div>

      <section className="daily-category-report" aria-labelledby="category-report-heading">
        <div>
          <span className="eyebrow">Ticket tiers</span>
          <h3 id="category-report-heading">Sales by category</h3>
          <p className="muted">Share of tickets sold in the selected reporting window.</p>
        </div>
        {ticketCategories.length ? (
          <ul className="daily-category-list">
            {ticketCategories.map((category) => {
              const share = ticketsSold ? Math.round((category.sold / ticketsSold) * 100) : 0;
              return (
                <li key={category.id} className="daily-category-row">
                  <div className="between">
                    <strong>{category.name}</strong>
                    <span className="mono">{category.sold} sold · {share}%</span>
                  </div>
                  <div
                    className="daily-category-track"
                    role="progressbar"
                    aria-label={`${category.name} share of tickets sold`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={share}
                  >
                    <span style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="muted">No ticket categories are configured for this event.</p>}
      </section>

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
                  <td>{day.ticketsSold}</td>
                  <td>{day.attendance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

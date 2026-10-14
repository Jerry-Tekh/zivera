import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { staffScanAnalytics } from '../lib/analyticsApi';
import { messageFor } from '../lib/errors';

const StaffScanTrendChart = lazy(() => import('./AnalyticsCharts.jsx').then((module) => ({
  default: module.StaffScanTrendChart,
})));

const DAY_MS = 24 * 60 * 60 * 1000;
const RESULTS = [
  ['accepted', 'Admitted'],
  ['already_used', 'Already used'],
  ['wrong_event', 'Wrong event'],
  ['not_found', 'Not found'],
  ['invalid_signature', 'Invalid QR'],
  ['revoked', 'Revoked'],
];

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const today = new Date();
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return {
    from: dateString(new Date(end - 6 * DAY_MS)),
    to: dateString(new Date(end)),
  };
}

function exclusiveEnd(date) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

function daysInRange(range) {
  if (!range.from || !range.to) return 0;
  return (Date.parse(`${range.to}T00:00:00.000Z`) - Date.parse(`${range.from}T00:00:00.000Z`)) / DAY_MS + 1;
}

const number = (value) => new Intl.NumberFormat().format(value);

export default function StaffScanAnalytics() {
  const initialRange = useMemo(defaultRange, []);
  const [period, setPeriod] = useState(initialRange);
  const [draftPeriod, setDraftPeriod] = useState(initialRange);
  const [periodError, setPeriodError] = useState('');
  const validPeriod = daysInRange(period) >= 1 && daysInRange(period) <= 366;
  const scans = useQuery({
    queryKey: ['staff-scan-analytics', period.from, period.to],
    queryFn: () => staffScanAnalytics({
      from: new Date(`${period.from}T00:00:00.000Z`).toISOString(),
      to: exclusiveEnd(period.to),
    }),
    enabled: validPeriod,
    retry: false,
  });

  function applyPeriod(event) {
    event.preventDefault();
    const days = daysInRange(draftPeriod);
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      setPeriodError('Choose a valid UTC date range of no more than 366 days.');
      return;
    }
    setPeriodError('');
    setPeriod(draftPeriod);
  }

  return (
    <section className="section staff-scan-analytics" aria-labelledby="staff-scan-analytics-heading">
      <header className="staff-scan-analytics-heading">
        <div>
          <span className="eyebrow">Gate operations</span>
          <h2 id="staff-scan-analytics-heading">Scan activity</h2>
          <p className="muted">Counts include recorded attempts in your reporting scope. Reporting days use UTC.</p>
        </div>
      </header>

      <form className="staff-scan-period" onSubmit={applyPeriod}>
        <label htmlFor="staff-scans-from">From
          <input
            id="staff-scans-from"
            type="date"
            value={draftPeriod.from}
            max={draftPeriod.to || undefined}
            onChange={(event) => setDraftPeriod((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label htmlFor="staff-scans-to">To
          <input
            id="staff-scans-to"
            type="date"
            value={draftPeriod.to}
            min={draftPeriod.from || undefined}
            onChange={(event) => setDraftPeriod((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <button type="submit">Apply dates</button>
      </form>
      {periodError && <p role="alert" className="alert danger">{periodError}</p>}

      {scans.isLoading ? (
        <p className="muted" aria-live="polite">Loading scan activity…</p>
      ) : scans.isError ? (
        <div>
          <p role="alert" className="alert danger">{messageFor(scans.error)}</p>
          <button type="button" onClick={() => scans.refetch()}>Retry scan analytics</button>
        </div>
      ) : (
        <>
          <div className="grid-3 staff-scan-metrics">
            <section className="staff-scan-metric" role="group" aria-label="All scan attempts">
              <span className="muted">All scan attempts</span>
              <strong>{number(scans.data.metrics.totalScans)}</strong>
            </section>
            <section className="staff-scan-metric" role="group" aria-label="Admitted scans">
              <span className="muted">Admitted scans</span>
              <strong>{number(scans.data.metrics.accepted)}</strong>
            </section>
            <section className="staff-scan-metric" role="group" aria-label="Rejected scan attempts">
              <span className="muted">Rejected attempts</span>
              <strong>{number(scans.data.metrics.rejected)}</strong>
            </section>
          </div>

          {scans.data.metrics.totalScans === 0 && (
            <p className="muted" role="status">No scan attempts were recorded in this reporting window.</p>
          )}
          <div className="staff-scan-chart" aria-label="Daily scan attempts by result">
            <Suspense fallback={<p className="muted">Preparing scan chart…</p>}>
              <StaffScanTrendChart daily={scans.data.daily} />
            </Suspense>
          </div>

          <div className="staff-scan-totals">
            <h3>Results for this period</h3>
            <ul>
              {scans.data.byResult.map(({ result, count }) => (
                <li key={result}>
                  <span>{RESULTS.find(([key]) => key === result)?.[1] ?? result}</span>
                  <strong>{number(count)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <details className="staff-scan-daily">
            <summary>View daily totals</summary>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">UTC date</th>
                    {RESULTS.map(([, label]) => <th scope="col" key={label}>{label}</th>)}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.data.daily.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{day.day}</th>
                      {RESULTS.map(([result]) => <td key={result}>{number(day.byResult[result])}</td>)}
                      <td>{number(day.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { platformAnalytics } from '../lib/analyticsApi';
import { getHealth } from '../lib/systemApi';
import { messageFor } from '../lib/errors';
import DailyAnalytics from '../components/DailyAnalytics.jsx';
import './AdminOverview.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const number = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function utcDateValue(date) {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod() {
  const today = new Date();
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to.getTime() - 29 * DAY_MS);
  return { from: utcDateValue(from), to: utcDateValue(to) };
}

function exclusiveEnd(date) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + DAY_MS).toISOString();
}

function CountList({ title, entries, emptyText }) {
  const rows = Object.entries(entries ?? {});
  return (
    <section className="section platform-panel">
      <div className="between">
        <h2>{title}</h2>
        {rows.length > 0 && <span className="badge">{number.format(rows.reduce((sum, [, count]) => sum + count, 0))} total</span>}
      </div>
      {rows.length ? (
        <dl className="platform-count-list">
          {rows.map(([name, count]) => (
            <div key={name}>
              <dt>{name.replaceAll('_', ' ')}</dt>
              <dd>{number.format(count)}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="muted">{emptyText}</p>}
    </section>
  );
}

function Metric({ label, value, detail }) {
  return (
    <section className="section platform-metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <span className="muted">{detail}</span>
    </section>
  );
}

export default function AdminOverview() {
  const initialPeriod = defaultPeriod();
  const [period, setPeriod] = useState(initialPeriod);
  const [draftPeriod, setDraftPeriod] = useState(initialPeriod);
  const [periodError, setPeriodError] = useState('');
  const validPeriod = Boolean(period.from && period.to && period.to >= period.from
    && (new Date(`${period.to}T00:00:00.000Z`) - new Date(`${period.from}T00:00:00.000Z`)) < 366 * DAY_MS);
  const summary = useQuery({
    queryKey: ['platform-analytics', period.from, period.to],
    queryFn: () => platformAnalytics({
      from: new Date(`${period.from}T00:00:00.000Z`).toISOString(),
      to: exclusiveEnd(period.to),
    }),
    enabled: validPeriod,
  });
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: getHealth,
    refetchInterval: 30000,
  });

  function applyPeriod(event) {
    event.preventDefault();
    const fromDate = new Date(`${draftPeriod.from}T00:00:00.000Z`);
    const toDate = new Date(`${draftPeriod.to}T00:00:00.000Z`);
    const days = (toDate - fromDate) / DAY_MS + 1;
    if (!draftPeriod.from || !draftPeriod.to || days < 1 || days > 366) {
      setPeriodError('Choose a valid date range of no more than 366 days.');
      return;
    }
    setPeriodError('');
    setPeriod(draftPeriod);
  }

  const data = summary.data;
  const metrics = data?.metrics;
  const healthOk = health.data?.status === 'ok';
  const healthAvailable = health.isSuccess;

  return (
    <div className="page reveal platform-overview">
      <header className="page-hero">
        <span className="eyebrow">Super admin</span>
        <h1>Platform overview</h1>
        <p>Monitor platform activity, revenue, refunds, and service availability.</p>
      </header>

      <form className="section platform-period" onSubmit={applyPeriod}>
        <div>
          <span className="eyebrow">Reporting window</span>
          <p className="muted">Calendar dates are inclusive; analytics use UTC and the end boundary is exclusive.</p>
        </div>
        <label>From
          <input type="date" value={draftPeriod.from} max={draftPeriod.to || undefined}
            onChange={(event) => setDraftPeriod((current) => ({ ...current, from: event.target.value }))} />
        </label>
        <label>To
          <input type="date" value={draftPeriod.to} min={draftPeriod.from || undefined}
            onChange={(event) => setDraftPeriod((current) => ({ ...current, to: event.target.value }))} />
        </label>
        <button className="primary" type="submit">Apply dates</button>
      </form>
      {periodError && <p role="alert" className="alert danger">{periodError}</p>}

      <section className="section platform-health" aria-labelledby="platform-health-heading">
        <div>
          <span className="eyebrow">Operations</span>
          <h2 id="platform-health-heading">System health</h2>
        </div>
        {health.isLoading ? (
          <p className="muted">Checking API, database, and Redis…</p>
        ) : health.isError ? (
          <div>
            <p role="alert" className="alert danger">{messageFor(health.error)}</p>
            <button type="button" onClick={() => health.refetch()}>Retry health check</button>
          </div>
        ) : (
          <>
            <span className={`badge${healthOk ? ' ok' : ' danger'}`}>{healthOk ? 'All services operational' : 'Service degradation reported'}</span>
            <ul className="platform-health-services">
              <li>API <strong>online</strong></li>
              <li>Database <strong>{health.data.db ? 'online' : 'unavailable'}</strong></li>
              <li>Redis <strong>{health.data.redis ? 'online' : 'unavailable'}</strong></li>
            </ul>
          </>
        )}
      </section>

      {healthAvailable && !healthOk && (
        <p role="status" className="alert danger">One or more platform dependencies need attention.</p>
      )}
      {data?.metrics.openRefundRequests > 0 && (
        <p role="status" className="alert">There {data.metrics.openRefundRequests === 1 ? 'is' : 'are'} {number.format(data.metrics.openRefundRequests)} refund request{data.metrics.openRefundRequests === 1 ? '' : 's'} awaiting review.</p>
      )}

      {summary.isLoading ? (
        <div className="section" aria-live="polite"><p className="muted">Loading platform metrics…</p></div>
      ) : summary.isError ? (
        <div className="section">
          <p role="alert" className="alert danger">{messageFor(summary.error)}</p>
          <button type="button" onClick={() => summary.refetch()}>Retry platform metrics</button>
        </div>
      ) : !data ? (
        <div className="section"><p role="alert" className="muted">Platform metrics are unavailable.</p></div>
      ) : (
        <>
          <div className="grid-3 platform-metrics">
            <Metric label="Tickets sold" value={number.format(metrics.ticketsSold)} detail="Issued or used during this window" />
            <Metric label="Net revenue" value={money.format(metrics.netRevenueCents / 100)} detail={`${money.format(metrics.grossRevenueCents / 100)} gross less ${money.format(metrics.refundedAmountCents / 100)} refunded`} />
            <Metric label="Attendance" value={number.format(metrics.attendance)} detail="Unique accepted ticket scans in this window" />
          </div>
          <div className="grid-2 platform-counts">
            <CountList title="Users by role" entries={data.usersByRole} emptyText="No user accounts have been created." />
            <CountList title="Events by status" entries={data.eventsByStatus} emptyText="No events have been created." />
          </div>
          <section className="section platform-trends">
            <div>
              <span className="eyebrow">Platform activity</span>
              <h2>Daily trends</h2>
              <p className="muted">UTC daily totals for the selected reporting window.</p>
            </div>
            {data.daily.length === 0
              ? <p className="muted">No daily data was returned for this reporting window.</p>
              : <DailyAnalytics daily={data.daily} showCategories={false} />}
          </section>
          <section className="section platform-refunds">
            <div>
              <span className="eyebrow">Refund operations</span>
              <h2>{number.format(metrics.openRefundRequests)} open request{metrics.openRefundRequests === 1 ? '' : 's'}</h2>
              <p className="muted">{money.format(metrics.refundedAmountCents / 100)} completed refunds in the selected reporting window.</p>
            </div>
            <Link className="btn ghost" to="/organizer#events">Review event operations</Link>
          </section>
          {metrics.ticketsSold === 0 && metrics.grossRevenueCents === 0
            && metrics.refundedAmountCents === 0 && metrics.attendance === 0 && (
              <p className="muted">No ticket sales, refunds, or attendance were recorded in this reporting window.</p>
            )}
        </>
      )}
    </div>
  );
}

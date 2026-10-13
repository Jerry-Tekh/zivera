import { lazy, Suspense } from 'react';
import './EventPerformanceChart.css';

const EventPerformancePlot = lazy(() => import('./AnalyticsCharts.jsx')
  .then((module) => ({ default: module.EventPerformancePlot })));

export default function EventPerformanceChart({ events }) {
  const chartDataCount = Math.min(events.length, 8);

  return (
    <figure className="section event-performance-chart" aria-labelledby="event-performance-chart-title">
      <figcaption>
        <span className="eyebrow">Event comparison</span>
        <strong id="event-performance-chart-title">Revenue performance</strong>
        <span className="muted">Top {chartDataCount} events on this page by gross sales. Filters and reporting dates above apply.</span>
      </figcaption>
      <div className="event-performance-chart-plot" role="group" aria-label="Gross sales, refunds, and net revenue by event">
        <Suspense fallback={<div className="chart-loading" aria-live="polite">Loading chart…</div>}>
          <EventPerformancePlot events={events} />
        </Suspense>
      </div>
    </figure>
  );
}

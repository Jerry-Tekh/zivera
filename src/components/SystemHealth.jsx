import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../lib/systemApi';

const STATUS_LABELS = {
  checking: 'Checking system',
  healthy: 'System online',
  degraded: 'System degraded',
  unavailable: 'Health check unavailable',
};

export default function SystemHealth() {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: getHealth,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 15000,
  });
  const status = health.isLoading
    ? 'checking'
    : health.isError
      ? 'unavailable'
      : health.data?.status === 'ok'
        ? 'healthy'
        : health.data?.status === 'degraded'
          ? 'degraded'
          : 'unavailable';
  const descriptions = {
    checking: 'Checking service availability.',
    healthy: 'The service is responding normally.',
    degraded: 'The service is responding with a dependency degraded.',
    unavailable: 'A health response could not be confirmed.',
  };

  return (
    <div className="dashboard-health">
      <span className="health-pill" data-status={status} role="status" aria-live="polite" title={descriptions[status]}>
        <span className={`health-dot${status === 'healthy' ? ' ok' : status === 'degraded' ? ' degraded' : status === 'unavailable' ? ' unavailable' : ''}`} aria-hidden="true" />
        <span>{STATUS_LABELS[status]}</span>
      </span>
      {status === 'unavailable' && (
        <button className="ghost health-retry" type="button" onClick={() => health.refetch()}>
          Retry
        </button>
      )}
    </div>
  );
}

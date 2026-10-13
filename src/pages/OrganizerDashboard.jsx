import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAllEvents, createEvent } from '../lib/organizerApi';
import { messageFor } from '../lib/errors';
import { EVENT_STATUSES, fromDateTimeLocal, optionalText } from '../lib/eventForms';
import Pagination from '../components/Pagination.jsx';

export default function OrganizerDashboard() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [status, setStatus] = useState('draft');
  const [err, setErr] = useState(null);

  const pageSize = 20;
  const eventsQuery = useQuery({
    queryKey: ['admin-events', page, search, filterStatus],
    queryFn: () => listAllEvents({ page, pageSize, search, status: filterStatus }),
  });
  const { data: result, isLoading, isError, error } = eventsQuery;
  const events = result?.rows ?? [];
  const create = useMutation({
    mutationFn: () => createEvent({
      title,
      description: optionalText(description),
      location: optionalText(location),
      startsAt: fromDateTimeLocal(startsAt),
      status,
    }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setLocation('');
      setStartsAt('');
      setStatus('draft');
      setPage(1);
      qc.invalidateQueries({ queryKey: ['admin-events'] });
    },
    onError: (e) => setErr(messageFor(e)),
  });

  return (
    <div className="page reveal">
      <header className="page-hero">
        <span className="eyebrow">Organizer</span>
        <h1>Overview</h1>
        <p>Keep track of your events and manage what is coming up.</p>
      </header>

      {isError && (
        <div>
          <p role="alert" className="alert danger">{messageFor(error)}</p>
          <button type="button" onClick={() => eventsQuery.refetch()}>Retry loading events</button>
        </div>
      )}

      <div className="grid-3">
        <div className="section">
          <span className="eyebrow">Events</span>
          <h2 style={{ marginTop: 8 }}>{isLoading || isError ? '—' : Object.values(result?.statusCounts ?? {}).reduce((sum, count) => sum + count, 0)}</h2>
          <p className="muted">Total managed</p>
        </div>
        <div className="section">
          <span className="eyebrow">Published</span>
          <h2 style={{ marginTop: 8 }}>{isLoading || isError ? '—' : result?.statusCounts?.published ?? 0}</h2>
          <p className="muted">Visible to buyers</p>
        </div>
        <div className="section">
          <span className="eyebrow">Drafts</span>
          <h2 style={{ marginTop: 8 }}>{isLoading || isError ? '—' : result?.statusCounts?.draft ?? 0}</h2>
          <p className="muted">Awaiting publish</p>
        </div>
      </div>

      <details className="organizer-create">
        <summary>
          <span>
            <span className="eyebrow">Quick action</span>
            <strong>Create an event</strong>
          </span>
          <span className="organizer-create-toggle" aria-hidden="true">+</span>
        </summary>
        <form onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
          className="section form-grid">
          <label style={{ flex: '1 1 240px' }}>Event title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue or city" /></label>
          <label>Starts at<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label>
          <button className="primary" type="submit" disabled={!title || create.isPending}>{create.isPending ? 'Creating…' : 'Create event'}</button>
        </form>
      </details>
      {err && <p className="alert danger">{err}</p>}

      <section className="section" id="events">
      <div className="between">
        <div>
          <span className="eyebrow">Inventory</span>
          <h2 style={{ marginTop: 6 }}>All events</h2>
        </div>
      </div>
      <form
        className="row"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        style={{ marginTop: 16 }}
      >
        <label>Search events<input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></label>
        <label>Status
          <select value={filterStatus} onChange={(e) => { setPage(1); setFilterStatus(e.target.value); }}>
            <option value="">All statuses</option>
            {EVENT_STATUSES.map((eventStatus) => <option key={eventStatus} value={eventStatus}>{eventStatus}</option>)}
          </select>
        </label>
        <button type="submit">Search</button>
        {(search || filterStatus) && (
          <button type="button" onClick={() => { setPage(1); setSearchInput(''); setSearch(''); setFilterStatus(''); }}>
            Clear filters
          </button>
        )}
      </form>
      {isLoading ? <p className="muted">Loading events…</p> : isError ? null : !events?.length ? (
        <p className="muted" style={{ marginTop: 16 }}>{search || filterStatus ? 'No events match these filters.' : 'No events yet. Create an event to get started.'}</p>
      ) : (
        <ul className="data-list" style={{ marginTop: 16 }}>
          {(events ?? []).map((ev) => (
            <li key={ev.id} className="data-row">
              <span>
                <strong>{ev.title}</strong>
                <span className={`badge${ev.status === 'published' ? ' ok' : ''}`} style={{ marginLeft: 10 }}>{ev.status}</span>
              </span>
              <Link to={`/organizer/events/${ev.id}`} className="btn ghost">Manage</Link>
            </li>
          ))}
        </ul>
      )}
      {!isLoading && !isError && result && (
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          totalPages={result.totalPages}
          onPageChange={setPage}
        />
      )}
      </section>
    </div>
  );
}

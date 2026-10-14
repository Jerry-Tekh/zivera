import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api';
import { heroFor } from '../lib/images';

const PAGE = 8;
const VENUES = [
  { name: 'The Silicon Hub', events: 12, image: '/images/events/m-accelerator-yTsy3PYFPtc-unsplash.jpg' },
  { name: 'Civic Hall', events: 9, image: '/images/events/antenna-ohNCIiKVT1g-unsplash.jpg' },
  { name: 'North Pier Arena', events: 7, image: '/images/events/nicholas-green-nPz8akkUmDI-unsplash.jpg' },
  { name: 'Glasshouse Live', events: 6, image: '/images/events/priscilla-du-preez-Q7wGvnbuwj0-unsplash.jpg' },
];
const TRUST_ITEMS = [
  {
    title: 'Secure Checkout',
    copy: 'Encryption-backed transactions for peace of mind.',
    icon: 'lock',
  },
  {
    title: 'Instant Delivery',
    copy: 'Digital QR tickets delivered to your wallet immediately.',
    icon: 'ticket',
  },
  {
    title: 'Verified Organizers',
    copy: 'High-trust vetting for every event on the platform.',
    icon: 'shield',
  },
];
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date TBA');
const fmtFullDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA');

function TrustIcon({ type }) {
  if (type === 'ticket') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.75 8.75a2 2 0 0 1 2-2h10.5a2 2 0 0 1 2 2v1.45a2.05 2.05 0 0 0 0 3.6v1.45a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V13.8a2.05 2.05 0 0 0 0-3.6V8.75Z" />
        <path d="M9.25 8.25v7.5" />
      </svg>
    );
  }
  if (type === 'shield') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.75 18.25 7v4.85c0 3.9-2.5 6.25-6.25 7.4-3.75-1.15-6.25-3.5-6.25-7.4V7L12 4.75Z" />
        <path d="m9.5 12.25 1.65 1.65 3.35-3.65" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.75 10.5V8.75a4.25 4.25 0 0 1 8.5 0v1.75" />
      <path d="M6.75 10.5h10.5a1.5 1.5 0 0 1 1.5 1.5v5.25a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M12 14v1.5" />
    </svg>
  );
}

export default function Browse() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('date');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['events'],
    queryFn: ({ pageParam }) => apiGet(`/events?page=${pageParam}&pageSize=${PAGE}`),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length + 1 : undefined),
  });

  const events = useMemo(() => {
    const all = (data?.pages ?? []).flat();
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? all.filter((e) => `${e.title} ${e.location ?? ''}`.toLowerCase().includes(needle))
      : all;
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.title.localeCompare(b.title);
      return (a.starts_at || '9999').localeCompare(b.starts_at || '9999'); // date asc, undated last
    });
  }, [data, q, sort]);

  const allEvents = useMemo(() => (data?.pages ?? []).flat(), [data]);
  const featuredEvents = useMemo(() => {
    return [...allEvents]
      .sort((a, b) => (a.starts_at || '9999').localeCompare(b.starts_at || '9999'))
      .slice(0, 4);
  }, [allEvents]);
  const hasEvents = events.length > 0;
  const hasFeatured = featuredEvents.length > 0;

  function submitNewsletter(e) {
    e.preventDefault();
    setNewsletterSubmitted(true);
  }

  return (
    <div className="page browse-page">
      <header className="browse-hero reveal">
        <div className="browse-hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">Live events, all in one place</span>
            <h1>Find something worth going to.</h1>
            <p>
              Browse concerts, festivals, and events. Book your tickets in a few simple steps.
            </p>
            <form className="browse-search" role="search" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="event-search">Search events</label>
              <div className={`hero-search-row${q ? ' has-clear' : ''}`}>
                <input
                  id="event-search"
                  aria-label="Search events"
                  placeholder="Event name or venue"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" className="ghost" onClick={() => setQ('')}>
                    Clear
                  </button>
                )}
                <button type="submit" className="primary">Search</button>
              </div>
            </form>
            <p className="hero-search-hint">Search by event name or venue.</p>
          </div>
          <div className="hero-visual">
            <img src="/images/events/nicholas-green-nPz8akkUmDI-unsplash.jpg" alt="Audience at a live event" />
          </div>
        </div>
      </header>

      <section className="browse-section reveal" aria-labelledby="featured-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Coming up</span>
            <h2 id="featured-heading">Upcoming events</h2>
          </div>
          <span className="muted">A selection of events happening soon.</span>
        </div>

        {error ? (
          <div className="empty-state compact">
            <span className="eyebrow">Events unavailable</span>
            <h3>Featured events could not load.</h3>
            <p>Check the API connection and try again.</p>
          </div>
        ) : !isLoading && !hasFeatured ? (
          <div className="empty-state compact">
            <span className="eyebrow">No featured events</span>
            <h3>No published events yet.</h3>
            <p>Published events from the backend will appear here automatically.</p>
          </div>
        ) : (
          <div className="featured-scroller">
            {isLoading && [0, 1, 2].map((item) => <div key={item} className="featured-card skeleton-card" />)}
            {!isLoading && featuredEvents.map((ev) => (
              <Link key={ev.id} to={`/events/${ev.id}`} className="featured-card">
                <img src={heroFor(ev.id)} alt="" />
                <div className="featured-overlay" />
                <div className="featured-content">
                  <span className="badge highlight">Upcoming</span>
                  <div>
                    <h3>{ev.title}</h3>
                    <p>{fmtFullDate(ev.starts_at)}{ev.location ? ` · ${ev.location}` : ''}</p>
                  </div>
                  <span className="btn primary">View Event</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="browse-section reveal" aria-labelledby="events-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Browse events</span>
            <h2 id="events-heading">Explore all events</h2>
          </div>
          <label className="sort-control">Sort
            <select aria-label="Sort events" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date">Soonest first</option>
              <option value="name">A-Z</option>
            </select>
          </label>
        </div>

      {isLoading && <p className="muted">Loading events…</p>}
      {error && <p className="muted">Could not load events.</p>}

      {!isLoading && !error && !hasEvents ? (
        <div className="empty-state">
          <span className="eyebrow">No events available</span>
          <h3>{q ? `No events match "${q}".` : 'No published events yet.'}</h3>
          <p>{q ? 'Try another search term.' : 'Create or publish events in the organizer dashboard to make them available for buyers.'}</p>
        </div>
      ) : (
        <div className="event-grid">
          {events.map((ev, i) => (
            <Link
              key={ev.id}
              to={`/events/${ev.id}`}
              className="event-card reveal"
              style={{ animationDelay: `${(i % PAGE) * 70}ms` }}
            >
              <div className="event-card-media">
                <img src={heroFor(ev.id)} alt="" />
                <span className="date-chip">{fmtDate(ev.starts_at)}</span>
              </div>
              <div className="event-card-body">
                <h2 className="event-card-title">{ev.title}</h2>
                <p className="event-meta">{fmtFullDate(ev.starts_at)}{ev.location ? ` · ${ev.location}` : ''}</p>
                <div className="between" style={{ marginTop: 4 }}>
                  <span className="badge ok">On sale</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>Get tickets</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasNextPage && !q && (
        <div className="load-more-row">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more events'}
          </button>
        </div>
      )}
      </section>

      <section className="trust-bar reveal" aria-label="How Zireva works">
        {TRUST_ITEMS.map((item) => (
          <article key={item.title} className="trust-card">
            <span className="trust-icon"><TrustIcon type={item.icon} /></span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="newsletter-cta reveal" aria-labelledby="newsletter-heading">
        <div>
          <span className="eyebrow">Early access</span>
          <h2 id="newsletter-heading">Join the Inner Circle.</h2>
          <p>Get notified about presales and exclusive drops.</p>
        </div>
        <form className="newsletter-form" onSubmit={submitNewsletter}>
          <input
            aria-label="Email for presale notifications"
            type="email"
            placeholder="you@example.com"
            value={newsletterEmail}
            onChange={(e) => {
              setNewsletterEmail(e.target.value);
              setNewsletterSubmitted(false);
            }}
            required
          />
          <button type="submit" className="primary">Notify Me</button>
          {newsletterSubmitted && <p className="newsletter-note">You are on the early access list.</p>}
        </form>
      </section>

      <section className="browse-section reveal" aria-labelledby="venues-heading">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Social proof</span>
            <h2 id="venues-heading">Top venues this week</h2>
          </div>
          <span className="muted">Trending rooms with strong demand.</span>
        </div>
        <div className="venue-grid">
          {VENUES.map((venue) => (
            <article key={venue.name} className="venue-card">
              <img src={venue.image} alt="" />
              <div>
                <h3>{venue.name}</h3>
                <p>{venue.events} Events</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

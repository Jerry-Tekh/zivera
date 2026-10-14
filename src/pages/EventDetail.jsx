import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { heroFor } from '../lib/images';
import Checkout from '../features/checkout/Checkout.jsx';

const money = (c) => `$${(c / 100).toFixed(2)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA');

export default function EventDetail() {
  const { id } = useParams();
  const [activeCat, setActiveCat] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['event', id], queryFn: () => apiGet(`/events/${id}`) });
  if (isLoading || !data) return <p className="muted">Loading…</p>;

  return (
    <div className="page">
      <Link to="/" className="eyebrow" style={{ color: 'var(--muted)' }}>All events</Link>

      <section className="hero-media reveal">
        <img src={heroFor(data.id)} alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge ok" style={{ marginBottom: 14 }}>Live event</span>
          <h1>{data.title}</h1>
          <span className="mono" style={{ display: 'block', marginTop: 12, color: 'rgba(255, 255, 255, 0.84)', fontSize: '0.92rem' }}>
            {fmtDate(data.starts_at)}{data.location ? ` · ${data.location}` : ''}
          </span>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="section reveal" style={{ animationDelay: '80ms' }}>
          <span className="eyebrow">About</span>
          <p style={{ marginTop: 14, color: 'var(--muted)', fontSize: '1.02rem' }}>
            {data.description || 'An unmissable live event. Choose your ticket tier and check out in seconds — your QR ticket is issued instantly.'}
          </p>
        </section>

        <section className="panel reveal" style={{ padding: 22, animationDelay: '140ms' }}>
          <div className="between">
            <div>
              <span className="eyebrow">Tickets</span>
              <h2 style={{ marginTop: 6 }}>Choose access</h2>
            </div>
            <span className="badge">Secure checkout</span>
          </div>
          <div className="data-list" style={{ marginTop: 18 }}>
            {data.categories.map((cat) => {
              const soldOut = cat.available_quantity <= 0;
              return (
                <div key={cat.id} className="data-row">
                  <div>
                    <h3>{cat.name}</h3>
                    <p className="muted" style={{ marginTop: 4 }}>{soldOut ? 'Sold out' : `${cat.available_quantity} remaining`}</p>
                  </div>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <span className="mono" style={{ fontWeight: 800 }}>{money(cat.price_cents)}</span>
                    <button className="primary" disabled={soldOut} onClick={() => setActiveCat(cat)}>
                      {soldOut ? 'Sold out' : 'Get tickets'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {activeCat && <Checkout event={data} category={activeCat} onClose={() => setActiveCat(null)} />}
    </div>
  );
}

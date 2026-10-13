import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { heroFor } from '../lib/images';
import { listMyRefundRequests, requestRefund } from '../lib/refundApi';
import { messageFor } from '../lib/errors';
import QrCode from '../components/QrCode.jsx';

const money = (c) => `$${(c / 100).toFixed(2)}`;

export default function MyTickets() {
  const qc = useQueryClient();
  const [reasonByOrder, setReasonByOrder] = useState({});
  const [err, setErr] = useState(null);
  const ordersQuery = useQuery({ queryKey: ['my-orders'], queryFn: () => apiGet('/orders') });
  const { data } = ordersQuery;
  const refundRequests = useQuery({ queryKey: ['my-refund-requests'], queryFn: listMyRefundRequests });
  const refundByOrder = useMemo(() => {
    const map = new Map();
    for (const req of refundRequests.data ?? []) {
      if (!map.has(req.order_id)) map.set(req.order_id, req);
    }
    return map;
  }, [refundRequests.data]);
  const request = useMutation({
    mutationFn: ({ orderId, reason }) => requestRefund(orderId, reason),
    onSuccess: () => {
      setErr(null);
      setReasonByOrder({});
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['my-refund-requests'] });
    },
    onError: (e) => setErr(messageFor(e)),
  });

  if (ordersQuery.isLoading) return <p className="muted">Loading your tickets…</p>;
  if (ordersQuery.isError) {
    return (
      <div className="page">
        <p role="alert" className="alert danger">{messageFor(ordersQuery.error)}</p>
        <button type="button" onClick={() => ordersQuery.refetch()}>Retry loading tickets</button>
      </div>
    );
  }
  if (!data.length) {
    return (
      <div className="panel reveal" style={{ padding: '54px 24px', textAlign: 'center' }}>
        <span className="eyebrow">Your tickets</span>
        <h1 style={{ marginTop: 12 }}>Nothing here yet.</h1>
        <p className="muted" style={{ marginTop: 10 }}>No tickets yet — browse events to grab some, and your QR tickets will live here.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-hero">
        <span className="eyebrow">Your tickets</span>
        <h1>Wallet</h1>
        <p>Every paid order is kept here with QR tickets and refund request status.</p>
      </header>
      {err && <p className="alert danger">{err}</p>}
      {refundRequests.isLoading && <p className="muted">Loading refund request statuses…</p>}
      {refundRequests.isError && (
        <div>
          <p role="alert" className="alert danger">{messageFor(refundRequests.error)}</p>
          <button type="button" onClick={() => refundRequests.refetch()}>Retry refund statuses</button>
        </div>
      )}

      {data.map((o, i) => (
        <section key={o.id} className="ticket-card card reveal" style={{ animationDelay: `${i * 70}ms` }}>
          <div>
          <div className="ticket-media" style={{ backgroundImage: `linear-gradient(90deg, rgba(46,27,64,.78), rgba(66,39,87,.3)), url(${heroFor(o.event_id)})` }}>
            <div style={{ padding: 22, color: '#fff' }}>
              <span className={`badge${o.status === 'paid' ? ' ok' : o.status === 'refunded' ? ' warn' : ''}`}>{o.status}</span>
              <h2 style={{ color: '#fff', marginTop: 14 }}>{o.event_title}</h2>
              <p className="mono" style={{ marginTop: 8, color: 'rgba(255, 255, 255, 0.84)', fontSize: '0.78rem' }}>
                {o.category_name} · {o.quantity} ticket{o.quantity === 1 ? '' : 's'} · {money(o.amount_cents)}
                {o.event_starts_at ? ` · ${new Date(o.event_starts_at).toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>
          <div className="row" style={{ padding: 18 }}>
            {(o.tickets ?? []).map((t) => (
              <div key={t.id} className="qr-box"><QrCode value={t.qr_token} /></div>
            ))}
          </div>
          </div>
          <div style={{ padding: 18, borderLeft: '1px solid var(--border)', minWidth: 300 }}>
            {refundByOrder.get(o.id) ? (
              <p className="mono muted" style={{ fontSize: '0.78rem' }}>
                Refund request: <span className="badge">{refundByOrder.get(o.id).status}</span>
              </p>
            ) : refundRequests.isLoading ? (
              <p className="muted">Checking refund status…</p>
            ) : refundRequests.isError ? (
              <p className="muted">Refund requests are unavailable; retry before submitting a request.</p>
            ) : o.status === 'paid' ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                request.mutate({ orderId: o.id, reason: reasonByOrder[o.id] ?? '' });
              }} className="stack">
                <label>Refund reason
                  <textarea
                    value={reasonByOrder[o.id] ?? ''}
                    onChange={(e) => setReasonByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    rows={2}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={request.isPending || !(reasonByOrder[o.id] ?? '').trim()}
                >
                  {request.isPending && request.variables?.orderId === o.id ? 'Requesting…' : 'Request refund'}
                </button>
              </form>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

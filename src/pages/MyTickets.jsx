import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { heroFor } from '../lib/images';
import { listMyRefundRequests, requestRefund } from '../lib/refundApi';
import { messageFor } from '../lib/errors';
import QrCode from '../components/QrCode.jsx';

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const dateTime = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

function bucketForOrder(order, now) {
  const status = order.status?.toLowerCase();
  if (['refunded', 'cancelled', 'canceled'].includes(status)
    || (order.tickets?.length > 0 && order.tickets.every((ticket) => ticket.status === 'revoked'))) {
    return 'closed';
  }

  const startsAt = Date.parse(order.event_starts_at);
  return status === 'paid' && Number.isFinite(startsAt) && startsAt > now
    ? 'upcoming'
    : 'past';
}

const walletGroups = [
  { id: 'upcoming', title: 'Upcoming' },
  { id: 'past', title: 'Past' },
  { id: 'closed', title: 'Refunded / cancelled' },
];

export default function MyTickets() {
  const qc = useQueryClient();
  const [reasonByOrder, setReasonByOrder] = useState({});
  const [err, setErr] = useState(null);
  const ordersQuery = useQuery({ queryKey: ['my-orders'], queryFn: () => apiGet('/orders') });
  const orders = ordersQuery.data ?? [];
  const refundRequests = useQuery({ queryKey: ['my-refund-requests'], queryFn: listMyRefundRequests });
  const refundsByOrder = useMemo(() => {
    const map = new Map();
    for (const refund of refundRequests.data ?? []) {
      const entries = map.get(refund.order_id) ?? [];
      entries.push(refund);
      map.set(refund.order_id, entries);
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
  if (!orders.length) {
    return (
      <div className="panel reveal" style={{ padding: '54px 24px', textAlign: 'center' }}>
        <span className="eyebrow">Your tickets</span>
        <h1 style={{ marginTop: 12 }}>Nothing here yet.</h1>
        <p className="muted" style={{ marginTop: 10 }}>No tickets yet — browse events to grab some, and your QR tickets will live here.</p>
      </div>
    );
  }

  const groupedOrders = Object.fromEntries(walletGroups.map(({ id }) => [id, []]));
  for (const order of orders) groupedOrders[bucketForOrder(order, Date.now())].push(order);

  return (
    <div className="page">
      <header className="page-hero">
        <span className="eyebrow">Your tickets</span>
        <h1>Wallet</h1>
        <p>Your next events, ticket entry status, and complete refund history in one place. Event times use your local timezone.</p>
      </header>
      {err && <p role="alert" className="alert danger">{err}</p>}
      {refundRequests.isLoading && <p className="muted">Loading refund request history…</p>}
      {refundRequests.isError && (
        <div>
          <p role="alert" className="alert danger">{messageFor(refundRequests.error)}</p>
          <button type="button" onClick={() => refundRequests.refetch()}>Retry refund statuses</button>
        </div>
      )}

      {walletGroups.map(({ id, title }) => (
        <section className="wallet-group" key={id} aria-labelledby={`wallet-${id}`}>
          <header className="wallet-group-heading">
            <h2 id={`wallet-${id}`}>{title}</h2>
            <span className="muted">{groupedOrders[id].length} order{groupedOrders[id].length === 1 ? '' : 's'}</span>
          </header>
          {groupedOrders[id].length ? groupedOrders[id].map((order, index) => {
            const orderRefunds = refundsByOrder.get(order.id) ?? [];
            const pendingRefund = orderRefunds.some((refund) => refund.status === 'pending');
            const isSubmitting = request.isPending && request.variables?.orderId === order.id;
            const eligibleForRefund = order.status === 'paid'
              && !pendingRefund
              && !refundRequests.isLoading
              && !refundRequests.isError;

            return (
              <article
                key={order.id}
                className="ticket-card card reveal"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div>
                  <div
                    className="ticket-media"
                    style={{ backgroundImage: `linear-gradient(90deg, rgba(46,27,64,.78), rgba(66,39,87,.3)), url(${heroFor(order.event_id)})` }}
                  >
                    <div style={{ padding: 22, color: '#fff' }}>
                      <span className={`badge${order.status === 'paid' ? ' ok' : order.status === 'refunded' ? ' warn' : ''}`}>
                        Order: {order.status}
                      </span>
                      <h3 style={{ color: '#fff', marginTop: 14 }}>{order.event_title}</h3>
                      <p className="mono" style={{ marginTop: 8, color: 'rgba(255, 255, 255, 0.84)', fontSize: '0.78rem' }}>
                        {order.category_name} · {order.quantity} ticket{order.quantity === 1 ? '' : 's'} · {money(order.amount_cents)}
                        {order.event_starts_at ? ` · ${dateTime(order.event_starts_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="wallet-ticket-list">
                    {(order.tickets ?? []).length ? order.tickets.map((ticket) => (
                      <div key={ticket.id} className="wallet-ticket">
                        <span className="mono">Ticket</span>
                        <span className={`badge${ticket.status === 'issued' ? ' ok' : ticket.status === 'revoked' ? ' warn' : ''}`}>
                          {ticket.status}
                        </span>
                        {ticket.status === 'issued' && (
                          <div className="qr-box"><QrCode value={ticket.qr_token} /></div>
                        )}
                      </div>
                    )) : <p className="muted">No ticket records are available for this order.</p>}
                  </div>
                </div>

                <div className="wallet-order-details">
                  <h4>Refund history</h4>
                  {refundRequests.isError ? (
                    <p className="muted">Refund history is unavailable. Retry before submitting a request.</p>
                  ) : orderRefunds.length ? (
                    <ol className="wallet-refund-history">
                      {orderRefunds.map((refund) => (
                        <li key={refund.id}>
                          <p>
                            <span className="badge">{refund.status}</span>
                            <span className="muted"> · Submitted {dateTime(refund.created_at)}</span>
                          </p>
                          {refund.reviewer_note && <p className="muted">Reviewer note: {refund.reviewer_note}</p>}
                          {refund.reviewed_at && <p className="muted">Reviewed {dateTime(refund.reviewed_at)}</p>}
                          {refund.order_status && <p className="muted">Order status: {refund.order_status}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : refundRequests.isLoading ? (
                    <p className="muted">Checking refund history…</p>
                  ) : <p className="muted">No refund requests for this order.</p>}

                  {pendingRefund ? (
                    <p className="wallet-refund-pending">A refund request is awaiting review.</p>
                  ) : eligibleForRefund ? (
                    <form onSubmit={(event) => {
                      event.preventDefault();
                      request.mutate({ orderId: order.id, reason: reasonByOrder[order.id] ?? '' });
                    }} className="stack">
                      <label htmlFor={`refund-reason-${order.id}`}>Request a refund
                        <textarea
                          id={`refund-reason-${order.id}`}
                          value={reasonByOrder[order.id] ?? ''}
                          onChange={(event) => setReasonByOrder((previous) => ({
                            ...previous,
                            [order.id]: event.target.value,
                          }))}
                          rows={2}
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={isSubmitting || !(reasonByOrder[order.id] ?? '').trim()}
                      >
                        {isSubmitting ? 'Requesting…' : 'Request refund'}
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          }) : (
            <p className="muted wallet-group-empty">
              {id === 'upcoming' ? 'No upcoming events yet.' : id === 'past' ? 'Past events will appear here.' : 'Refunded or cancelled orders will appear here.'}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

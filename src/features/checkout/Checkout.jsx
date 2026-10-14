import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';
import { cancelReservation, getReservation } from '../../lib/reservationApi';
import { messageFor } from '../../lib/errors';
import Countdown from '../../components/Countdown.jsx';

const money = (c) => `$${(c / 100).toFixed(2)}`;

export default function Checkout({ category, onClose }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [qty, setQty] = useState(1);
  const [reservation, setReservation] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [err, setErr] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const maxQty = useMemo(
    () => Math.max(1, Math.min(category.max_per_customer ?? 10, category.available_quantity ?? 1)),
    [category],
  );
  const total = qty * category.price_cents;

  // Escape to close, focus the dialog, and lock background scroll while open.
  const dialogRef = useRef(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  async function reserve() {
    setErr(null);
    try {
      const r = await apiPost('/reservations',
        { categoryId: category.id, quantity: qty, holder: { kind: 'guest', email } }, { idempotency: true });
      setReservation(r.reservation);
    } catch (e) { setErr(messageFor(e)); }
  }

  async function pay() {
    setErr(null);
    try {
      const r = await apiPost('/orders', { reservationId: liveReservation.id }, { idempotency: true });
      setOrderId(r.order.id);
    } catch (e) { setErr(messageFor(e)); }
  }

  async function cancelHold() {
    if (!reservation?.id) return;
    setErr(null);
    setCancelling(true);
    try {
      await cancelReservation(reservation.id);
      setReservation(null);
      setOrderId(null);
    } catch (e) {
      setErr(messageFor(e));
    } finally {
      setCancelling(false);
    }
  }

  const reservationQuery = useQuery({
    queryKey: ['reservation', reservation?.id],
    queryFn: () => getReservation(reservation.id),
    enabled: !!reservation?.id && !orderId,
    refetchInterval: (q) => (['held', 'paying'].includes(q.state.data?.status) ? 1500 : false),
  });
  const liveReservation = reservationQuery.data ?? reservation;
  const canPay = liveReservation?.status === 'held';

  const poll = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiGet(`/orders/${orderId}`),
    enabled: !!orderId,
    refetchInterval: (q) => (['paid', 'failed', 'refunded'].includes(q.state.data?.status) ? false : 1500),
  });
  const paid = poll.data?.status === 'paid';
  const failed = poll.data?.status === 'failed';
  const refunded = poll.data?.status === 'refunded';
  useEffect(() => { if (paid && orderId) navigate(`/orders/${orderId}`); }, [paid, orderId, navigate]);

  const step = (d) => setQty((q) => Math.min(maxQty, Math.max(1, q + d)));

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(46, 27, 64, 0.52)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Checkout — ${category.name}`} className="panel reveal" style={{ width: 'min(480px, 100%)', padding: 28, outline: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <span className="eyebrow">Checkout</span>
            <h2 style={{ marginTop: 8 }}>{category.name}</h2>
            <span className="mono muted" style={{ fontSize: '0.86rem' }}>{money(category.price_cents)} each</span>
          </div>
          <button className="ghost" onClick={onClose} aria-label="Close" style={{ padding: '7px 11px' }}>Close</button>
        </div>

        <hr className="rule" style={{ margin: '20px 0' }} />
        {err && <p className="alert danger" style={{ marginBottom: 14 }}>{err}</p>}

        {!reservation && (
          <div className="stack">
            <div>
              <label>Quantity</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                <button type="button" aria-label="Decrease quantity" onClick={() => step(-1)} disabled={qty <= 1} style={{ width: 42, padding: '8px 0', fontSize: '1.1rem' }}>-</button>
                <span className="mono" style={{ fontSize: '1.3rem', minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{qty}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => step(1)} disabled={qty >= maxQty} style={{ width: 42, padding: '8px 0', fontSize: '1.1rem' }}>+</button>
                <span className="mono muted" style={{ fontSize: '0.74rem' }}>max {maxQty}</span>
              </div>
            </div>
            <label>Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
            </label>

            <div className="between" style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <span className="mono muted" style={{ fontSize: '0.82rem' }}>{qty} × {money(category.price_cents)}</span>
              <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{money(total)}</span>
            </div>

            <button className="primary" disabled={!email} onClick={reserve}>Reserve</button>
          </div>
        )}

        {reservation && !orderId && (
          <div className="stack">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="mono muted" style={{ fontSize: '0.82rem' }}>
                {qty} ticket{qty === 1 ? '' : 's'} · {liveReservation.status}
              </span>
              <span className="mono" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{money(total)}</span>
            </div>
            {canPay ? (
              <p className="alert" style={{ fontSize: '0.9rem' }}>
                Hold expires in <span className="mono"><Countdown deadline={liveReservation.expires_at} onExpire={() => { setReservation(null); setErr('Your hold expired. Please start again.'); }} /></span>
              </p>
            ) : (
              <p className="muted" style={{ fontSize: '0.9rem' }}>This hold is no longer payable. Start again to reserve fresh tickets.</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="primary" onClick={pay} disabled={!canPay}>Pay {money(total)}</button>
              <button className="ghost" onClick={cancelHold} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel hold'}</button>
            </div>
          </div>
        )}

        {orderId && (
          <p className={`alert ${paid ? 'ok' : ''}`} style={{ fontSize: '0.92rem' }}>
            {paid && 'Paid — redirecting…'}
            {failed && 'Payment failed — no tickets were issued.'}
            {refunded && 'This order has been refunded.'}
            {!paid && !failed && !refunded && 'Finalizing your order…'}
          </p>
        )}
        {failed && <button onClick={() => { setOrderId(null); setReservation(null); }}>Start again</button>}
      </div>
    </div>
  );
}

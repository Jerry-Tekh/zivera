import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import {
  assignEventStaff,
  createCategory,
  eventOrders,
  eventRefundRequests,
  eventSales,
  listEventStaff,
  refundOrder,
  removeEventStaff,
  reviewRefundRequest,
  updateCategory,
  updateEvent,
} from '../lib/organizerApi';
import { messageFor } from '../lib/errors';
import { heroFor } from '../lib/images';
import { EVENT_STATUSES, fromDateTimeLocal, optionalText, toDateTimeLocal } from '../lib/eventForms';
import Pagination from '../components/Pagination.jsx';

const money = (c) => `$${(c / 100).toFixed(2)}`;
const PAGE_SIZE = 20;

export default function OrganizerEvent() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [status, setStatus] = useState('draft');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [maxPerCustomer, setMaxPerCustomer] = useState('');
  const [salesOpenAt, setSalesOpenAt] = useState('');
  const [salesCloseAt, setSalesCloseAt] = useState('');
  const [categoryEdits, setCategoryEdits] = useState({});
  const [staffEmail, setStaffEmail] = useState('');
  const [err, setErr] = useState(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);
  const [ordersStatus, setOrdersStatus] = useState('');
  const [refundsStatus, setRefundsStatus] = useState('');

  const event = useQuery({ queryKey: ['managed-event', id], queryFn: () => apiGet(`/admin/events/${id}`) });
  const sales = useQuery({ queryKey: ['sales', id], queryFn: () => eventSales(id) });
  const orders = useQuery({
    queryKey: ['event-orders', id, ordersPage, ordersStatus],
    queryFn: () => eventOrders(id, { page: ordersPage, pageSize: PAGE_SIZE, status: ordersStatus }),
  });
  const refundRequests = useQuery({
    queryKey: ['event-refund-requests', id, refundsPage, refundsStatus],
    queryFn: () => eventRefundRequests(id, { page: refundsPage, pageSize: PAGE_SIZE, status: refundsStatus }),
  });
  const staff = useQuery({ queryKey: ['event-staff', id], queryFn: () => listEventStaff(id) });

  useEffect(() => {
    if (!event.data) return;
    setEventTitle(event.data.title ?? '');
    setDescription(event.data.description ?? '');
    setLocation(event.data.location ?? '');
    setStartsAt(toDateTimeLocal(event.data.starts_at));
    setStatus(event.data.status ?? 'draft');
  }, [event.data]);

  const refund = useMutation({
    mutationFn: refundOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-orders', id] });
      qc.invalidateQueries({ queryKey: ['sales', id] });
      qc.invalidateQueries({ queryKey: ['managed-event', id] });
    },
    onError: (e) => setErr(messageFor(e)),
  });

  const publish = useMutation({
    mutationFn: () => updateEvent(id, { status: 'published' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['managed-event', id] }),
    onError: (e) => setErr(messageFor(e)),
  });
  const saveDetails = useMutation({
    mutationFn: () => updateEvent(id, {
      title: eventTitle,
      description: optionalText(description),
      location: optionalText(location),
      startsAt: fromDateTimeLocal(startsAt),
      status,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managed-event', id] });
      qc.invalidateQueries({ queryKey: ['admin-events'] });
    },
    onError: (e) => setErr(messageFor(e)),
  });
  const addCategory = useMutation({
    mutationFn: () => createCategory(id, {
      name,
      priceCents: Number(price),
      totalQuantity: Number(qty),
      maxPerCustomer: maxPerCustomer ? Number(maxPerCustomer) : undefined,
      salesOpenAt: fromDateTimeLocal(salesOpenAt),
      salesCloseAt: fromDateTimeLocal(salesCloseAt),
    }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setQty('');
      setMaxPerCustomer('');
      setSalesOpenAt('');
      setSalesCloseAt('');
      qc.invalidateQueries({ queryKey: ['managed-event', id] });
    },
    onError: (e) => setErr(messageFor(e)),
  });
  const saveCategory = useMutation({
    mutationFn: ({ categoryId, data }) => updateCategory(id, categoryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managed-event', id] });
      qc.invalidateQueries({ queryKey: ['sales', id] });
    },
    onError: (e) => setErr(messageFor(e)),
  });
  const assignStaff = useMutation({
    mutationFn: () => assignEventStaff(id, staffEmail),
    onSuccess: () => {
      setStaffEmail('');
      qc.invalidateQueries({ queryKey: ['event-staff', id] });
    },
    onError: (e) => setErr(messageFor(e)),
  });
  const removeStaff = useMutation({
    mutationFn: (userId) => removeEventStaff(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-staff', id] }),
    onError: (e) => setErr(messageFor(e)),
  });
  const reviewRequest = useMutation({
    mutationFn: ({ requestId, decision }) => reviewRefundRequest(requestId, { decision }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-refund-requests', id] });
      qc.invalidateQueries({ queryKey: ['event-orders', id] });
      qc.invalidateQueries({ queryKey: ['sales', id] });
      qc.invalidateQueries({ queryKey: ['managed-event', id] });
    },
    onError: (e) => setErr(messageFor(e)),
  });

  if (event.isLoading) return <p className="muted">Loading event…</p>;
  if (event.isError) {
    return (
      <div className="page">
        <p role="alert" className="alert danger">{messageFor(event.error)}</p>
        <button type="button" onClick={() => event.refetch()}>Retry loading event</button>
      </div>
    );
  }
  if (!event.data) return <p role="alert" className="alert danger">Event data is unavailable.</p>;
  const ev = event.data;
  const totals = sales.data?.totals;
  const orderRows = orders.data?.rows ?? [];
  const refundRows = refundRequests.data?.rows ?? [];

  return (
    <div className="page reveal">
      <section className="hero-media" style={{ minHeight: 280 }}>
        <img src={heroFor(ev.id)} alt="" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge">{ev.status}</span>
          <h1 style={{ marginTop: 12 }}>{ev.title}</h1>
          <p className="mono" style={{ color: 'rgba(255, 255, 255, 0.84)', marginTop: 8 }}>{ev.location || 'Location TBA'}</p>
        </div>
      </section>

      <div className="row">
        {sales.isLoading ? (
          <div className="section">
            <span className="eyebrow">Sales</span>
            <p className="muted">Loading sales…</p>
          </div>
        ) : sales.isError ? (
          <div className="section">
            <p role="alert" className="alert danger">{messageFor(sales.error)}</p>
            <button type="button" onClick={() => sales.refetch()}>Retry sales</button>
          </div>
        ) : (
          totals && (
            <div className="section">
              <span className="eyebrow">Sales</span>
              <h2 style={{ marginTop: 8 }}>{totals.sold} sold</h2>
              <p className="mono muted">{money(totals.revenueCents)} revenue</p>
            </div>
          )
        )}
        {ev.status === 'draft' && <button className="primary" onClick={() => { setErr(null); publish.mutate(); }} disabled={publish.isPending}>Publish</button>}
      </div>
      {err && <p className="alert danger">{err}</p>}

      <form onSubmit={(e) => { e.preventDefault(); setErr(null); saveDetails.mutate(); }}
        className="section form-grid">
        <div style={{ gridColumn: '1 / -1' }}>
          <span className="eyebrow">Event info</span>
          <h2 style={{ marginTop: 6 }}>Details</h2>
        </div>
        <label>Title<input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required /></label>
        <label>Location<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <label>Starts at<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: '1 / -1' }}>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label>
        <button className="primary" type="submit" disabled={!eventTitle || saveDetails.isPending}>{saveDetails.isPending ? 'Saving…' : 'Save details'}</button>
      </form>

      <section className="section">
      <span className="eyebrow">Inventory</span>
      <h2 style={{ marginTop: 6 }}>Ticket categories</h2>
      <ul className="data-list" style={{ marginTop: 16 }}>
        {(ev.categories ?? []).map((c) => {
          const edit = categoryEdits[c.id] ?? {};
          const value = (field, fallback) => edit[field] ?? fallback ?? '';
          return (
          <li key={c.id} className="card stack" style={{ padding: 16 }}>
            <div className="between">
              <h3>{c.name}</h3>
              <span className="mono">{money(c.price_cents)} <span className="muted">· {c.available_quantity}/{c.total_quantity} left</span></span>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              saveCategory.mutate({
                categoryId: c.id,
                data: {
                  name: value('name', c.name),
                  priceCents: Number(value('priceCents', c.price_cents)),
                  totalQuantity: Number(value('totalQuantity', c.total_quantity)),
                  maxPerCustomer: Number(value('maxPerCustomer', c.max_per_customer)),
                  salesOpenAt: fromDateTimeLocal(value('salesOpenAt', toDateTimeLocal(c.sales_open_at))),
                  salesCloseAt: fromDateTimeLocal(value('salesCloseAt', toDateTimeLocal(c.sales_close_at))),
                },
              });
            }} className="form-grid">
              <label>Name<input value={value('name', c.name)} onChange={(e) => setCategoryEdits((p) => ({ ...p, [c.id]: { ...edit, name: e.target.value } }))} /></label>
              <label>Price<input type="number" value={value('priceCents', c.price_cents)} onChange={(e) => setCategoryEdits((p) => ({ ...p, [c.id]: { ...edit, priceCents: e.target.value } }))} /></label>
              <label>Total<input type="number" value={value('totalQuantity', c.total_quantity)} onChange={(e) => setCategoryEdits((p) => ({ ...p, [c.id]: { ...edit, totalQuantity: e.target.value } }))} /></label>
              <label>Max<input type="number" min="1" value={value('maxPerCustomer', c.max_per_customer)} onChange={(e) => setCategoryEdits((p) => ({ ...p, [c.id]: { ...edit, maxPerCustomer: e.target.value } }))} /></label>
              <label>Sales open<input type="datetime-local" value={value('salesOpenAt', toDateTimeLocal(c.sales_open_at))} onChange={(e) => setCategoryEdits((p) => ({ ...p, [c.id]: { ...edit, salesOpenAt: e.target.value } }))} /></label>
              <label>Sales close<input type="datetime-local" value={value('salesCloseAt', toDateTimeLocal(c.sales_close_at))} onChange={(e) => setCategoryEdits((p) => ({ ...p, [c.id]: { ...edit, salesCloseAt: e.target.value } }))} /></label>
              <button type="submit" disabled={saveCategory.isPending}>Save tier</button>
            </form>
          </li>
          );
        })}
      </ul>
      </section>

      <form onSubmit={(e) => { e.preventDefault(); setErr(null); addCategory.mutate(); }}
        className="section form-grid">
        <div style={{ gridColumn: '1 / -1' }}>
          <span className="eyebrow">New tier</span>
          <h2 style={{ marginTop: 6 }}>Add category</h2>
        </div>
        <label style={{ flex: '1 1 160px' }}>Category name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Price (cents)<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required /></label>
        <label>Quantity<input type="number" value={qty} onChange={(e) => setQty(e.target.value)} required /></label>
        <label>Max per customer<input type="number" min="1" value={maxPerCustomer} onChange={(e) => setMaxPerCustomer(e.target.value)} placeholder="10" /></label>
        <label>Sales open<input type="datetime-local" value={salesOpenAt} onChange={(e) => setSalesOpenAt(e.target.value)} /></label>
        <label>Sales close<input type="datetime-local" value={salesCloseAt} onChange={(e) => setSalesCloseAt(e.target.value)} /></label>
        <button className="primary" type="submit" disabled={addCategory.isPending}>{addCategory.isPending ? 'Adding…' : 'Add category'}</button>
      </form>

      <section className="section">
      <span className="eyebrow">Access control</span>
      <h2 style={{ marginTop: 6 }}>Gate staff</h2>
      <form onSubmit={(e) => { e.preventDefault(); setErr(null); assignStaff.mutate(); }}
        className="form-grid" style={{ marginTop: 16 }}>
        <label style={{ flex: '1 1 240px' }}>Staff email<input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required /></label>
        <button className="primary" type="submit" disabled={!staffEmail || assignStaff.isPending}>{assignStaff.isPending ? 'Assigning…' : 'Assign staff'}</button>
      </form>
      {staff.isLoading && <p className="muted">Loading staff…</p>}
      {staff.isError && (
        <div>
          <p role="alert" className="alert danger">{messageFor(staff.error)}</p>
          <button type="button" onClick={() => staff.refetch()}>Retry staff</button>
        </div>
      )}
      {!staff.isError && staff.data?.length === 0 && <p className="muted">No staff assigned.</p>}
      <ul className="data-list" style={{ marginTop: 16 }}>
        {(staff.data ?? []).map((s) => (
          <li key={s.id} className="data-row">
            <span><strong>{s.email}</strong> <span className="badge">{s.role}</span></span>
            <button className="danger" onClick={() => removeStaff.mutate(s.id)} disabled={removeStaff.isPending}>Remove</button>
          </li>
        ))}
      </ul>
      </section>

      <section className="section">
      <span className="eyebrow">Refund queue</span>
      <h2 style={{ marginTop: 6 }}>Refund requests</h2>
      <label style={{ display: 'inline-flex', marginTop: 12 }}>Status
        <select value={refundsStatus} onChange={(e) => { setRefundsPage(1); setRefundsStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      {refundRequests.isLoading && <p className="muted">Loading refund requests…</p>}
      {refundRequests.isError && (
        <div>
          <p role="alert" className="alert danger">{messageFor(refundRequests.error)}</p>
          <button type="button" onClick={() => refundRequests.refetch()}>Retry refund requests</button>
        </div>
      )}
      {!refundRequests.isError && refundRequests.data && refundRows.length === 0 && (
        <p className="muted">{refundRequests.data.total === 0 ? 'No refund requests.' : 'No requests on this page.'}</p>
      )}
      <ul className="data-list" style={{ marginTop: 16 }}>
        {refundRows.map((r) => (
          <li key={r.id} className="data-row">
            <span>
              <span style={{ fontWeight: 600 }}>{r.email}</span>
              <span className="mono muted" style={{ display: 'block', fontSize: '0.74rem', marginTop: 3 }}>
                {r.category_name} · {money(r.amount_cents)} · {r.reason}
              </span>
            </span>
            <span className="row" style={{ justifyContent: 'flex-end' }}>
              <span className={`badge${r.status === 'approved' ? ' ok' : ''}`}>{r.status}</span>
              <button onClick={() => reviewRequest.mutate({ requestId: r.id, decision: 'approve' })} disabled={r.status !== 'pending' || reviewRequest.isPending}>Approve</button>
              <button onClick={() => reviewRequest.mutate({ requestId: r.id, decision: 'reject' })} disabled={r.status !== 'pending' || reviewRequest.isPending}>Reject</button>
            </span>
          </li>
        ))}
      </ul>
      {refundRequests.data && (
        <Pagination
          page={refundRequests.data.page}
          pageSize={refundRequests.data.pageSize}
          total={refundRequests.data.total}
          totalPages={refundRequests.data.totalPages}
          onPageChange={setRefundsPage}
        />
      )}
      </section>

      <section className="section">
      <span className="eyebrow">Orders</span>
      <h2 style={{ marginTop: 6 }}>Recent orders</h2>
      <label style={{ display: 'inline-flex', marginTop: 12 }}>Status
        <select value={ordersStatus} onChange={(e) => { setOrdersPage(1); setOrdersStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>
      {orders.isLoading && <p className="muted">Loading orders…</p>}
      {orders.isError && (
        <div>
          <p role="alert" className="alert danger">{messageFor(orders.error)}</p>
          <button type="button" onClick={() => orders.refetch()}>Retry orders</button>
        </div>
      )}
      {!orders.isError && orders.data && orderRows.length === 0 && (
        <p className="muted">{orders.data.total === 0 ? 'No orders yet.' : 'No orders on this page.'}</p>
      )}
      <ul className="data-list" style={{ marginTop: 16 }}>
        {orderRows.map((o) => (
          <li key={o.id} className="data-row">
            <span>
              <span style={{ fontWeight: 600 }}>{o.email}</span>
              <span className="mono muted" style={{ display: 'block', fontSize: '0.74rem', marginTop: 3 }}>
                {o.category_name} · {o.quantity}× · {money(o.amount_cents)}
              </span>
            </span>
            <span className="row" style={{ justifyContent: 'flex-end' }}>
              <span className={`badge${o.status === 'paid' ? ' ok' : ''}`}>{o.status}</span>
              <button
                onClick={() => { setErr(null); refund.mutate(o.id); }}
                disabled={o.status !== 'paid' || refund.isPending}
              >
                Refund
              </button>
            </span>
          </li>
        ))}
      </ul>
      {orders.data && (
        <Pagination
          page={orders.data.page}
          pageSize={orders.data.pageSize}
          total={orders.data.total}
          totalPages={orders.data.totalPages}
          onPageChange={setOrdersPage}
        />
      )}
      </section>
    </div>
  );
}

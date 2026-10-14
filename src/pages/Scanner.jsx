import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listScannableEvents, scanTicket } from '../lib/scanApi';
import { messageFor } from '../lib/errors';
import CameraScanner from '../components/CameraScanner.jsx';
import StaffScanAnalytics from '../components/StaffScanAnalytics.jsx';

export default function Scanner() {
  const [eventId, setEventId] = useState('');
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null); // { ok: boolean, message: string }
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [camera, setCamera] = useState(false);
  const events = useQuery({
    queryKey: ['scanner-events'],
    queryFn: listScannableEvents,
  });
  const selectedEvent = events.data?.find((event) => event.id === eventId);

  const doScan = useCallback(async (tok) => {
    if (!eventId || !tok || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await scanTicket(eventId, tok);
      setResult({ ok: true, message: 'Admitted ✓' });
    } catch (ex) {
      setResult({ ok: false, message: messageFor(ex) });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setToken('');
    }
  }, [eventId]);

  const onDecode = useCallback((text) => { doScan(text); }, [doScan]);
  const onCamError = useCallback(() => {
    setResult({ ok: false, message: 'Camera unavailable — enter the code manually.' });
    setCamera(false);
  }, []);

  return (
    <div className="scanner-shell page">
      <header className="page-hero" style={{ textAlign: 'center', margin: '0 auto' }}>
        <span className="eyebrow" style={{ justifyContent: 'center' }}>Event-day gate</span>
        <h1>Scanner</h1>
      </header>

      {result && (
        <div role="status" className={`scanner-result reveal ${result.ok ? 'ok' : 'danger'}`}>
          {result.message}
        </div>
      )}

      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); doScan(token); }} style={{ padding: 22 }}>
        <label>Event
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setToken('');
              setResult(null);
              setCamera(false);
            }}
            disabled={busy || events.isLoading || events.isError}
          >
            <option value="">Select an event</option>
            {(events.data ?? []).map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}{ev.location ? ` — ${ev.location}` : ''}</option>
            ))}
          </select>
        </label>
        {events.isLoading && <p className="muted">Loading assigned events…</p>}
        {events.isError && (
          <div>
            <p role="alert" className="alert danger">{messageFor(events.error)}</p>
            <button type="button" onClick={() => events.refetch()}>Retry assigned events</button>
          </div>
        )}
        {!events.isError && events.data?.length === 0 && (
          <p className="muted" style={{ marginTop: -8 }}>
            No assigned events yet. Ask an organizer to add this staff account to an event.
          </p>
        )}
        {selectedEvent && (
          <div className="section" role="region" aria-label="Selected event" aria-live="polite">
            <strong>{selectedEvent.title}</strong>
            {selectedEvent.location && <p className="muted">{selectedEvent.location}</p>}
            {selectedEvent.starts_at && (
              <p className="mono muted">
                {new Date(selectedEvent.starts_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
        <label>Ticket code<input value={token} onChange={(e) => setToken(e.target.value)} required autoFocus placeholder="paste or scan" /></label>
        <button className="primary" type="submit" disabled={busy || events.isLoading || events.isError || events.data?.length === 0 || !selectedEvent || !token}>Scan</button>
      </form>

      <button type="button" className="ghost" onClick={() => setCamera((c) => !c)} disabled={busy || !selectedEvent || events.isLoading || events.isError || events.data?.length === 0} style={{ width: '100%' }}>
        {camera ? 'Stop camera' : 'Use camera'}
      </button>
      {camera && <div className="camera-frame"><CameraScanner onDecode={onDecode} onError={onCamError} /></div>}
      <StaffScanAnalytics />
    </div>
  );
}

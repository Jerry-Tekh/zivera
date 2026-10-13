import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth.jsx';
import { changePassword, listSessions, revokeSession, updateMe } from '../lib/authApi';
import { messageFor } from '../lib/errors';

export default function Account() {
  const { user, replaceUser } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState(null);
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [sessionMessage, setSessionMessage] = useState(null);
  const sessionsQuery = useQuery({ queryKey: ['sessions'], queryFn: listSessions });
  const { data: sessions } = sessionsQuery;

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setEmail(user.email ?? '');
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () => updateMe({ name, email }),
    onSuccess: (nextUser) => {
      replaceUser(nextUser);
      setProfileMessage({ ok: true, text: 'Profile updated.' });
    },
    onError: (e) => setProfileMessage({ ok: false, text: messageFor(e) }),
  });

  const savePassword = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage({ ok: true, text: 'Password updated.' });
    },
    onError: (e) => setPasswordMessage({ ok: false, text: messageFor(e) }),
  });

  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      setSessionMessage({ ok: true, text: 'Session revoked.' });
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => setSessionMessage({ ok: false, text: messageFor(e) }),
  });

  return (
    <div className="page reveal">
      <header className="page-hero">
        <span className="eyebrow">Your account</span>
        <h1>{user ? user.name : 'Account'}</h1>
      {user && (
        <p className="muted">
          {user.email} <span className="badge" style={{ marginLeft: 8 }}>{user.role}</span>
        </p>
      )}
      </header>

      <section className="section">
        <div className="between">
          <div>
            <span className="eyebrow">Profile</span>
            <h2 style={{ marginTop: 6 }}>Personal details</h2>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setProfileMessage(null);
            saveProfile.mutate();
          }}
          className="form-grid"
          style={{ marginTop: 18 }}
        >
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <button className="primary" type="submit" disabled={!name || !email || saveProfile.isPending}>{saveProfile.isPending ? 'Saving…' : 'Save profile'}</button>
        </form>
        {profileMessage && (
          <p role="status" className={`alert ${profileMessage.ok ? 'ok' : 'danger'}`} style={{ marginTop: 14 }}>
            {profileMessage.text}
          </p>
        )}
      </section>

      <section className="section">
        <span className="eyebrow">Password</span>
        <h2 style={{ marginTop: 6 }}>Security</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPasswordMessage(null);
            savePassword.mutate();
          }}
          className="form-grid"
          style={{ marginTop: 18 }}
        >
          <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label>
          <label>New password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10} /></label>
          <button type="submit" disabled={!currentPassword || !newPassword || savePassword.isPending}>{savePassword.isPending ? 'Changing…' : 'Change password'}</button>
        </form>
        {passwordMessage && (
          <p role="status" className={`alert ${passwordMessage.ok ? 'ok' : 'danger'}`} style={{ marginTop: 14 }}>
            {passwordMessage.text}
          </p>
        )}
      </section>

      <section className="section">
        <span className="eyebrow">Sessions</span>
        <h2 style={{ marginTop: 6 }}>Active sessions</h2>
      {sessionMessage && (
        <p role="status" className={`alert ${sessionMessage.ok ? 'ok' : 'danger'}`} style={{ marginTop: 14 }}>
          {sessionMessage.text}
        </p>
      )}
      {sessionsQuery.isLoading && <p className="muted" style={{ marginTop: 14 }}>Loading sessions…</p>}
      {sessionsQuery.isError && (
        <div style={{ marginTop: 14 }}>
          <p role="alert" className="alert danger">{messageFor(sessionsQuery.error)}</p>
          <button type="button" onClick={() => sessionsQuery.refetch()}>Retry loading sessions</button>
        </div>
      )}
      {!sessionsQuery.isError && sessions?.length === 0 && <p className="muted">No active sessions.</p>}
      <ul className="data-list" style={{ marginTop: 16 }}>
        {(sessions ?? []).map((s) => (
          <li key={s.id} className="data-row">
            <span>
              <span style={{ fontWeight: 600 }}>{s.user_agent || 'Unknown device'}</span>
              <span className="mono muted" style={{ display: 'block', fontSize: '0.74rem', marginTop: 3 }}>
                {s.ip} · last used {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '—'}
              </span>
            </span>
            <button
              className="danger"
              onClick={() => { setSessionMessage(null); revoke.mutate(s.id); }}
              disabled={revoke.isPending}
            >
              {revoke.isPending && revoke.variables === s.id ? 'Revoking…' : 'Revoke'}
            </button>
          </li>
        ))}
      </ul>
      </section>
    </div>
  );
}

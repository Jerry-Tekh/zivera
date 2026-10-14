import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { messageFor } from '../lib/errors';
import { DEMO_CREDENTIALS, DEMO_PASSWORD } from '../lib/demoCredentials';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (ex) {
      setErr(messageFor(ex));
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(email) {
    setEmail(email);
    setPassword(DEMO_PASSWORD);
  }

  return (
    <div className="auth-wrap reveal">
      <section className="auth-card panel">
        <span className="eyebrow">Welcome back</span>
        <h1 style={{ fontSize: '2.2rem', marginTop: 10 }}>Log in</h1>
        {err && <p className="alert danger" style={{ marginTop: 16 }}>{err}</p>}
        <form onSubmit={onSubmit} className="stack" style={{ marginTop: 22 }}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button className="primary" disabled={busy} type="submit">{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <div className="stack" style={{ marginTop: 24 }}>
          <span className="eyebrow">Demo roles</span>
          <div className="grid-2" style={{ gap: 8 }}>
            {DEMO_CREDENTIALS.map((demo) => (
              <button key={demo.role} type="button" className="ghost" onClick={() => fillDemo(demo.email)}>
                {demo.label}
              </button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ marginTop: 22, fontSize: '0.9rem' }}>
          No account? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 800 }}>Create one</Link>
        </p>
      </section>
    </div>
  );
}

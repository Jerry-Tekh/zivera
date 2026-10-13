import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const ROLE_NAMES = {
  registered_user: 'Attendee',
  organizer: 'Organizer',
  event_staff: 'Event staff',
  super_admin: 'Administrator',
};

const ROLE_LINKS = {
  registered_user: [
    { to: '/tickets', label: 'My tickets', short: 'T' },
    { to: '/account', label: 'Account', short: 'A' },
  ],
  organizer: [
    { to: '/organizer', label: 'Overview', short: 'O', end: true },
    { to: '/organizer#events', label: 'Events', short: 'E' },
    { to: '/tickets', label: 'My tickets', short: 'T' },
    { to: '/account', label: 'Account', short: 'A' },
  ],
  event_staff: [
    { to: '/scan', label: 'Ticket scanner', short: 'S', end: true },
    { to: '/tickets', label: 'My tickets', short: 'T' },
    { to: '/account', label: 'Account', short: 'A' },
  ],
  super_admin: [
    { to: '/admin/overview', label: 'Platform overview', short: 'P', end: true },
    { to: '/organizer#events', label: 'Events', short: 'E' },
    { to: '/scan', label: 'Ticket scanner', short: 'S', end: true },
    { to: '/admin/users', label: 'Users', short: 'U' },
    { to: '/tickets', label: 'My tickets', short: 'T' },
    { to: '/account', label: 'Account', short: 'A' },
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = ROLE_LINKS[user?.role] ?? ROLE_LINKS.registered_user;
  const roleName = ROLE_NAMES[user?.role] ?? 'Account';
  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  if (location.pathname === '/dashboard') {
    const startPath = user?.role === 'super_admin'
      ? '/admin/overview'
      : user?.role === 'organizer'
        ? '/organizer'
      : user?.role === 'event_staff'
        ? '/scan'
        : '/tickets';
    return <Navigate to={startPath} replace />;
  }

  return (
    <div className={`dashboard-layout${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      {mobileOpen && (
        <button
          type="button"
          className="dashboard-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className="dashboard-sidebar" aria-label={`${roleName} navigation`}>
        <div className="dashboard-sidebar-top">
          <Link to="/" className="dashboard-sidebar-brand" aria-label="Zireva home">
            <span className="dashboard-brand-mark">Z</span>
            <span className="dashboard-brand-name">Zireva</span>
          </Link>
          <button
            type="button"
            className="dashboard-mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="dashboard-workspace">
          <span className="dashboard-avatar">{initials}</span>
          <span className="dashboard-workspace-copy">
            <strong>{roleName} workspace</strong>
            <span>{user?.email}</span>
          </span>
        </div>

        <span className="dashboard-nav-heading">Workspace</span>
        <nav className="dashboard-nav">
          {links.map(({ to, label, short }) => {
            const [path, hash] = to.split('#');
            const active = location.pathname === path
              ? (hash ? location.hash === `#${hash}` : !location.hash)
              : to === '/organizer#events' && location.pathname.startsWith('/organizer/events/');
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`dashboard-nav-link${active ? ' active' : ''}`}
                title={collapsed ? label : undefined}
              >
              <span className="dashboard-nav-icon" aria-hidden="true">{short}</span>
              <span className="dashboard-nav-label">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <Link to="/" className="dashboard-back-link" title={collapsed ? 'Back to events' : undefined}>
            <span className="dashboard-nav-icon" aria-hidden="true">←</span>
            <span className="dashboard-nav-label">Back to events</span>
          </Link>
          <button
            type="button"
            className="dashboard-back-link dashboard-logout"
            title={collapsed ? 'Log out' : undefined}
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            <span className="dashboard-nav-icon" aria-hidden="true">↗</span>
            <span className="dashboard-nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="dashboard-collapse-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
          </button>
          <button
            type="button"
            className="dashboard-menu-toggle"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="dashboard-topbar-context">
            <span>{roleName} workspace</span>
          </div>
          <span className="dashboard-topbar-user">{user?.email}</span>
        </header>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}

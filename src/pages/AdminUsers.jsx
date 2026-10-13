import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listUsers, updateUserRole } from '../lib/authApi';
import { messageFor } from '../lib/errors';
import Pagination from '../components/Pagination.jsx';

const ROLES = ['super_admin', 'organizer', 'event_staff', 'registered_user'];
const PAGE_SIZE = 20;

export default function AdminUsers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pendingRoles, setPendingRoles] = useState({});
  const [message, setMessage] = useState(null);
  const usersQuery = useQuery({
    queryKey: ['admin-users', page, search, roleFilter],
    queryFn: () => listUsers({ page, pageSize: PAGE_SIZE, search, role: roleFilter }),
  });
  const { data: result } = usersQuery;
  const users = result?.rows ?? [];
  const roleChange = useMutation({
    mutationFn: ({ id, role }) => updateUserRole(id, role),
    onSuccess: (_user, variables) => {
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      setMessage({ ok: true, text: 'User role updated.' });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) => setMessage({ ok: false, text: messageFor(e) }),
  });

  return (
    <div className="page reveal">
      <header className="page-hero">
        <span className="eyebrow">Super admin</span>
        <h1>Users</h1>
        <p>Review account roles and update access levels for the platform.</p>
      </header>
      <form
        className="row"
        role="search"
        onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}
      >
        <label>Search users<input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} /></label>
        <label>Role
          <select value={roleFilter} onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}>
            <option value="">All roles</option>
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <button type="submit">Search</button>
        {(search || roleFilter) && (
          <button type="button" onClick={() => { setPage(1); setSearchInput(''); setSearch(''); setRoleFilter(''); }}>
            Clear filters
          </button>
        )}
      </form>
      {message && (
        <p role="status" className={`alert ${message.ok ? 'ok' : 'danger'}`}>
          {message.text}
        </p>
      )}

      {usersQuery.isLoading ? <p className="muted">Loading users…</p> : usersQuery.isError ? (
        <div>
          <p role="alert" className="alert danger">{messageFor(usersQuery.error)}</p>
          <button type="button" onClick={() => usersQuery.refetch()}>Retry loading users</button>
        </div>
      ) : !users.length ? (
        <p className="muted">{search || roleFilter ? 'No users match these filters.' : 'No users found.'}</p>
      ) : (
        <section className="table-card card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
          {(users ?? []).map((u) => {
            const nextRole = pendingRoles[u.id] ?? u.role;
            return (
              <tr key={u.id}>
                <td><strong>{u.name}</strong><span className="mono muted" style={{ display: 'block', fontSize: '0.72rem' }}>{u.id}</span></td>
                <td>{u.email}</td>
                <td>
                <label>
                  Role
                  <select value={nextRole} onChange={(e) => setPendingRoles((prev) => ({ ...prev, [u.id]: e.target.value }))}>
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                </td>
                <td>
                <button
                  type="button"
                  disabled={nextRole === u.role || roleChange.isPending}
                  onClick={() => {
                    setMessage(null);
                    roleChange.mutate({ id: u.id, role: nextRole });
                  }}
                >
                  {roleChange.isPending && roleChange.variables?.id === u.id ? 'Saving…' : 'Save'}
                </button>
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
        </section>
      )}
      {!usersQuery.isLoading && !usersQuery.isError && result && (
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          totalPages={result.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

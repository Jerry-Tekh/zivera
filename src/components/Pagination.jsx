export default function Pagination({ page, pageSize, total, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="between" aria-label="Pagination" style={{ marginTop: 16 }}>
      <span className="muted">Showing {first}–{last} of {total}</span>
      <div className="row">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </button>
        <span className="mono muted" aria-current="page">Page {page} of {totalPages}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </nav>
  );
}

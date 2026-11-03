export default function Pagination({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-4 text-sm">
      <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="text-slate-500">
        Page {page} of {pages}
      </span>
      <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
}

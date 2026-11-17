import { useEffect, useState } from 'react';
import { api, errorText } from './api';
import { useLoad, when } from './hooks';

const PAGE = 50;
const FILTERS = [['all', 'All'], ['starred', 'Starred'], ['unanswered', 'Unanswered'], ['archived', 'Archived']];

function query({ q, filter, offset }) {
  const p = new URLSearchParams({ limit: PAGE, offset });
  if (q) p.set('q', q);
  if (filter === 'starred') p.set('starred', 'true');
  if (filter === 'unanswered') p.set('unanswered', 'true');
  p.set('archived', filter === 'archived' ? 'true' : 'false');
  return `/api/admin/conversations?${p}`;
}

function Thread({ id, onChanged, onDeleted }) {
  const { data, error, setData } = useLoad((signal) => api.get(`/api/admin/conversations/${encodeURIComponent(id)}`, { signal }), [id]);
  const [draft, setDraft] = useState(null);   // null = note box untouched, show the saved note
  const [err, setErr] = useState('');
  const note = draft ?? data?.note ?? '';

  async function patch(body) {
    setErr('');
    try {
      const summary = await api.patch(`/api/admin/conversations/${encodeURIComponent(id)}`, body);
      setData((d) => ({ ...d, ...summary }));
      setDraft(null);
      onChanged(summary);
    } catch (e) { setErr(errorText(e)); }
  }

  async function remove() {
    if (!confirm('Delete this conversation for good?')) return;
    try { await api.del(`/api/admin/conversations/${encodeURIComponent(id)}`); onDeleted(id); } catch (e) { setErr(errorText(e)); }
  }

  if (error) return <p className="adm-err">{errorText(error)}</p>;
  if (!data) return <p className="adm-empty">Loading…</p>;

  return (
    <>
      <div className="adm-row adm-threadbar">
        <small className="adm-hint">Started {when(data.started_at)}</small>
        <span className="adm-spacer" />
        <button className="adm-ghost" onClick={() => patch({ starred: !data.starred })}>{data.starred ? '★ Starred' : '☆ Star'}</button>
        <button className="adm-ghost" onClick={() => patch({ archived: !data.archived })}>{data.archived ? 'Unarchive' : 'Archive'}</button>
        <button className="adm-ghost is-danger" onClick={remove}>Delete</button>
      </div>
      {err && <p className="adm-err" role="alert">{err}</p>}
      {data.messages.map((m, i) => (
        <div key={i} className={'adm-msg is-' + m.role + (m.unanswered ? ' is-unanswered' : '')}>
          <small>
            {m.role === 'user' ? 'Visitor' : 'Kirby'} · {when(m.at)}
            {m.mood && ` · ${m.mood}`}{m.section && ` · scrolled to ${m.section}`}{m.unanswered && ' · couldn’t answer'}
          </small>
          <p>{m.content}</p>
        </div>
      ))}
      <form className="adm-note-form" onSubmit={(e) => { e.preventDefault(); patch({ note: note.trim() || null }); }}>
        <label htmlFor="chat-note">Private note</label>
        <textarea id="chat-note" rows={2} maxLength={1000} value={note} onChange={(e) => setDraft(e.target.value)} />
        <button className="adm-ghost" disabled={(data.note || '') === note.trim()}>Save note</button>
      </form>
    </>
  );
}

export default function Chats() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(null);
  const { data, error, setData } = useLoad((signal) => api.get(query({ q, filter, offset }), { signal }), [q, filter, offset]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const update = (summary) => setData((d) => d && ({ ...d, items: d.items.map((c) => (c.id === summary.id ? summary : c)) }));
  const drop = (id) => { setData((d) => d && ({ ...d, items: d.items.filter((c) => c.id !== id), total: d.total - 1 })); setOpen(null); };

  return (
    <div className="adm-body">
      <div className="adm-bar">
        <div className="adm-range" role="group" aria-label="Filter">
          {FILTERS.map(([id, label]) => (
            <button key={id} className={filter === id ? 'is-on' : ''} aria-pressed={filter === id}
              onClick={() => { setFilter(id); setOffset(0); setOpen(null); }}>{label}</button>
          ))}
        </div>
        <input className="adm-search" type="search" placeholder="Search messages" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search messages" />
        <span className="adm-spacer" />
        {data && <small className="adm-hint">{data.total} conversation{data.total === 1 ? '' : 's'}</small>}
      </div>

      {error && <p className="adm-err adm-banner" role="alert">{errorText(error)}</p>}
      {!data && !error && <p className="adm-empty">Loading…</p>}
      {data && data.items.length === 0 && <p className="adm-empty adm-card">No conversations here.</p>}

      {data && data.items.length > 0 && (
        <div className="adm-chats">
          <div className="adm-card">
            <ul className="adm-convos" aria-label="Conversations">
              {data.items.map((c) => (
                <li key={c.id}>
                  <button className={c.id === open ? 'is-on' : ''} onClick={() => setOpen(c.id)}>
                    <span className="adm-cprev">{c.starred && '★ '}{c.preview || '(empty)'}</span>
                    <small>
                      {when(c.last_at)} · {c.messages} messages{c.has_unanswered && ' · unanswered'}{c.note && ' · note'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
            {data.total > PAGE && (
              <div className="adm-row adm-pager">
                <button className="adm-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
                <small className="adm-hint">{offset + 1}–{Math.min(offset + PAGE, data.total)}</small>
                <button className="adm-ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Older</button>
              </div>
            )}
          </div>
          <section className="adm-card adm-thread" aria-live="polite">
            {open ? <Thread key={open} id={open} onChanged={update} onDeleted={drop} /> : <p className="adm-empty">Pick a conversation.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

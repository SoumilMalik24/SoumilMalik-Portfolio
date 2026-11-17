import { useState } from 'react';
import { api, errorText } from './api';
import { useLoad, when } from './hooks';

export default function Inbox() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, error, setData } = useLoad(
    (signal) => api.get(`/api/admin/inbox?limit=100${unreadOnly ? '&unread=true' : ''}`, { signal }), [unreadOnly]);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');

  async function markRead(m, read) {
    try {
      const updated = await api.patch(`/api/admin/inbox/${m.id}`, { read });
      setData((d) => ({ ...d, unread: d.unread + (read ? -1 : 1), items: d.items.map((x) => (x.id === m.id ? updated : x)) }));
    } catch (e) { setErr(errorText(e)); }
  }

  async function remove(m) {
    if (!confirm(`Delete the message from ${m.email}?`)) return;
    try {
      await api.del(`/api/admin/inbox/${m.id}`);
      setData((d) => ({ ...d, total: d.total - 1, unread: d.unread - (m.read ? 0 : 1), items: d.items.filter((x) => x.id !== m.id) }));
    } catch (e) { setErr(errorText(e)); }
  }

  function toggle(m) {
    setOpen(open === m.id ? null : m.id);
    if (!m.read) markRead(m, true);
  }

  return (
    <div className="adm-body">
      <div className="adm-bar">
        <h2 className="adm-h2-inline">Contact messages</h2>
        {data && <small className="adm-badge">{data.unread} unread</small>}
        <span className="adm-spacer" />
        <label className="adm-check"><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only</label>
      </div>
      {(error || err) && <p className="adm-err" role="alert">{error ? errorText(error) : err}</p>}
      {!data && !error && <p className="adm-empty">Loading…</p>}
      {data && data.items.length === 0 && <p className="adm-empty adm-card">No messages. They arrive here from the contact form.</p>}
      {data && data.items.length > 0 && (
        <ul className="adm-card adm-inbox">
          {data.items.map((m) => (
            <li key={m.id} className={m.read ? '' : 'is-unread'}>
              <button className="adm-inrow" onClick={() => toggle(m)} aria-expanded={open === m.id}>
                <b>{m.subject}</b>
                <span>{m.name ? `${m.name} · ` : ''}{m.email}</span>
                <small>{when(m.created_at)}</small>
              </button>
              {open === m.id && (
                <div className="adm-inbody">
                  <p>{m.body}</p>
                  <div className="adm-row">
                    <a className="adm-ghost" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`}>Reply by email</a>
                    <button className="adm-ghost" onClick={() => markRead(m, !m.read)}>Mark {m.read ? 'unread' : 'read'}</button>
                    <button className="adm-ghost is-danger" onClick={() => remove(m)}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

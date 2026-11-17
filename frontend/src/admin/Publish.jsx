import { useEffect, useState } from 'react';
import { api, errorText } from './api';
import { SECTIONS } from './content/schema';
import { useLoad, when } from './hooks';

const LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]));
const STATUS_TEXT = {
  pending: 'waiting', running: 'running', done: 'done', skipped: 'not needed', failed: 'failed',
  triggered: 'build started', building: 'building', ready: 'live', disabled: 'no deploy hook',
};
const tone = (s) => (['failed'].includes(s) ? 'is-bad' : ['done', 'ready', 'triggered', 'skipped'].includes(s) ? 'is-ok' : '');

function Status({ value }) {
  return <span className={'adm-badge ' + tone(value)}>{STATUS_TEXT[value] || value}</span>;
}

function Progress({ pub }) {
  return (
    <div className="adm-progress" role="status">
      <div><b>Publish #{pub.id}</b> · {pub.sections.map((k) => LABEL[k] || k).join(', ')}</div>
      <div>Kirby knowledge: <Status value={pub.reindex_status} /></div>
      <div>Website rebuild: <Status value={pub.deploy_status} /></div>
      {pub.deploy_status === 'disabled' && <small className="adm-hint">Set VERCEL_DEPLOY_HOOK_URL on the server to rebuild the site automatically.</small>}
      {pub.error && <pre className="adm-pre is-bad">{pub.error}</pre>}
      {!pub.finished_at && <small className="adm-hint">Working… this updates by itself.</small>}
    </div>
  );
}

function Revisions() {
  const [section, setSection] = useState('profile');
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  const { data, error } = useLoad((signal) => api.get(`/api/admin/revisions?section=${section}&limit=20`, { signal }), [section]);

  async function view(id) {
    setMsg('');
    try { setOpen(await api.get(`/api/admin/revisions/${id}`)); } catch (e) { setMsg(errorText(e)); }
  }
  async function restore(id) {
    if (!confirm('Copy this version into the draft? The live site does not change until you publish.')) return;
    try {
      await api.post(`/api/admin/revisions/${id}/restore`);
      setMsg('Restored into the draft. Review it under Content, then publish.');
    } catch (e) { setMsg(errorText(e)); }
  }

  return (
    <section className="adm-card">
      <h2>Earlier versions</h2>
      <div className="adm-row">
        <label htmlFor="rev-sec" className="adm-sub">Section</label>
        <select id="rev-sec" value={section} onChange={(e) => { setSection(e.target.value); setOpen(null); }}>
          {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      {msg && <p className="adm-note">{msg}</p>}
      {error && <p className="adm-err">{errorText(error)}</p>}
      {data && data.items.length === 0 && <p className="adm-empty">No versions yet.</p>}
      {data && data.items.length > 0 && (
        <ul className="adm-rows">
          {data.items.map((r) => (
            <li key={r.id}>
              <span>{when(r.created_at)}</span>
              <small className="adm-badge">{r.kind}{r.publish_id ? ` #${r.publish_id}` : ''}</small>
              <span className="adm-spacer" />
              <button className="adm-ghost" onClick={() => view(r.id)}>View</button>
              <button className="adm-ghost" onClick={() => restore(r.id)}>Restore to draft</button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <details open className="adm-table">
          <summary>Version from {when(open.created_at)}</summary>
          <pre className="adm-pre">{JSON.stringify(open.data, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}

export default function Publish() {
  const content = useLoad((signal) => api.get('/api/admin/content', { signal }), []);
  const history = useLoad((signal) => api.get('/api/admin/publishes?limit=20', { signal }), []);
  const [picked, setPicked] = useState(null);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dirty = content.data ? SECTIONS.filter((s) => content.data.sections[s.key]?.dirty) : [];
  const chosen = picked ?? dirty.map((s) => s.key);

  // Poll the running publish until both steps finish.
  useEffect(() => {
    if (!current || current.finished_at) return undefined;
    const t = setTimeout(async () => {
      try { setCurrent(await api.get(`/api/admin/publishes/${current.id}`)); } catch { /* keep polling */ }
    }, 2000);
    return () => clearTimeout(t);
  }, [current]);

  useEffect(() => { if (current?.finished_at) history.reload(); }, [current?.finished_at]); // eslint-disable-line react-hooks/exhaustive-deps

  async function publish() {
    setBusy(true); setErr('');
    try {
      const pub = await api.post('/api/admin/publish', { sections: chosen });
      setCurrent(pub);
      setPicked(null);
      content.reload();
      history.reload();
    } catch (e) {
      setErr(e.status === 422 ? `Some drafts are invalid: ${e.errors.map((x) => `${x.field} (${x.msg})`).join('; ')}` : errorText(e));
    }
    setBusy(false);
  }

  async function redeploy(id) {
    try { setCurrent(await api.post(`/api/admin/publishes/${id}/redeploy`)); } catch (e) { setErr(errorText(e)); }
  }

  const toggle = (key) => setPicked(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key]);

  return (
    <div className="adm-body">
      <section className="adm-card">
        <h2>Publish changes</h2>
        <p className="adm-sub">Publishing makes saved drafts live: Kirby re-learns the content and the website rebuilds (about a minute).</p>
        {content.error && <p className="adm-err">{errorText(content.error)}</p>}
        {content.data && dirty.length === 0 && <p className="adm-empty">Everything is live. Save a draft under Content to publish it here.</p>}
        {dirty.length > 0 && (
          <>
            <ul className="adm-checks">
              {dirty.map((s) => (
                <li key={s.key}>
                  <label className="adm-check">
                    <input type="checkbox" checked={chosen.includes(s.key)} onChange={() => toggle(s.key)} />
                    {s.label}
                    <small className="adm-hint">{content.data.sections[s.key].published ? 'changed' : 'first publish'}</small>
                  </label>
                </li>
              ))}
            </ul>
            <button className="adm-primary" disabled={busy || chosen.length === 0} onClick={publish}>
              {busy ? 'Publishing…' : `Publish ${chosen.length} section${chosen.length === 1 ? '' : 's'}`}
            </button>
          </>
        )}
        {err && <p className="adm-err" role="alert">{err}</p>}
        {current && <Progress pub={current} />}
      </section>

      <section className="adm-card">
        <h2>History</h2>
        {history.error && <p className="adm-err">{errorText(history.error)}</p>}
        {history.data && history.data.items.length === 0 && <p className="adm-empty">Nothing published yet.</p>}
        {history.data && history.data.items.length > 0 && (
          <div className="adm-table">
            <table>
              <thead><tr><th>#</th><th>When</th><th>Sections</th><th>Kirby</th><th>Website</th><th /></tr></thead>
              <tbody>
                {history.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{when(p.created_at)}</td>
                    <td>{p.sections.map((k) => LABEL[k] || k).join(', ')}</td>
                    <td><Status value={p.reindex_status} /></td>
                    <td><Status value={p.deploy_status} /></td>
                    <td>{p.deploy_status !== 'disabled' && <button className="adm-ghost" onClick={() => redeploy(p.id)}>Rebuild</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Revisions />
    </div>
  );
}

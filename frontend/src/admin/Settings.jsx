import { useState } from 'react';
import { api, errorText } from './api';
import { useLoad, when } from './hooks';

const fieldErrors = (e) => (e?.status === 422 ? e.errors.map((x) => x.msg).join(' ') : errorText(e));

function Account({ me, onMe }) {
  const [form, setForm] = useState({ display_name: me.display_name, email: me.email, phone: me.phone || '', current_password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const emailChanged = form.email.trim().toLowerCase() !== me.email;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    const body = {};
    if (form.display_name.trim() !== me.display_name) body.display_name = form.display_name.trim();
    if ((form.phone.trim() || null) !== (me.phone || null)) body.phone = form.phone.replace(/[\s()-]/g, '') || null;
    if (emailChanged) { body.email = form.email.trim(); body.current_password = form.current_password; }
    if (!Object.keys(body).length) return;
    setBusy(true); setMsg(null);
    try {
      const updated = await api.patch('/api/admin/account', body);
      onMe(updated);
      setForm((f) => ({ ...f, current_password: '' }));
      setMsg({ ok: true, text: 'Saved.' });
    } catch (ex) { setMsg({ ok: false, text: fieldErrors(ex) }); }
    setBusy(false);
  }

  return (
    <form className="adm-card adm-stack" onSubmit={save}>
      <h2>Account</h2>
      <label htmlFor="acc-name">Display name</label>
      <input id="acc-name" value={form.display_name} maxLength={80} onChange={set('display_name')} />
      <label htmlFor="acc-email">Email (sign-in and password resets)</label>
      <input id="acc-email" type="email" value={form.email} onChange={set('email')} />
      <label htmlFor="acc-phone">Phone (sign-in), international format</label>
      <input id="acc-phone" value={form.phone} placeholder="+91 98765 43210" onChange={set('phone')} />
      {emailChanged && (
        <>
          <label htmlFor="acc-cur">Current password (needed to change email)</label>
          <input id="acc-cur" type="password" autoComplete="current-password" value={form.current_password} onChange={set('current_password')} />
        </>
      )}
      <button className="adm-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      {msg && <p className={msg.ok ? 'adm-note is-ok' : 'adm-err'} role="status">{msg.text}</p>}
      <small className="adm-hint">Last sign-in {when(me.last_login_at)}</small>
    </form>
  );
}

function Password() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save(e) {
    e.preventDefault();
    if (next !== again) { setMsg({ ok: false, text: 'The new passwords do not match.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await api.post('/api/admin/account/password', { current_password: cur, new_password: next });
      setCur(''); setNext(''); setAgain('');
      setMsg({ ok: true, text: 'Password changed. Other devices were signed out.' });
    } catch (ex) { setMsg({ ok: false, text: fieldErrors(ex) }); }
    setBusy(false);
  }

  return (
    <form className="adm-card adm-stack" onSubmit={save}>
      <h2>Password</h2>
      <label htmlFor="pw-cur">Current password</label>
      <input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      <label htmlFor="pw-new">New password (12+ characters)</label>
      <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <label htmlFor="pw-again">Repeat new password</label>
      <input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      <button className="adm-primary" disabled={busy || !cur || next.length < 12}>{busy ? 'Saving…' : 'Change password'}</button>
      {msg && <p className={msg.ok ? 'adm-note is-ok' : 'adm-err'} role="status">{msg.text}</p>}
    </form>
  );
}

function Sessions({ onSignOut }) {
  const { data, error, reload } = useLoad((signal) => api.get('/api/admin/sessions', { signal }), []);
  const [err, setErr] = useState('');

  async function revoke(id) {
    try { await api.del(`/api/admin/sessions/${id}`); reload(); } catch (e) { setErr(errorText(e)); }
  }
  async function everywhere() {
    if (!confirm('Sign out on every device, including this one?')) return;
    try { await api.post('/api/admin/auth/logout-all'); } catch { /* signing out anyway */ }
    onSignOut();
  }

  return (
    <section className="adm-card">
      <h2>Signed-in devices</h2>
      {(error || err) && <p className="adm-err">{error ? errorText(error) : err}</p>}
      {data && (
        <ul className="adm-rows">
          {data.items.map((s) => (
            <li key={s.id}>
              <span className="adm-grow adm-clip" title={s.user_agent || ''}>{s.user_agent || 'Unknown device'}</span>
              <small className="adm-hint">{s.ip} · active {when(s.last_used_at)}</small>
              {s.current ? <small className="adm-badge is-ok">this device</small>
                : <button className="adm-ghost" onClick={() => revoke(s.id)}>Sign out</button>}
            </li>
          ))}
        </ul>
      )}
      <button className="adm-ghost is-danger" onClick={everywhere}>Sign out everywhere</button>
    </section>
  );
}

function Backup() {
  const [preview, setPreview] = useState(null);   // {doc, result}
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function exportAll() {
    setMsg(null);
    try {
      const data = await api.get('/api/admin/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `portfolio-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setMsg({ ok: false, text: errorText(e) }); }
  }

  async function choose(file) {
    if (!file) return;
    setMsg(null); setPreview(null);
    let doc;
    try { doc = JSON.parse(await file.text()); } catch { setMsg({ ok: false, text: 'That file is not valid JSON.' }); return; }
    try {
      setPreview({ doc, result: await api.post('/api/admin/import?dry_run=true', doc) });
    } catch (e) { setMsg({ ok: false, text: fieldErrors(e) }); }
  }

  async function apply() {
    setBusy(true);
    try {
      await api.post('/api/admin/import?dry_run=false', preview.doc);
      setMsg({ ok: true, text: 'Imported into drafts. Review under Content, then publish.' });
      setPreview(null);
    } catch (e) { setMsg({ ok: false, text: fieldErrors(e) }); }
    setBusy(false);
  }

  const changed = preview?.result.changes.filter((c) => c.changed) || [];
  return (
    <section className="adm-card adm-stack">
      <h2>Backup</h2>
      <p className="adm-sub">Download all content (drafts and live) as JSON, or load a backup into drafts. Importing never changes the live site until you publish.</p>
      <div className="adm-row">
        <button className="adm-ghost" onClick={exportAll}>Download backup</button>
        <label className="adm-ghost adm-file">
          Import a backup…
          <input type="file" accept="application/json,.json" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {preview && (
        <div className="adm-note">
          {preview.result.errors.length > 0 ? (
            <>
              <b>This file has problems:</b>
              <ul className="adm-errlist">{preview.result.errors.map((e, i) => <li key={i}>{e.field}: {e.msg}</li>)}</ul>
            </>
          ) : changed.length === 0 ? 'Nothing in this file differs from your drafts.' : (
            <>
              Will replace the drafts of: <b>{changed.map((c) => c.section).join(', ')}</b>.
              <div className="adm-row">
                <button className="adm-primary" disabled={busy} onClick={apply}>{busy ? 'Importing…' : 'Import'}</button>
                <button className="adm-ghost" onClick={() => setPreview(null)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className={msg.ok ? 'adm-note is-ok' : 'adm-err'} role="status">{msg.text}</p>}
    </section>
  );
}

function Audit() {
  const [offset, setOffset] = useState(0);
  const { data, error } = useLoad((signal) => api.get(`/api/admin/audit?limit=25&offset=${offset}`, { signal }), [offset]);
  return (
    <details className="adm-card adm-table">
      <summary>Activity log</summary>
      {error && <p className="adm-err">{errorText(error)}</p>}
      {data && (
        <>
          <table>
            <thead><tr><th>When</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className={a.action.startsWith('login.fail') || a.action === 'login.locked' ? 'is-bad' : ''}>
                  <td>{when(a.created_at)}</td><td>{a.action}</td><td>{a.target || ''}</td><td>{a.ip || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="adm-row adm-pager">
            <button className="adm-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Newer</button>
            <button className="adm-ghost" disabled={offset + 25 >= data.total} onClick={() => setOffset(offset + 25)}>Older</button>
          </div>
        </>
      )}
    </details>
  );
}

export default function Settings({ me, onMe, onSignOut }) {
  return (
    <div className="adm-body">
      <div className="adm-grid2">
        <Account me={me} onMe={onMe} />
        <Password />
      </div>
      <Sessions onSignOut={onSignOut} />
      <Backup />
      <Audit />
    </div>
  );
}

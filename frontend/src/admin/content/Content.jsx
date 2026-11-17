import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorText } from '../api';
import { when } from '../hooks';
import { EditorCtx } from './context';
import { FieldList } from './fields';
import { BLANKS, SECTIONS } from './schema';

const BACKUP_KEY = 'sm_admin_unsaved';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const readBackup = () => { try { return JSON.parse(localStorage.getItem(BACKUP_KEY)) || {}; } catch { return {}; } };
const writeBackup = (b) => { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(b)); } catch { /* storage full or blocked */ } };

function badge(state, edited) {
  if (edited) return ['unsaved', 'is-warn'];
  if (!state || state.version === 0) return ['empty', ''];
  if (!state.published) return ['never published', 'is-warn'];
  if (state.dirty) return ['not published', 'is-warn'];
  return ['live', 'is-ok'];
}

export default function Content() {
  const [states, setStates] = useState(null);        // server SectionState per key
  const [work, setWork] = useState({});              // working copies per key
  const [assets, setAssets] = useState([]);
  const [active, setActive] = useState(() => { try { return localStorage.getItem('sm_admin_section') || 'profile'; } catch { return 'profile'; } });
  const [errors, setErrors] = useState({});
  const [loadErr, setLoadErr] = useState('');
  const [msg, setMsg] = useState(null);              // {kind: 'ok'|'err'|'conflict'|'info', text, version?}
  const [busy, setBusy] = useState(false);
  const [restoredKeys, setRestoredKeys] = useState(() => new Set());

  const reloadAssets = useCallback(async () => {
    const res = await api.get('/api/admin/uploads');
    setAssets(res.items);
  }, []);

  // Load everything once; adopt this browser's unsaved edits when they still apply.
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([api.get('/api/admin/content', { signal: ctrl.signal }), api.get('/api/admin/uploads', { signal: ctrl.signal })])
      .then(([content, uploads]) => {
        const backup = readBackup();
        const initial = {};
        const adopted = new Set();
        for (const [key, st] of Object.entries(content.sections)) {
          const server = st.draft ?? structuredClone(BLANKS[key]);
          const b = backup[key];
          if (b && b.version === st.version && !same(b.data, server)) {
            initial[key] = b.data;
            adopted.add(key);
          } else {
            initial[key] = server;
          }
        }
        setRestoredKeys(adopted);
        setStates(content.sections);
        setWork(initial);
        setAssets(uploads.items);
      })
      .catch((e) => { if (e.name !== 'AbortError') setLoadErr(errorText(e)); });
    return () => ctrl.abort();
  }, []);

  const serverCopy = useCallback((key) => states?.[key]?.draft ?? BLANKS[key], [states]);
  const edited = useCallback((key) => states && work[key] !== undefined && !same(work[key], serverCopy(key)), [states, work, serverCopy]);
  const anyEdited = useMemo(() => SECTIONS.some((s) => edited(s.key)), [edited]);

  // Keep a local backup of unsaved edits; warn before leaving the page with any.
  useEffect(() => {
    if (!states) return undefined;
    const t = setTimeout(() => {
      const backup = {};
      for (const s of SECTIONS) if (edited(s.key)) backup[s.key] = { version: states[s.key].version, data: work[s.key] };
      writeBackup(backup);
    }, 400);
    return () => clearTimeout(t);
  }, [work, states, edited]);

  useEffect(() => {
    if (!anyEdited) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [anyEdited]);

  const pick = (key) => {
    setActive(key); setErrors({}); setMsg(null);
    try { localStorage.setItem('sm_admin_section', key); } catch { /* ignore */ }
  };

  const save = useCallback(async (overwriteVersion) => {
    const key = active;
    setBusy(true); setMsg(null);
    try {
      const version = overwriteVersion ?? states[key].version;
      const st = await api.put(`/api/admin/content/${key}`, { data: work[key], version });
      setStates((s) => ({ ...s, [key]: st }));
      setWork((w) => ({ ...w, [key]: st.draft }));   // normalized by the server (ids, trimming)
      setErrors({});
      setRestoredKeys((s) => { const n = new Set(s); n.delete(key); return n; });
      setMsg({ kind: 'ok', text: 'Saved as a draft. Publish to put it live.' });
    } catch (e) {
      if (e.status === 422) {
        setErrors(Object.fromEntries(e.errors.map((x) => [x.field, x.msg])));
        setMsg({ kind: 'err', text: e.errors.length ? `Fix ${e.errors.length} field${e.errors.length > 1 ? 's' : ''} below.` : e.message });
      } else if (e.status === 409) {
        setMsg({ kind: 'conflict', text: 'This section was changed somewhere else since you opened it.', version: e.data.current_version });
      } else {
        setMsg({ kind: 'err', text: `${errorText(e)} Your edits are kept in this browser.` });
      }
    }
    setBusy(false);
  }, [active, states, work]);

  async function reloadLatest() {
    const st = await api.get(`/api/admin/content/${active}`);
    setStates((s) => ({ ...s, [active]: st }));
    setWork((w) => ({ ...w, [active]: st.draft ?? structuredClone(BLANKS[active]) }));
    setErrors({}); setMsg({ kind: 'info', text: 'Loaded the latest version. Your edits were dropped.' });
  }

  async function discardDraft() {
    if (!confirm('Throw away the saved draft and go back to the live version?')) return;
    setBusy(true);
    try {
      const st = await api.post(`/api/admin/content/${active}/discard`);
      setStates((s) => ({ ...s, [active]: st }));
      setWork((w) => ({ ...w, [active]: st.draft }));
      setErrors({}); setMsg({ kind: 'info', text: 'Draft reset to the live version.' });
    } catch (e) { setMsg({ kind: 'err', text: errorText(e) }); }
    setBusy(false);
  }

  // Ctrl/Cmd+S saves the open section.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!busy && edited(active)) save();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [busy, active, edited, save]);

  if (loadErr) return <p className="adm-err adm-banner" role="alert">{loadErr}</p>;
  if (!states) return <p className="adm-empty">Loading content…</p>;

  const section = SECTIONS.find((s) => s.key === active) || SECTIONS[0];
  const st = states[section.key];
  const isEdited = edited(section.key);
  const unknownErrors = Object.entries(errors).filter(([field]) => !field || !field.includes('.') && !section.fields.some((f) => f.k === field));

  return (
    <div className="adm-editor">
      <nav className="adm-card adm-sects" aria-label="Content sections">
        {SECTIONS.map((s) => {
          const [text, cls] = badge(states[s.key], edited(s.key));
          return (
            <button key={s.key} className={s.key === section.key ? 'is-on' : ''} onClick={() => pick(s.key)}>
              <span>{s.label}</span>
              <small className={'adm-badge ' + cls}>{text}</small>
            </button>
          );
        })}
        <a className="adm-link adm-gopub" href="#publish">Go to Publish →</a>
      </nav>

      <section className="adm-card adm-form" aria-label={`${section.label} editor`}>
        <header className="adm-formhead">
          <div>
            <h2>{section.label}</h2>
            <p className="adm-sub">{section.hint}</p>
            <p className="adm-meta">
              Draft v{st.version}{st.draft_updated_at ? ` · saved ${when(st.draft_updated_at)}` : ''}
              {st.published_at ? ` · live since ${when(st.published_at)}` : ' · not live yet'}
            </p>
          </div>
        </header>

        {restoredKeys.has(section.key) && isEdited && (
          <p className="adm-note">Restored unsaved edits from this browser.</p>
        )}
        {msg && (
          <div className={'adm-note ' + (msg.kind === 'ok' ? 'is-ok' : msg.kind === 'info' ? '' : 'is-bad')} role="status">
            {msg.text}
            {msg.kind === 'conflict' && (
              <span className="adm-row">
                <button type="button" className="adm-ghost" onClick={reloadLatest}>Load latest (drop my edits)</button>
                <button type="button" className="adm-ghost" onClick={() => save(msg.version)}>Overwrite with mine</button>
              </span>
            )}
          </div>
        )}
        {unknownErrors.length > 0 && (
          <ul className="adm-errlist">{unknownErrors.map(([f, m]) => <li key={f}>{f ? `${f}: ` : ''}{m}</li>)}</ul>
        )}

        <EditorCtx.Provider value={{ errors, assets, reloadAssets }}>
          <div className="adm-fields">
            <FieldList fields={section.fields} value={work[section.key]} path={[]}
              onChange={(v) => setWork((w) => ({ ...w, [section.key]: v }))} />
          </div>
        </EditorCtx.Provider>

        <footer className="adm-formfoot">
          <button type="button" className="adm-primary" disabled={busy || !isEdited} onClick={() => save()}>
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          {isEdited && (
            <button type="button" className="adm-ghost" disabled={busy}
              onClick={() => { setWork((w) => ({ ...w, [section.key]: structuredClone(serverCopy(section.key)) })); setErrors({}); setMsg(null); }}>
              Undo my edits
            </button>
          )}
          {st.dirty && st.published && !isEdited && (
            <button type="button" className="adm-ghost" disabled={busy} onClick={discardDraft}>Reset draft to live</button>
          )}
          <span className="adm-spacer" />
          <small className="adm-hint">Ctrl+S saves</small>
        </footer>
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { api, errorText } from './api';
import { useLoad, when } from './hooks';

const PAGE_SECTIONS = ['', 'hero', 'about', 'projects', 'experience', 'contact'];

function IndexCard() {
  const { data, error, setData } = useLoad((signal) => api.get('/api/admin/kirby/index', { signal }), []);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (data?.status !== 'running') return undefined;
    const t = setTimeout(async () => { try { setData(await api.get('/api/admin/kirby/index')); } catch { /* retry */ } }, 2000);
    return () => clearTimeout(t);
  }, [data, setData]);

  async function reindex() {
    setErr('');
    try { setData(await api.post('/api/admin/kirby/reindex')); } catch (e) { setErr(errorText(e)); }
  }

  return (
    <section className="adm-card">
      <h2>Knowledge index</h2>
      <p className="adm-sub">Kirby searches this index, built from published content and Knowledge notes. Publishing rebuilds it automatically.</p>
      {error && <p className="adm-err">{errorText(error)}</p>}
      {data && (
        <dl className="adm-dl">
          <dt>Status</dt><dd>{data.status}</dd>
          <dt>Chunks</dt><dd>{data.chunks}</dd>
          <dt>Last built</dt><dd>{when(data.last_indexed_at)}</dd>
          <dt>Embedding model</dt><dd>{data.model || '—'}</dd>
          {data.last_error && <><dt>Last error</dt><dd className="adm-err">{data.last_error}</dd></>}
        </dl>
      )}
      <button className="adm-ghost" disabled={data?.status === 'running'} onClick={reindex}>
        {data?.status === 'running' ? 'Rebuilding…' : 'Rebuild now'}
      </button>
      {err && <p className="adm-err" role="alert">{err}</p>}
    </section>
  );
}

function Playground() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [useDraft, setUseDraft] = useState(true);
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [last, setLast] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  async function send(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    const next = [...messages, { role: 'user', content: q }].slice(-20);
    setMessages(next); setInput(''); setBusy(true); setErr('');
    try {
      const res = await api.post('/api/admin/kirby/playground', { messages: next, use_draft: useDraft, current_section: section || null });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, mood: res.mood, section: res.section }]);
      setLast(res.debug);
    } catch (ex) { setErr(errorText(ex)); }
    setBusy(false);
  }

  return (
    <section className="adm-card">
      <h2>Playground</h2>
      <p className="adm-sub">Chat with Kirby without it being logged or counted. Uses your draft personality when ticked.</p>
      <div className="adm-row">
        <label className="adm-check"><input type="checkbox" checked={useDraft} onChange={(e) => setUseDraft(e.target.checked)} /> Use draft personality</label>
        <label className="adm-sub" htmlFor="pg-sec">Visitor is on</label>
        <select id="pg-sec" value={section} onChange={(e) => setSection(e.target.value)}>
          {PAGE_SECTIONS.map((s) => <option key={s} value={s}>{s || 'any section'}</option>)}
        </select>
        <span className="adm-spacer" />
        <button className="adm-ghost" onClick={() => { setMessages([]); setLast(null); }}>Clear</button>
      </div>
      <div className="adm-thread adm-pg" aria-live="polite">
        {messages.length === 0 && <p className="adm-empty">Ask something a visitor would ask.</p>}
        {messages.map((m, i) => (
          <div key={i} className={'adm-msg is-' + m.role}>
            <small>{m.role === 'user' ? 'You' : `Kirby${m.mood ? ` · ${m.mood}` : ''}${m.section ? ` · scrolls to ${m.section}` : ''}`}</small>
            <p>{m.content}</p>
          </div>
        ))}
        {busy && <p className="adm-empty">Kirby is thinking…</p>}
        <div ref={endRef} />
      </div>
      <form className="adm-row" onSubmit={send}>
        <input className="adm-grow" value={input} maxLength={1000} onChange={(e) => setInput(e.target.value)} placeholder="Ask Kirby…" aria-label="Message" />
        <button className="adm-primary" disabled={busy || !input.trim()}>Send</button>
      </form>
      {err && <p className="adm-err" role="alert">{err}</p>}
      {last && (
        <details className="adm-table">
          <summary>
            What Kirby used · {last.latency_ms} ms · {last.model}{last.unanswered ? ' · counted as unanswered' : ''}
          </summary>
          <p className="adm-sub">Tools: {last.tool_calls.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join(', ') || 'none'}</p>
          <ol className="adm-chunks">
            {last.chunks.map((c, i) => <li key={i}><b>{c.score.toFixed(2)}</b> <small>{c.section || 'note'}</small> {c.text}</li>)}
          </ol>
        </details>
      )}
    </section>
  );
}

function AnswerForm({ question, onDone }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api.post('/api/admin/questions/answer', { question: question.slice(0, 300), answer: answer.trim() });
      onDone();
    } catch (ex) { setErr(errorText(ex)); setBusy(false); }
  }
  return (
    <form className="adm-answer" onSubmit={submit}>
      <textarea rows={2} maxLength={1000} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="The answer Kirby should give" aria-label={`Answer to: ${question}`} autoFocus />
      <button className="adm-primary" disabled={busy || !answer.trim()}>Add to FAQ</button>
      {err && <small className="adm-ferr">{err}</small>}
    </form>
  );
}

function Unanswered() {
  const [days, setDays] = useState(30);
  const { data, error, reload } = useLoad((signal) => api.get(`/api/admin/questions/unanswered?days=${days}`, { signal }), [days]);
  const [answering, setAnswering] = useState(null);
  const [added, setAdded] = useState(0);

  return (
    <section className="adm-card">
      <h2>Questions Kirby couldn&apos;t answer</h2>
      <div className="adm-row">
        <p className="adm-sub">Answer one and it becomes an FAQ in the Knowledge draft. Publish to teach Kirby.</p>
        <span className="adm-spacer" />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range">
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>
      {added > 0 && <p className="adm-note is-ok">{added} answer{added > 1 ? 's' : ''} added to the Knowledge draft. <a className="adm-link" href="#publish">Publish</a></p>}
      {error && <p className="adm-err">{errorText(error)}</p>}
      {data && data.items.length === 0 && <p className="adm-empty">Nothing unanswered. Nice.</p>}
      {data && data.items.length > 0 && (
        <ul className="adm-qs">
          {data.items.map((q) => (
            <li key={q.question}>
              <div className="adm-row">
                <span className="adm-grow">{q.question}</span>
                <small className="adm-badge">{q.count}×</small>
                <small className="adm-hint">{when(q.last_at)}</small>
                <button className="adm-ghost" onClick={() => setAnswering(answering === q.question ? null : q.question)}>
                  {answering === q.question ? 'Cancel' : 'Answer'}
                </button>
              </div>
              {answering === q.question && (
                <AnswerForm question={q.question} onDone={() => { setAnswering(null); setAdded((n) => n + 1); reload(); }} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function KirbyAdmin() {
  return (
    <div className="adm-body">
      <p className="adm-sub">Edit Kirby&apos;s name, tone and tour lines under <a className="adm-link" href="#content">Content → Kirby</a>, and extra facts under Content → Knowledge.</p>
      <div className="adm-grid2">
        <IndexCard />
        <Unanswered />
      </div>
      <Playground />
    </div>
  );
}

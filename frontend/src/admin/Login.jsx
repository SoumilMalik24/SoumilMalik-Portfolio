import { useState } from 'react';
import { errorText, forgotPassword, login, resetPassword } from './api';
import { useServerStatus } from './hooks';

const resetTokenFromUrl = () => new URLSearchParams(location.search).get('reset') || '';

function ServerStrip({ status }) {
  const { state, elapsed, retry } = status;
  if (state === 'ready') return null;
  if (state === 'checking') return <p className="adm-strip">Checking the server…</p>;
  if (state === 'offline') {
    return (
      <p className="adm-strip is-bad" role="alert">
        The server isn&apos;t responding. <button type="button" className="adm-link" onClick={retry}>Try again</button>
      </p>
    );
  }
  return (
    <div className="adm-strip" role="status">
      <span>Waking the server… {elapsed}s</span>
      <small>It sleeps when idle and can take up to a minute to start. You can sign in now; it will go through once it&apos;s up.</small>
      <span className="adm-track"><span style={{ width: `${Math.min(100, (elapsed / 60) * 100)}%`, background: 'var(--a-hot)' }} /></span>
    </div>
  );
}

function SignIn({ onSignedIn, notice, status, onForgot }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [err, setErr] = useState('');

  async function attempt() {
    setBusy(true); setErr('');
    try {
      onSignedIn(await login(identifier.trim(), password));
    } catch (ex) {
      setErr(ex.status === 401 ? 'Wrong email/phone or password.'
        : ex.status === 423 ? 'Too many wrong passwords. The account is locked for 15 minutes.'
        : ex.status === 429 ? 'Too many attempts from this network. Try again in a few minutes.'
        : errorText(ex));
      setBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!identifier.trim() || !password || busy || queued) return;
    if (status.state !== 'ready') {
      // Pressed while the server is waking: send the sign-in as soon as it answers.
      setQueued(true); setErr('');
      const up = await status.whenReady();
      setQueued(false);
      if (!up) { setErr('The server did not start. Try again.'); return; }
    }
    attempt();
  }

  return (
    <form onSubmit={submit} className="adm-card adm-loginbox">
      <h1>Admin</h1>
      {notice && <p className="adm-sub">{notice}</p>}
      <ServerStrip status={status} />
      <label htmlFor="id">Email or phone</label>
      <input id="id" autoFocus autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={busy} />
      <label htmlFor="pw">Password</label>
      <input id="pw" type="password" autoComplete="current-password" value={password}
        onChange={(e) => setPassword(e.target.value)} disabled={busy} />
      <button type="submit" disabled={busy || queued || !identifier.trim() || !password}>
        {queued ? 'Waiting for the server…' : busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="adm-err" role="alert">{err}</p>
      <button type="button" className="adm-link" onClick={onForgot}>Forgot password?</button>
    </form>
  );
}

function Forgot({ onBack }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setState('busy'); setErr('');
    try { await forgotPassword(email.trim()); setState('sent'); } catch (ex) { setErr(errorText(ex)); setState('idle'); }
  }

  return (
    <form onSubmit={submit} className="adm-card adm-loginbox">
      <h1>Reset password</h1>
      {state === 'sent' ? (
        <p className="adm-sub">If that email belongs to an admin, a reset link is on its way. It expires in 30 minutes.</p>
      ) : (
        <>
          <label htmlFor="em">Account email</label>
          <input id="em" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={state === 'busy' || !email.trim()}>{state === 'busy' ? 'Sending…' : 'Send reset link'}</button>
        </>
      )}
      <p className="adm-err" role="alert">{err}</p>
      <button type="button" className="adm-link" onClick={onBack}>Back to sign in</button>
    </form>
  );
}

function Reset({ resetToken, onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr('');
    try {
      await resetPassword(resetToken, pw);
      history.replaceState(null, '', location.pathname);
      onDone('Password changed. Sign in with your new password.');
    } catch (ex) {
      setErr(ex.status === 422 ? ex.errors.map((x) => x.msg).join(' ') : errorText(ex));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="adm-card adm-loginbox">
      <h1>Choose a new password</h1>
      <p className="adm-sub">At least 12 characters, not containing your email name.</p>
      <label htmlFor="np">New password</label>
      <input id="np" type="password" autoFocus autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <label htmlFor="np2">Repeat it</label>
      <input id="np2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      <button type="submit" disabled={busy || pw.length < 12}>{busy ? 'Saving…' : 'Set password'}</button>
      <p className="adm-err" role="alert">{err}</p>
    </form>
  );
}

export default function Login({ onSignedIn, notice }) {
  const status = useServerStatus();
  const [mode, setMode] = useState(() => (resetTokenFromUrl() ? 'reset' : 'signin'));
  const [info, setInfo] = useState('');

  return (
    <main className="adm adm-login">
      {mode === 'signin' && <SignIn onSignedIn={onSignedIn} notice={info || notice} status={status} onForgot={() => setMode('forgot')} />}
      {mode === 'forgot' && <Forgot onBack={() => setMode('signin')} />}
      {mode === 'reset' && <Reset resetToken={resetTokenFromUrl()} onDone={(m) => { setInfo(m); setMode('signin'); }} />}
    </main>
  );
}

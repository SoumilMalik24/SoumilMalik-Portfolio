import { useCallback, useEffect, useState } from 'react';
import './admin.css';
import './admin-ui.css';
import { api, setAuth } from './api';
import Login from './Login';
import Shell from './Shell';

const KEY = 'sm_admin_token';
const read = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };
const store = (t) => { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } };

export default function Admin() {
  const [token, setToken] = useState(read);
  const [me, setMe] = useState(null);
  const [notice, setNotice] = useState('');
  const [meError, setMeError] = useState('');
  const [meTry, setMeTry] = useState(0);

  const endSession = useCallback((message) => {
    store('');
    setAuth('');
    setToken('');
    setMe(null);
    setNotice(message || '');
  }, []);

  useEffect(() => {
    document.title = 'Admin';
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    const prev = document.body.style.background;
    document.body.style.background = '#0b0c0e';
    return () => { meta.remove(); document.body.style.background = prev; };
  }, []);

  // Keep the API client in sync; a 401 anywhere ends the session.
  setAuth(token, () => endSession('Your session ended. Please sign in again.'));

  // Restore a stored session: confirm the token still works.
  useEffect(() => {
    if (!token || me) return undefined;
    const ctrl = new AbortController();
    api.get('/api/admin/auth/me', { signal: ctrl.signal })
      .then(setMe)
      .catch((e) => { if (e.name !== 'AbortError' && e.status !== 401) setMeError(e.message); });
    return () => ctrl.abort();
  }, [token, me, meTry]);

  const signIn = useCallback(({ token: t, admin }) => {
    store(t);
    try { localStorage.setItem('sm_notrack', '1'); } catch { /* keep my own visits out of the numbers */ }
    setAuth(t);
    setToken(t);
    setMe(admin);
    setNotice('');
  }, []);

  const signOut = useCallback(async () => {
    try { await api.post('/api/admin/auth/logout'); } catch { /* already gone */ }
    endSession('');
  }, [endSession]);

  if (!token) return <Login onSignedIn={signIn} notice={notice} />;
  if (!me) {
    return (
      <main className="adm">
        {meError
          ? <p className="adm-err" role="alert">{meError} <button className="adm-ghost" onClick={() => { setMeError(''); setMeTry((n) => n + 1); }}>Retry</button></p>
          : <p className="adm-empty">Loading…</p>}
      </main>
    );
  }
  return <Shell me={me} onMe={setMe} onSignOut={signOut} />;
}

import { lazy, Suspense, useEffect, useState } from 'react';
import Overview from './Overview';

const Content = lazy(() => import('./content/Content'));
const Publish = lazy(() => import('./Publish'));
const KirbyAdmin = lazy(() => import('./KirbyAdmin'));
const Chats = lazy(() => import('./Chats'));
const Inbox = lazy(() => import('./Inbox'));
const Settings = lazy(() => import('./Settings'));

const TABS = [
  ['overview', 'Overview'],
  ['content', 'Content'],
  ['publish', 'Publish'],
  ['kirby', 'Kirby'],
  ['chats', 'Chats'],
  ['inbox', 'Inbox'],
  ['settings', 'Settings'],
];
const ids = TABS.map(([id]) => id);
const fromHash = () => { const h = location.hash.slice(1); return ids.includes(h) ? h : 'overview'; };

export default function Shell({ me, onMe, onSignOut }) {
  const [tab, setTab] = useState(fromHash);

  useEffect(() => {
    const onHash = () => setTab(fromHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  const go = (id) => { if (id !== tab) location.assign(`#${id}`); };

  return (
    <main className="adm">
      <header className="adm-top">
        <h1>Admin</h1>
        <nav className="adm-tabs" aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'is-on' : ''} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}>
              {label}
            </button>
          ))}
        </nav>
        <div className="adm-spacer" />
        <span className="adm-who">{me.display_name}</span>
        <button className="adm-ghost" onClick={onSignOut}>Sign out</button>
      </header>
      <Suspense fallback={<p className="adm-empty">Loading…</p>}>
        {tab === 'overview' && <Overview />}
        {tab === 'content' && <Content />}
        {tab === 'publish' && <Publish />}
        {tab === 'kirby' && <KirbyAdmin />}
        {tab === 'chats' && <Chats />}
        {tab === 'inbox' && <Inbox />}
        {tab === 'settings' && <Settings me={me} onMe={onMe} onSignOut={onSignOut} />}
      </Suspense>
    </main>
  );
}

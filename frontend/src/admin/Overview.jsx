import { useEffect, useState } from 'react';
import { api, errorText } from './api';
import { DailyChart, SectionFunnel, SplitBar } from './charts';
import { COLORS } from './colors';
import { delta, fmtDate, fmtDur, fmtInt, fmtPct } from './format';
import { useLoad, when } from './hooks';

const RANGES = [7, 30, 90];

function Kpi({ label, value, change, goodWhenDown }) {
  const up = change !== null && change > 0, down = change !== null && change < 0;
  return (
    <div className="adm-card adm-kpi">
      <span className="adm-kl">{label}</span>
      <strong>{value}</strong>
      {change !== undefined && (
        <span className={'adm-kd' + ((up && goodWhenDown) || (down && !goodWhenDown) ? ' is-bad' : '')}>
          {change === null ? 'no prior data' : `${up ? '▲' : down ? '▼' : '–'} ${Math.abs(change).toFixed(0)}% vs previous`}
        </span>
      )}
    </div>
  );
}

function SystemCard() {
  const { data, error } = useLoad((signal) => api.get('/api/admin/system', { signal }), []);
  if (error) return <section className="adm-card"><h2>System</h2><p className="adm-err">{errorText(error)}</p></section>;
  if (!data) return null;
  const k = data.kirby;
  const pub = data.last_publish;
  return (
    <section className="adm-card">
      <h2>System</h2>
      <dl className="adm-dl">
        <dt>Server</dt><dd>up {fmtDur(data.uptime_s)} · v{data.version} · {data.db.ok ? data.db.dialect : 'database down'}</dd>
        <dt>Kirby</dt><dd>{k.state} · {k.chunks} knowledge chunks · indexed {when(k.last_indexed_at)}</dd>
        <dt>Last publish</dt><dd>{pub ? `#${pub.id} ${when(pub.created_at)} · site ${pub.deploy_status}` : 'never'}</dd>
        <dt>Uploads</dt><dd>{data.storage.assets} files · {(data.storage.bytes / 1048576).toFixed(1)} MB ({data.storage.backend})</dd>
        <dt>Inbox</dt><dd>{data.counts.inbox_unread} unread</dd>
      </dl>
    </section>
  );
}

function KirbyCard({ kirby }) {
  return (
    <section className="adm-card">
      <h2>Kirby</h2>
      <div className="adm-kpis adm-kpis--sm">
        <Kpi label="Conversations" value={fmtInt(kirby.conversations)} />
        <Kpi label="Messages" value={fmtInt(kirby.messages)} />
        <Kpi label="Couldn't answer" value={fmtPct(kirby.unanswered_rate)} />
      </div>
      {kirby.top_questions.length > 0 && (
        <>
          <h3 className="adm-h3">Most asked</h3>
          <ul className="adm-refs">
            {kirby.top_questions.map((q) => (
              <li key={q.question}>
                <span className="adm-clip">{q.question}</span>
                <span className="adm-track"><span style={{ width: `${(q.count / kirby.top_questions[0].count) * 100}%`, background: COLORS.bar }} /></span>
                <b>{q.count}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default function Overview() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const d = await api.get(`/api/admin/metrics?days=${days}&tz=${-new Date().getTimezoneOffset()}`);
        if (alive) { setData(d); setErr(''); }
      } catch (ex) {
        if (alive) setErr(errorText(ex));
      }
    };
    run();
    const t = setInterval(run, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [days, reload]);

  const t = data?.totals, p = data?.prev_totals;
  const empty = data && t.sessions === 0;
  const loading = data && data.range_days !== days;

  return (
    <>
      <div className="adm-bar">
        {data && <span className="adm-live"><i />{data.live} live now</span>}
        <div className="adm-spacer" />
        <div className="adm-range" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} className={r === days ? 'is-on' : ''} onClick={() => setDays(r)} aria-pressed={r === days}>{r} days</button>
          ))}
        </div>
        <button className="adm-ghost" onClick={() => setReload((n) => n + 1)}>Refresh</button>
      </div>

      {err && <p className="adm-err adm-banner" role="alert">{err}</p>}
      {!data && !err && <p className="adm-empty">Loading…</p>}

      {data && (
        <div className={'adm-body' + (loading ? ' is-loading' : '')}>
          <section className="adm-kpis" aria-label="Summary">
            <Kpi label="Visitors" value={fmtInt(t.visitors)} change={delta(t.visitors, p.visitors)} />
            <Kpi label="Sessions" value={fmtInt(t.sessions)} change={delta(t.sessions, p.sessions)} />
            <Kpi label="Avg time on site" value={fmtDur(t.avg_duration_s)} change={delta(t.avg_duration_s, p.avg_duration_s)} />
            <Kpi label="Bounce rate" value={fmtPct(t.bounce_rate)} change={delta(t.bounce_rate, p.bounce_rate)} goodWhenDown />
            <Kpi label="Returning visitors" value={fmtPct(t.returning_visitor_rate)} change={null} />
          </section>

          {empty && <p className="adm-empty adm-card">No visits in this range yet. They show up here as people land on the site.</p>}

          <section className="adm-card">
            <h2>Visits per day</h2>
            <DailyChart daily={data.daily} />
            {data.publishes?.length > 0 && (
              <p className="adm-sub adm-pubs">
                Published: {data.publishes.map((x) => when(x.created_at)).join(' · ')}
              </p>
            )}
          </section>

          <div className="adm-grid2">
            <KirbyCard kirby={data.kirby} />
            <SystemCard />
          </div>

          <section className="adm-card">
            <h2>Where visitors stay and where they leave</h2>
            <p className="adm-sub">
              {data.best_section
                ? <>Visitors spend the longest in <b>{data.best_section}</b>. “Left here” is the last section a visit reached.</>
                : 'Not enough data to pick a most engaging section yet.'}
            </p>
            <SectionFunnel sections={data.sections} best={data.best_section} />
            <p className="adm-sub">Average scroll depth: {t.avg_scroll_pct.toFixed(0)}% of the page.</p>
          </section>

          <div className="adm-grid2">
            <section className="adm-card">
              <h2>New vs returning</h2>
              <SplitBar label="New versus returning visitors" parts={[
                { name: 'New', value: data.visitor_mix.new, color: COLORS.orange },
                { name: 'Returning', value: data.visitor_mix.returning, color: COLORS.blue },
              ]} />
            </section>
            <section className="adm-card">
              <h2>Devices</h2>
              <SplitBar label="Sessions by device" parts={[
                { name: 'Desktop', value: data.devices.desktop, color: COLORS.orange },
                { name: 'Mobile', value: data.devices.mobile, color: COLORS.blue },
                { name: 'Tablet', value: data.devices.tablet, color: COLORS.green },
              ]} />
            </section>
          </div>

          <section className="adm-card">
            <h2>Where they come from</h2>
            {data.referrers.length === 0 ? <p className="adm-empty">No data yet</p> : (
              <ul className="adm-refs">
                {data.referrers.map((r) => (
                  <li key={r.source}>
                    <span>{r.source}</span>
                    <span className="adm-track"><span style={{ width: `${(r.sessions / data.referrers[0].sessions) * 100}%`, background: COLORS.bar }} /></span>
                    <b>{fmtInt(r.sessions)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <details className="adm-card adm-table">
            <summary>View data as a table</summary>
            <table>
              <thead><tr><th>Date</th><th>Sessions</th><th>Visitors</th></tr></thead>
              <tbody>{data.daily.map((d) => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{d.sessions}</td><td>{d.visitors}</td></tr>)}</tbody>
            </table>
          </details>
        </div>
      )}
    </>
  );
}

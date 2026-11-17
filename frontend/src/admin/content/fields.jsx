import { useContext, useId, useRef, useState } from 'react';
import { api, errorText } from '../api';
import { EditorCtx } from './context';

const join = (path) => path.join('.');

function useFieldError(path) {
  const { errors } = useContext(EditorCtx);
  return errors[join(path)];
}

/** True when any error sits at or under `path` (used to flag collapsed list items). */
function useHasErrorsUnder(path) {
  const { errors } = useContext(EditorCtx);
  const p = join(path);
  return Object.keys(errors).some((k) => k === p || k.startsWith(`${p}.`));
}

function Counter({ value, max }) {
  const n = (value || '').length;
  if (!max || n < max * 0.8) return null;
  return <small className={'adm-count' + (n > max ? ' is-bad' : '')}>{n}/{max}</small>;
}

function Wrap({ f, path, id, children, inline }) {
  const err = useFieldError(path);
  return (
    <div className={'adm-field' + (inline ? ' adm-field--inline' : '') + (err ? ' has-err' : '')}>
      {f.label && <label htmlFor={id}>{f.label}</label>}
      {children}
      {f.hint && <small className="adm-hint">{f.hint}</small>}
      {err && <small className="adm-ferr" role="alert">{err}</small>}
    </div>
  );
}

function TagsInput({ id, value, onChange, f }) {
  const fmt = (v) => (v || []).join(', ');
  const parse = (t) => t.split(',').map((x) => x.trim()).filter(Boolean);
  const [raw, setRaw] = useState(fmt(value));
  const [seen, setSeen] = useState(value);
  // Follow outside changes (discard, restore) without fighting the user's typing.
  if (value !== seen) {
    setSeen(value);
    if (fmt(parse(raw)) !== fmt(value)) setRaw(fmt(value));
  }
  return (
    <>
      <input id={id} value={raw} placeholder="Comma, separated, values"
        onChange={(e) => { setRaw(e.target.value); onChange(parse(e.target.value)); }} />
      {f.maxItems && (value || []).length > f.maxItems && <small className="adm-ferr">At most {f.maxItems}.</small>}
    </>
  );
}

function AssetField({ id, value, onChange, f }) {
  const { assets, reloadAssets } = useContext(EditorCtx);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const options = assets.filter((a) => a.kind === f.kind);
  const current = assets.find((a) => a.id === value);

  async function upload(file) {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const asset = await api.upload(f.kind, file);
      await reloadAssets();
      onChange(asset.id);
    } catch (ex) { setErr(errorText(ex)); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="adm-asset">
      {current && f.kind === 'image' && <img src={current.url} alt="" />}
      {current && f.kind !== 'image' && <a href={current.url} target="_blank" rel="noopener noreferrer">{current.original_name}</a>}
      {value && !current && <small className="adm-ferr">Selected file no longer exists.</small>}
      <div className="adm-row">
        <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{f.kind === 'image' ? 'No image' : 'None (use default)'}</option>
          {options.map((a) => <option key={a.id} value={a.id}>{a.original_name}{a.width ? ` (${a.width}×${a.height})` : ''}</option>)}
        </select>
        <button type="button" className="adm-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" hidden accept={f.kind === 'image' ? 'image/png,image/jpeg,image/webp' : 'application/pdf'}
          onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {err && <small className="adm-ferr" role="alert">{err}</small>}
    </div>
  );
}

function move(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ItemTools({ i, n, onMove, onRemove, label }) {
  return (
    <span className="adm-itools">
      <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move ${label} up`}>↑</button>
      <button type="button" onClick={() => onMove(i, 1)} disabled={i === n - 1} aria-label={`Move ${label} down`}>↓</button>
      <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${label}`}>✕</button>
    </span>
  );
}

function TextList({ f, value, path, onChange }) {
  const items = value || [];
  const Tag = f.multiline ? 'textarea' : 'input';
  return (
    <div className="adm-tlist">
      {items.map((v, i) => (
        <TextListItem key={i} path={[...path, i]}>
          <Tag value={v} rows={f.multiline ? 4 : undefined} aria-label={`${f.label} ${i + 1}`}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <ItemTools i={i} n={items.length} label={`item ${i + 1}`}
            onMove={(a, d) => onChange(move(items, a, d))} onRemove={(a) => onChange(items.filter((_, j) => j !== a))} />
          <Counter value={v} max={f.max} />
        </TextListItem>
      ))}
      {(!f.maxItems || items.length < f.maxItems) && (
        <button type="button" className="adm-add" onClick={() => onChange([...items, ''])}>+ Add</button>
      )}
    </div>
  );
}

function TextListItem({ path, children }) {
  const err = useFieldError(path);
  return (
    <div className={'adm-tli' + (err ? ' has-err' : '')}>
      {children}
      {err && <small className="adm-ferr" role="alert">{err}</small>}
    </div>
  );
}

function ListItem({ f, item, i, n, path, onItem, onMove, onRemove, defaultOpen }) {
  const bad = useHasErrorsUnder(path);
  const title = f.itemTitle ? f.itemTitle(item) : `Item ${i + 1}`;
  return (
    <details className={'adm-item' + (bad ? ' has-err' : '')} open={defaultOpen || undefined}>
      <summary>
        <span className="adm-ititle">{title}</span>
        <ItemTools i={i} n={n} label={title} onMove={onMove} onRemove={onRemove} />
      </summary>
      <div className="adm-ibody">
        <FieldList fields={f.fields} value={item} path={path} onChange={onItem} />
      </div>
    </details>
  );
}

function ListField({ f, value, path, onChange }) {
  const items = value || [];
  const [added, setAdded] = useState(-1);
  return (
    <div className="adm-list">
      {items.map((item, i) => (
        <ListItem key={item.id || `new-${i}`} f={f} item={item} i={i} n={items.length} path={[...path, i]}
          defaultOpen={i === added}
          onItem={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
          onMove={(a, d) => onChange(move(items, a, d))}
          onRemove={(a) => { if (confirm(`Remove “${f.itemTitle ? f.itemTitle(items[a]) : 'this item'}”?`)) onChange(items.filter((_, j) => j !== a)); }} />
      ))}
      {(!f.maxItems || items.length < f.maxItems) && (
        <button type="button" className="adm-add" onClick={() => { setAdded(items.length); onChange([...items, structuredClone(f.blank)]); }}>
          + Add {f.label.toLowerCase().replace(/s$/, '')}
        </button>
      )}
    </div>
  );
}

export function Field({ f, value, path, onChange }) {
  const id = useId();
  const text = (v) => (f.nullable || f.type === 'url') && v.trim() === '' ? null : v;

  switch (f.type) {
    case 'bool':
      return (
        <Wrap f={{ ...f, label: null }} path={path} id={id} inline>
          <label className="adm-check"><input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>
        </Wrap>
      );
    case 'textarea':
      return (
        <Wrap f={f} path={path} id={id}>
          <textarea id={id} rows={f.rows || 3} value={value ?? ''} onChange={(e) => onChange(text(e.target.value))} />
          <Counter value={value} max={f.max} />
        </Wrap>
      );
    case 'number':
      return (
        <Wrap f={f} path={path} id={id}>
          <input id={id} type="number" min={f.min} max={f.max} value={value ?? 0}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
        </Wrap>
      );
    case 'select':
      return (
        <Wrap f={f} path={path} id={id}>
          <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Wrap>
      );
    case 'color':
      return (
        <Wrap f={f} path={path} id={id}>
          <div className="adm-row">
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />
            <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="adm-mono" />
          </div>
        </Wrap>
      );
    case 'tags':
      return <Wrap f={f} path={path} id={id}><TagsInput id={id} value={value} onChange={onChange} f={f} /></Wrap>;
    case 'asset':
      return <Wrap f={f} path={path} id={id}><AssetField id={id} value={value} onChange={onChange} f={f} /></Wrap>;
    case 'textlist':
      return <Wrap f={f} path={path} id={id}><TextList f={f} value={value} path={path} onChange={onChange} /></Wrap>;
    case 'list':
      return <Wrap f={f} path={path} id={id}><ListField f={f} value={value} path={path} onChange={onChange} /></Wrap>;
    case 'group':
      return (
        <fieldset className="adm-group">
          <legend>{f.label}</legend>
          <FieldList fields={f.fields} value={value || {}} path={path} onChange={onChange} />
        </fieldset>
      );
    default: // text, url, email
      return (
        <Wrap f={f} path={path} id={id}>
          <input id={id} type={f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'} value={value ?? ''}
            placeholder={f.type === 'url' ? 'https://' : undefined} onChange={(e) => onChange(text(e.target.value))} />
          <Counter value={value} max={f.max} />
        </Wrap>
      );
  }
}

export function FieldList({ fields, value, path, onChange }) {
  return fields.map((f) => (
    <Field key={f.k} f={f} value={value?.[f.k]} path={[...path, f.k]}
      onChange={(v) => onChange({ ...value, [f.k]: v })} />
  ));
}

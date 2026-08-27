import { useState, useEffect, useRef } from 'react';

export default function CommandPalette({ isOpen, onClose, onToggleTheme, theme }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const ITEMS = [
    { id: 'nav-hero', category: 'Navigation', title: 'Go to Overview', icon: 'home', action: () => { window.location.hash = '#hero'; onClose(); } },
    { id: 'nav-dag', category: 'Navigation', title: 'Go to Multi-Agent Architecture Studio', icon: 'account_tree', action: () => { window.location.hash = '#dag-studio'; onClose(); } },
    { id: 'nav-proj', category: 'Navigation', title: 'Go to Projects Matrix', icon: 'grid_view', action: () => { window.location.hash = '#projects'; onClose(); } },
    { id: 'nav-skills', category: 'Navigation', title: 'Go to Capability Matrix', icon: 'memory', action: () => { window.location.hash = '#skills'; onClose(); } },
    { id: 'nav-exp', category: 'Navigation', title: 'Go to Experience & Milestones', icon: 'work_history', action: () => { window.location.hash = '#timeline'; onClose(); } },
    { id: 'nav-contact', category: 'Navigation', title: 'Go to Contact', icon: 'send', action: () => { window.location.hash = '#contact'; onClose(); } },

    { id: 'act-resume', category: 'Actions', title: 'Open Resume (PDF)', icon: 'description', action: () => { window.open('/resume.pdf', '_blank'); onClose(); } },
    { id: 'act-github', category: 'Actions', title: 'Open GitHub Profile', icon: 'code', action: () => { window.open('https://github.com/SoumilMalik24', '_blank'); onClose(); } },
    { id: 'act-theme', category: 'Preferences', title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, icon: 'palette', action: () => { onToggleTheme(); onClose(); } },
  ];

  const filtered = ITEMS.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 10, 15, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '120px',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: '560px',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-accent)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent-indigo)' }}>
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to section..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            style={{
              flexGrow: 1,
              background: 'transparent',
              border: 'none',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <kbd className="badge" style={{ fontSize: '10px' }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              No results found
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  backgroundColor: idx === selectedIndex ? 'var(--bg-card-hover)' : 'transparent',
                  color: idx === selectedIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: idx === selectedIndex ? 'var(--accent-indigo)' : 'var(--text-tertiary)' }}>
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

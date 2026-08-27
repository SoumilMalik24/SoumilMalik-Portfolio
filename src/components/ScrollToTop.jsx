import { useEffect, useState } from 'react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 350);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (!visible) return null;

  return (
    <button
      onClick={scrollUp}
      aria-label="Scroll to top"
      title="Return to top node"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: '42px',
        height: '42px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-high)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--primary)';
        e.currentTarget.style.boxShadow = '0 0 16px var(--primary-glow-subtle)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.4)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
        keyboard_arrow_up
      </span>
    </button>
  );
}

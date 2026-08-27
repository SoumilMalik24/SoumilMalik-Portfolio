import { useState } from 'react';
import emailjs from '@emailjs/browser';

const CHANNELS = [
  { label: 'Direct Email', value: 'soumil4malik@gmail.com', href: 'mailto:soumil4malik@gmail.com', icon: 'mail', copyable: true },
  { label: 'Direct Phone', value: '+91 9650799486', href: 'tel:+919650799486', icon: 'call', copyable: true },
  { label: 'Location', value: 'Delhi, India (UTC+05:30)', href: null, icon: 'location_on', copyable: false },
  { label: 'LinkedIn', value: 'linkedin.com/in/soumilmalik24', href: 'https://linkedin.com/in/soumilmalik24', icon: 'link', copyable: false },
  { label: 'GitHub', value: 'github.com/SoumilMalik24', href: 'https://github.com/SoumilMalik24', icon: 'code', copyable: false },
];

export default function Contact() {
  const [form, setForm] = useState({ email: '', subject: '', message: '' });
  const [status, setStatus] = useState(null); // 'sending' | 'success' | 'error'
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (val, key) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');

    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          from_email: form.email,
          subject: form.subject,
          message: form.message,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      setStatus('success');
      setForm({ email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Contact error:', err);
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="section-wrap">
      <div className="site-container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              send
            </span>
            <span>Get in Touch</span>
          </div>
          <h2 className="section-heading">Let&apos;s Build Something Impactful</h2>
          <p className="section-description">
            Open to full-time AI/ML engineer roles, agentic AI contracts, and RAG architecture consulting.
          </p>
        </div>

        {/* Contact Grid */}
        <div className="contact-layout">
          {/* Direct Info */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Direct Communication Channels
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
              Feel free to reach out directly via email, connect on LinkedIn, or fill out the direct transmission form.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {CHANNELS.map((ch) => (
                <div
                  key={ch.label}
                  className="card"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--accent-indigo)', fontSize: '18px' }}>
                      {ch.icon}
                    </span>
                    <div>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        {ch.label}
                      </div>
                      {ch.href ? (
                        <a href={ch.href} target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {ch.value}
                        </a>
                      ) : (
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{ch.value}</div>
                      )}
                    </div>
                  </div>

                  {ch.copyable && (
                    <button
                      onClick={() => handleCopy(ch.value, ch.label)}
                      className="badge"
                      style={{ cursor: 'pointer', fontSize: '10px' }}
                    >
                      {copiedKey === ch.label ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form className="card contact-card-box" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }} htmlFor="c-email">
                Your Email Address
              </label>
              <input
                id="c-email"
                type="email"
                required
                className="form-input-field"
                placeholder="name@company.com"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }} htmlFor="c-subject">
                Subject
              </label>
              <input
                id="c-subject"
                type="text"
                required
                className="form-input-field"
                placeholder="Agentic AI Opportunity / RAG System"
                value={form.subject}
                onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }} htmlFor="c-msg">
                Message
              </label>
              <textarea
                id="c-msg"
                required
                rows={5}
                className="form-input-field"
                placeholder="Tell me about your team, architecture requirements, or project details..."
                value={form.message}
                onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              className="btn-accent"
              style={{ marginTop: '6px' }}
              disabled={status === 'sending'}
            >
              <span>{status === 'sending' ? 'Sending Message...' : 'Send Message ➔'}</span>
            </button>

            {status === 'success' && (
              <div className="badge badge-emerald" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                ✓ Message sent successfully! Soumil will get back to you shortly.
              </div>
            )}

            {status === 'error' && (
              <div style={{ color: 'var(--accent-rose)', fontSize: '12px', padding: '6px 0' }}>
                ✕ Error delivering message. Please email soumil4malik@gmail.com directly.
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

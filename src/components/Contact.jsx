import { useState } from 'react';

const CONTACT_INFO = [
  { label: 'Email',    value: 'soumil4malik@gmail.com', href: 'mailto:soumil4malik@gmail.com', icon: '✉' },
  { label: 'Phone',    value: '+91 9650799486',           href: 'tel:+919650799486',              icon: '📞' },
  { label: 'Location', value: 'Delhi, India',             href: null,                             icon: '📍' },
  { label: 'LinkedIn', value: 'linkedin.com/in/soumilmalik', href: 'https://linkedin.com/in/soumilmalik', icon: '↗' },
  { label: 'GitHub',   value: 'github.com/SoumilMalik24', href: 'https://github.com/SoumilMalik24',      icon: '↗' },
];

const INITIAL = { name: '', email: '', subject: '', message: '' };

export default function Contact() {
  const [form, setForm]     = useState(INITIAL);
  const [status, setStatus] = useState(null); // null | 'sending' | 'success' | 'error'

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');

    try {
      // Send the data to your backend
      const res = await fetch('YOUR_BACKEND_URL_HERE/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error('Server error');
      }

      setStatus('success');
      setForm(INITIAL);
    } catch (err) {
      console.error('Failed to send message:', err);
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="section-outer">
      <div className="section-inner">
        <div className="section-label">Get In Touch</div>

        <div className="contact-grid">
          {/* Left — info */}
          <div className="contact-info">
            <h2 className="contact-heading">
              Let's build something<br /><em>great together.</em>
            </h2>
            <p className="contact-sub">
              Open to freelance projects, full-time roles, and collaborations
              in LLM engineering, RAG systems, or agent design.
            </p>

            <div className="contact-cards">
              {CONTACT_INFO.map(({ label, value, href, icon }) => (
                <div className="contact-card" key={label}>
                  <div className="contact-card-icon">{icon}</div>
                  <div>
                    <div className="contact-card-label">{label}</div>
                    {href ? (
                      <a className="contact-card-value" href={href} target="_blank" rel="noreferrer">
                        {value}
                      </a>
                    ) : (
                      <div className="contact-card-value">{value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="name">Your Name</label>
                <input
                  id="name"
                  name="name"
                  className="form-input"
                  type="text"
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="email">Your Email</label>
                <input
                  id="email"
                  name="email"
                  className="form-input"
                  type="email"
                  placeholder="rahul@company.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="subject">Subject</label>
              <input
                id="subject"
                name="subject"
                className="form-input"
                type="text"
                placeholder="RAG pipeline for our product"
                value={form.subject}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                className="form-input form-textarea"
                placeholder="Tell me about your project or opportunity..."
                value={form.message}
                onChange={handleChange}
                required
                rows={5}
              />
            </div>

            <button
              className="form-submit"
              type="submit"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send Message →'}
            </button>

            {status === 'success' && (
              <div className="form-feedback form-feedback--ok">
                ✓ Message sent! I'll get back to you soon.
              </div>
            )}
            {status === 'error' && (
              <div className="form-feedback form-feedback--err">
                ✕ Something went wrong. Try emailing me directly.
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}

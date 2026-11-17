const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
const SECTIONS = ['hero', 'about', 'projects', 'experience', 'contact'];

function visitorId() {
  try { return localStorage.getItem('sm_vid'); } catch { return null; }
}

/* Calls the Kirby agent. Never throws: on failure returns a friendly reply. */
export default async function askKirby({ messages, conversationId, currentSection }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(`${BASE}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        conversation_id: conversationId,
        visitor_id: visitorId(),
        current_section: currentSection,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      reply: String(data.reply || 'Hmm, I’m not sure.'),
      conversation_id: data.conversation_id || null,
      section: SECTIONS.includes(data.section) ? data.section : null,
      mood: typeof data.mood === 'string' ? data.mood : null,
    };
  } catch {
    return { reply: 'I can’t reach my brain right now. Try again soon!', conversation_id: null, section: null, mood: 'sad' };
  } finally {
    clearTimeout(timer);
  }
}

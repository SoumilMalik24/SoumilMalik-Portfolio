/**
 * Site content, published from the admin portal.
 *
 * scripts/fetch-content.mjs writes content.json from the backend's GET /api/content before dev/build
 * (falling back to content.snapshot.json), so the page never waits on the API at runtime.
 * This module adapts that payload to the shapes the landing components use.
 */
import content from './content.json';

const s = content.sections || {};

export const contentVersion = content.version;

export const profile = {
  name: s.profile?.name || '',
  role: s.profile?.role || '',
  location: s.profile?.location || '',
  status: s.profile?.status || '',
  openToWork: s.profile?.open_to_work ?? true,
  portrait: s.profile?.portrait?.url || '/portrait.webp',
};

export const firstName = profile.name.split(' ')[0] || profile.name;

/** [[label, value]] pairs for the About terminal. */
export const facts = (s.about?.facts || []).map((f) => [f.label, f.value]);
export const paragraphs = s.about?.paragraphs || [];

/** Projects for the box showcase. */
export const projects = (s.projects?.items || []).map((p) => ({
  id: p.id,
  num: p.num,
  name: p.name,
  description: p.description,
  tags: p.tags || [],
  github: p.github || '',
  live: p.live || '',
  image: p.image || null,
}));

/** Timeline items; the "next" card is appended when enabled. */
const nextCard = s.experience?.next_card;
export const experience = [
  ...(s.experience?.items || []).map((e) => ({
    id: e.id, kicker: e.kicker, name: e.name, role: e.role, when: e.when, dur: e.dur,
    pts: e.points?.length ? e.points : null,
    tools: e.tools?.length ? e.tools : null,
  })),
  ...(nextCard?.enabled ? [{ id: 'next', next: true, kicker: nextCard.kicker, name: nextCard.name, role: nextCard.role }] : []),
];

/** Skill groups for the orb. */
export const stack = (s.skills?.groups || []).map((g) => ({
  group: g.name, bg: g.bg, text: g.text, pills: g.pills || [], tagline: g.tagline, featured: g.featured || [],
}));

export const contact = {
  email: s.contact?.email || '',
  github: s.contact?.github || '',
  linkedin: s.contact?.linkedin || '',
  resume: s.contact?.resume_url || '/resume.pdf',
  extraLinks: s.contact?.extra_links || [],
};

export const kirby = {
  enabled: s.kirby?.enabled ?? true,
  name: s.kirby?.display_name || 'Kirby',
  tour: s.kirby?.tour || {},
};

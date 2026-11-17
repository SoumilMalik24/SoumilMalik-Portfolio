/*
 * Form descriptions for every content section. They mirror the backend schemas
 * (backend/app/schemas/content.py); the backend stays the source of truth for validation.
 *
 * Field: { k, label, type, max?, hint?, options?, kind?, fields?, blank?, maxItems?, itemTitle? }
 * types: text | textarea | url | email | number | bool | select | color | tags | asset | textlist | list | group
 */
export const MOODS = ['happy', 'excited', 'proud', 'curious', 'playful', 'thinking', 'confused', 'shy', 'laughing'];
const TOUR_SECTIONS = [['hero', 'Hero'], ['about', 'About'], ['projects', 'Projects'], ['experience', 'Experience'], ['contact', 'Contact']];

const tourEntry = (id, label) => ({
  k: id, label, type: 'group', fields: [
    { k: 'state', label: 'Mood', type: 'select', options: MOODS },
    { k: 'face', label: 'Face (optional)', type: 'text', max: 20, hint: 'e.g. squinted', nullable: true },
    { k: 'lines', label: 'Lines (shown one at a time)', type: 'textlist', max: 160, maxItems: 10, hint: 'Use **bold** for emphasis.' },
  ],
});

export const SECTIONS = [
  {
    key: 'profile', label: 'Profile', hint: 'Your name and headline, used in the hero, footer and by Kirby.',
    fields: [
      { k: 'name', label: 'Name', type: 'text', max: 60 },
      { k: 'role', label: 'Role', type: 'text', max: 80 },
      { k: 'location', label: 'Location', type: 'text', max: 80 },
      { k: 'status', label: 'Status', type: 'text', max: 80, hint: 'e.g. Open to work' },
      { k: 'open_to_work', label: 'Open to work', type: 'bool' },
      { k: 'portrait_asset_id', label: 'Hero portrait', type: 'asset', kind: 'image', hint: 'Transparent or plain background works best. Default: the bundled portrait.' },
    ],
  },
  {
    key: 'about', label: 'About', hint: 'The About paragraphs and the terminal facts.',
    fields: [
      { k: 'paragraphs', label: 'Paragraphs', type: 'textlist', multiline: true, max: 1200, maxItems: 5 },
      {
        k: 'facts', label: 'Terminal facts', type: 'list', maxItems: 8, itemTitle: (f) => f.label || 'New fact',
        blank: { label: '', value: '' },
        fields: [{ k: 'label', label: 'Label', type: 'text', max: 30 }, { k: 'value', label: 'Value', type: 'text', max: 80 }],
      },
    ],
  },
  {
    key: 'projects', label: 'Projects', hint: 'Cards in the project box, in this order.',
    fields: [{
      k: 'items', label: 'Projects', type: 'list', maxItems: 30, itemTitle: (p) => `${p.num ? `${p.num} · ` : ''}${p.name || 'New project'}${p.hidden ? ' (hidden)' : ''}`,
      blank: { num: '', name: '', description: '', tags: [], github: null, live: null, image_asset_id: null, hidden: false },
      fields: [
        { k: 'num', label: 'Number', type: 'text', max: 4, hint: 'e.g. 01' },
        { k: 'name', label: 'Name', type: 'text', max: 80 },
        { k: 'description', label: 'Description', type: 'textarea', max: 800 },
        { k: 'tags', label: 'Tags', type: 'tags', max: 30, maxItems: 12 },
        { k: 'github', label: 'GitHub URL', type: 'url' },
        { k: 'live', label: 'Live URL', type: 'url' },
        { k: 'image_asset_id', label: 'Image (optional)', type: 'asset', kind: 'image' },
        { k: 'hidden', label: 'Hide from the site', type: 'bool' },
      ],
    }],
  },
  {
    key: 'experience', label: 'Experience', hint: 'The career timeline, top to bottom.',
    fields: [
      {
        k: 'items', label: 'Timeline', type: 'list', maxItems: 20, itemTitle: (e) => `${e.name || 'New entry'} · ${e.role || ''}${e.hidden ? ' (hidden)' : ''}`,
        blank: { kicker: '', name: '', role: '', when: '', dur: '', points: [], tools: [], hidden: false },
        fields: [
          { k: 'kicker', label: 'Kicker', type: 'text', max: 30, hint: 'e.g. Internship, Education' },
          { k: 'name', label: 'Organisation', type: 'text', max: 60 },
          { k: 'role', label: 'Role', type: 'text', max: 120 },
          { k: 'when', label: 'When', type: 'text', max: 40, hint: 'e.g. Jul – Sep 2026' },
          { k: 'dur', label: 'Duration', type: 'text', max: 20, hint: 'e.g. 3 mo' },
          { k: 'points', label: 'Highlights', type: 'textlist', max: 200, maxItems: 8 },
          { k: 'tools', label: 'Tools', type: 'tags', max: 30, maxItems: 8 },
          { k: 'hidden', label: 'Hide from the site', type: 'bool' },
        ],
      },
      {
        k: 'next_card', label: 'Closing card', type: 'group', fields: [
          { k: 'enabled', label: 'Show it', type: 'bool' },
          { k: 'kicker', label: 'Kicker', type: 'text', max: 30 },
          { k: 'name', label: 'Title', type: 'text', max: 60 },
          { k: 'role', label: 'Text', type: 'text', max: 160 },
        ],
      },
    ],
  },
  {
    key: 'skills', label: 'Skills', hint: 'Groups on the skills orb. Featured skills glow.',
    fields: [{
      k: 'groups', label: 'Groups', type: 'list', maxItems: 10, itemTitle: (g) => g.name || 'New group',
      blank: { name: '', bg: '#e8e0d4', text: '#6b5a42', pills: [], tagline: '', featured: [] },
      fields: [
        { k: 'name', label: 'Name', type: 'text', max: 40 },
        { k: 'tagline', label: 'Tagline', type: 'text', max: 120 },
        { k: 'pills', label: 'Skills', type: 'tags', max: 40, maxItems: 20 },
        { k: 'featured', label: 'Featured (must be in Skills)', type: 'tags', max: 40, maxItems: 5 },
        { k: 'bg', label: 'Background', type: 'color' },
        { k: 'text', label: 'Text colour', type: 'color' },
      ],
    }],
  },
  {
    key: 'contact', label: 'Contact', hint: 'Footer links and the resume.',
    fields: [
      { k: 'email', label: 'Email', type: 'email' },
      { k: 'github', label: 'GitHub URL', type: 'url' },
      { k: 'linkedin', label: 'LinkedIn URL', type: 'url' },
      { k: 'resume_asset_id', label: 'Resume (PDF)', type: 'asset', kind: 'resume', hint: 'Default: the bundled /resume.pdf.' },
      {
        k: 'extra_links', label: 'Extra links', type: 'list', maxItems: 6, itemTitle: (l) => l.label || 'New link',
        blank: { label: '', url: '' },
        fields: [{ k: 'label', label: 'Label', type: 'text', max: 30 }, { k: 'url', label: 'URL (https:// or mailto:)', type: 'text', max: 500 }],
      },
    ],
  },
  {
    key: 'seo', label: 'SEO', hint: 'Browser title and link previews. Applied on the next site build.',
    fields: [
      { k: 'title', label: 'Title', type: 'text', max: 70 },
      { k: 'description', label: 'Description', type: 'textarea', max: 200 },
      { k: 'og_description', label: 'Share description', type: 'textarea', max: 200 },
      { k: 'site_url', label: 'Site URL', type: 'url' },
      { k: 'og_image_asset_id', label: 'Share image (1200×630)', type: 'asset', kind: 'image' },
    ],
  },
  {
    key: 'kirby', label: 'Kirby', hint: 'Kirby’s personality and tour lines. The safety rules are fixed in the backend.',
    fields: [
      { k: 'enabled', label: 'Kirby is on', type: 'bool' },
      { k: 'display_name', label: 'Name', type: 'text', max: 30 },
      { k: 'tone', label: 'Tone', type: 'textarea', max: 300, hint: 'How Kirby talks. Tone only; it cannot change the rules.' },
      { k: 'fallback_reply', label: 'Reply when the AI is unavailable', type: 'text', max: 200 },
      { k: 'model', label: 'Model (blank = server default)', type: 'text', max: 80, nullable: true },
      { k: 'daily_message_cap', label: 'Daily message cap (0 = no cap)', type: 'number', min: 0, max: 5000 },
      { k: 'tour', label: 'Tour lines per section', type: 'group', fields: TOUR_SECTIONS.map(([id, label]) => tourEntry(id, label)) },
    ],
  },
  {
    key: 'knowledge', label: 'Knowledge', hint: 'Extra facts only Kirby uses (not shown on the site).',
    fields: [
      {
        k: 'notes', label: 'Notes', type: 'list', maxItems: 50, itemTitle: (n) => n.title || 'New note',
        blank: { title: '', text: '' },
        fields: [{ k: 'title', label: 'Title', type: 'text', max: 80 }, { k: 'text', label: 'Text', type: 'textarea', max: 4000, rows: 6 }],
      },
      {
        k: 'faq', label: 'FAQ', type: 'list', maxItems: 100, itemTitle: (f) => f.q || 'New question',
        blank: { q: '', a: '' },
        fields: [{ k: 'q', label: 'Question', type: 'text', max: 300 }, { k: 'a', label: 'Answer', type: 'textarea', max: 1000 }],
      },
    ],
  },
];

const tourBlank = Object.fromEntries(TOUR_SECTIONS.map(([id]) => [id, { state: 'happy', face: null, lines: ['Hi!'] }]));

/** Starting values for a section that has never been saved. */
export const BLANKS = {
  profile: { name: '', role: '', location: '', status: '', open_to_work: true, portrait_asset_id: null },
  about: { facts: [], paragraphs: [] },
  projects: { items: [] },
  experience: { items: [], next_card: { enabled: true, kicker: 'Next', name: 'Your team?', role: '' } },
  skills: { groups: [] },
  contact: { email: '', github: null, linkedin: null, resume_asset_id: null, extra_links: [] },
  seo: { title: '', description: '', og_description: '', site_url: null, og_image_asset_id: null },
  kirby: { enabled: true, display_name: 'Kirby', tone: '', model: null, fallback_reply: 'I can’t reach my brain right now. Try again soon!', daily_message_cap: 300, tour: tourBlank },
  knowledge: { notes: [], faq: [] },
};

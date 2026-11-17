import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Fills <title>, description, Open Graph tags and the portrait preload from the published content. */
function contentHead() {
  return {
    name: 'content-head',
    transformIndexHtml(html) {
      let content
      try {
        content = JSON.parse(readFileSync(new URL('./src/data/content.json', import.meta.url), 'utf8'))
      } catch {
        return html
      }
      const seo = content.sections?.seo
      const portrait = content.sections?.profile?.portrait?.url || '/portrait.webp'
      if (!seo) return html
      const tags = [
        `<title>${esc(seo.title)}</title>`,
        `<meta name="description" content="${esc(seo.description)}" />`,
        `<meta property="og:title" content="${esc(seo.title)}" />`,
        `<meta property="og:description" content="${esc(seo.og_description || seo.description)}" />`,
        `<meta property="og:type" content="website" />`,
        seo.site_url && `<meta property="og:url" content="${esc(seo.site_url)}" />`,
        seo.site_url && `<link rel="canonical" href="${esc(seo.site_url)}" />`,
        seo.og_image && `<meta property="og:image" content="${esc(seo.og_image.url)}" />`,
        `<meta name="twitter:card" content="${seo.og_image ? 'summary_large_image' : 'summary'}" />`,
      ].filter(Boolean).join('\n    ')
      return html
        .replace(/<!-- content-head:start -->[\s\S]*<!-- content-head:end -->/, tags)
        .replace(/<link rel="preload" as="image" href="[^"]*"[^>]*>/,
          `<link rel="preload" as="image" href="${esc(portrait)}"${/^https?:/.test(portrait) ? ' crossorigin="anonymous"' : ''} fetchpriority="high" />`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contentHead()],
})

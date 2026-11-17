import { useEffect, useRef } from 'react';
import { firstName, profile } from '../data';

const DEFAULT_PORTRAIT = '/portrait.webp';

export default function Hero() {
  const root = useRef(null);

  useEffect(() => {
    const q = (id) => root.current.querySelector('#' + id);
    const hero = root.current, cv = q('cv'), ctx = cv.getContext('2d'), hint = q('hint'),
      nm = q('name'), fn = q('fullname');
    const base = document.createElement('canvas'), bctx = base.getContext('2d'),
      sm = document.createElement('canvas'), sctx = sm.getContext('2d', { willReadFrequently: true }),
      mc = document.createElement('canvas'), lc = document.createElement('canvas'), lx = lc.getContext('2d'),
      ec = document.createElement('canvas'), ex = ec.getContext('2d');
    const GL = '01<>/\\|#%&@$*+=?!';
    let act = null, nz = null;
    const CW = 9, CH = 14, RAMP = ' .,:;i1tfLCG08@';
    let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, lum = null, img = null, maskSrc = null;
    const C = { rgb: '15,17,21', inv: true };
    let ready = false, introStart = 0, introDone = false, nextGl = 0, lastHint = '', lastHo = -1;
    const letters = [];
    let mx = -999, my = -999, tx = 0, ty = 0, R = 0, hover = false, touched = false, RAD = 130,
      ir = { x: 0, y: 0, w: 0, h: 0 };
    let raf = 0, dead = false, lastT = 0, visible = true;
    const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    /* time constants in ms: a cell's glow decays to ~2% in about 4x FADE_TAU; the circle retracts in RETRACT_TAU */
    const FADE_TAU = 85, GROW_TAU = 110, RETRACT_TAU = 60;

    function readTheme() {
      const s = getComputedStyle(document.documentElement);
      C.rgb = s.getPropertyValue('--ascii').trim();
      C.inv = s.getPropertyValue('--inv').trim() === '1';
    }

    /* transparent-background silhouette: doubles as its own mask */
    function placeholder() {
      const c = document.createElement('canvas'); c.width = 800; c.height = 1000;
      const g = c.getContext('2d');
      const s = g.createLinearGradient(0, 650, 0, 1000); s.addColorStop(0, '#d9c2a7'); s.addColorStop(1, '#6b5a48');
      g.fillStyle = s; g.beginPath(); g.ellipse(400, 1010, 330, 330, 0, Math.PI, 2 * Math.PI); g.fill();
      g.fillRect(340, 560, 120, 150);
      const h = g.createRadialGradient(350, 380, 20, 400, 420, 230); h.addColorStop(0, '#f6dcc0'); h.addColorStop(1, '#a77d5c');
      g.fillStyle = h; g.beginPath(); g.ellipse(400, 410, 150, 195, 0, 0, 7); g.fill();
      g.fillStyle = '#1b1410'; g.beginPath(); g.ellipse(400, 290, 160, 120, 0, Math.PI, 2 * Math.PI); g.fill();
      return c;
    }

    nm.textContent = '';
    [profile.name.replace(/ /g, ' ')].forEach((w) => {
      const row = document.createElement('div'); row.className = 'ln';
      w.split('').forEach((ch) => {
        const sp = document.createElement('span'); sp.className = 'lt'; sp.textContent = ch; row.appendChild(sp);
        letters.push({ el: sp, ch, s: 0, e: 0, g: 0, st: -1, tk: -1, cx: 0, w: 0 });
      });
      nm.appendChild(row);
    });
    function lockWidths() {
      nm.style.fontSize = '100px';
      letters.forEach((L) => { L.el.style.width = ''; L.el.textContent = L.ch; });
      letters.forEach((L) => { L.w = L.el.getBoundingClientRect().width; });
      letters.forEach((L) => { L.el.style.width = (L.w / 100) + 'em'; L.st = -1; });
    }
    function fitName() {
      nm.style.fontSize = '100px';
      const fs = Math.min(100 * W * 0.94 / nm.offsetWidth, H * 0.32); nm.style.fontSize = fs + 'px';
      /* phones: tuck the name just behind the top of the portrait instead of leaving it in empty space */
      const mob = W < 760;
      const nt = mob ? ir.y + ir.h * 0.05 - nm.offsetHeight * 0.75 : H * 0.5 - nm.offsetHeight / 2;
      nm.style.top = Math.max(mob ? 150 : 110, nt) + 'px';
      /* phones: small name goes above the big one so it doesn't land on the face */
      fn.style.top = (mob ? nm.offsetTop + fs * 0.12 - fn.offsetHeight
        : nm.offsetTop + nm.offsetHeight - fs * 0.06 - fn.offsetHeight * 0.5) + 'px';
      const hr = hero.getBoundingClientRect();
      letters.forEach((L) => { const b = L.el.getBoundingClientRect(); L.cx = b.left - hr.left + b.width / 2; });
    }
    function tickLetters(t) {
      const tt = introStart ? t - introStart : -1, tk = (t / 60) | 0;
      for (let i = 0; i < letters.length; i++) {
        const L = letters[i]; let st;
        if (L.ch === ' ') continue;
        if (tt < 0 || tt < L.s) st = 0; else if (tt < L.e || t < L.g) st = 1; else st = 2;
        if (st === 0) { if (L.st !== 0) { L.el.style.opacity = 0; L.st = 0; } }
        else if (st === 1) {
          if (L.st !== 1) { L.el.style.opacity = 1; L.el.style.color = 'var(--hot)'; L.st = 1; }
          if (L.tk !== tk) { L.tk = tk; L.el.textContent = GL[(tk * 5 + i * 11) % GL.length]; }
        } else if (L.st !== 2) { L.el.textContent = L.ch; L.el.style.color = ''; L.el.style.opacity = 1; L.st = 2; }
      }
      if (introDone && t > nextGl) { letters[(Math.random() * letters.length) | 0].g = t + 320; nextGl = t + 1600 + Math.random() * 1800; }
    }

    function layout() {
      W = hero.clientWidth; H = hero.clientHeight; dpr = Math.min(window.devicePixelRatio || 1, W < 760 ? 1.25 : 1.5);
      cv.width = W * dpr; cv.height = H * dpr; base.width = W * dpr; base.height = H * dpr; mc.width = W * dpr; mc.height = H * dpr;
      readTheme();
      RAD = Math.max(100, Math.min(170, Math.min(W, H) * 0.2)); lc.width = W * dpr; lc.height = H * dpr; ec.width = W * dpr; ec.height = H * dpr;
      const iw = img.width, ih = img.height;
      /* phones: let the shoulders run off the edges so the portrait isn't shrunk to a strip at the bottom */
      const mob = W < 760;
      let s = H * (mob ? 0.78 : 0.9) / ih;
      if (iw * s > W * (mob ? 1.4 : 0.96)) s = W * (mob ? 1.4 : 0.96) / iw;
      /* keep the head (and the name above it) clear of the tagline block at the top on short phones */
      if (mob && ih * s > H - 300) s = Math.max(0, H - 300) / ih;
      const x = (W - iw * s) / 2, y = H - ih * s; ir = { x, y, w: iw * s, h: ih * s };
      /* mask at device resolution */
      const mt = mc.getContext('2d'); mt.setTransform(dpr, 0, 0, dpr, 0, 0); mt.clearRect(0, 0, W, H);
      try { mt.filter = 'blur(2px)'; } catch { /* unsupported */ }
      mt.drawImage(maskSrc, x, y, iw * s, ih * s); mt.filter = 'none';
      /* subject only (transparent elsewhere) so the name sits behind it */
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.clearRect(0, 0, W, H); bctx.drawImage(img, x, y, iw * s, ih * s);
      /* dissolve the lowest part of the photo into the backdrop instead of a hard cut at the hero edge */
      /* tint (source-atop) toward the About section's background (#17181b) so the portrait melts into it */
      bctx.save(); bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.globalCompositeOperation = 'source-atop';
      const fade = bctx.createLinearGradient(0, (H - ih * s * 0.42) * dpr, 0, H * dpr);
      fade.addColorStop(0, 'rgba(23,24,27,0)'); fade.addColorStop(0.45, 'rgba(23,24,27,0.35)'); fade.addColorStop(0.8, 'rgba(23,24,27,0.85)'); fade.addColorStop(1, 'rgba(23,24,27,1)');
      bctx.fillStyle = fade; bctx.fillRect(0, 0, W * dpr, H * dpr); bctx.restore();
      /* reuse the mask canvas for the ASCII layer: same shape grown ~2px so it fully covers the photo's edge pixels */
      mt.clearRect(0, 0, W, H);
      [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]].forEach((v) => { mt.drawImage(maskSrc, x + v[0], y + v[1], iw * s, ih * s); });
      cols = Math.ceil(W / CW); rows = Math.ceil(H / CH); sm.width = cols; sm.height = rows;
      sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, cols, rows); sctx.imageSmoothingQuality = 'high'; sctx.drawImage(base, 0, 0, cols, rows);
      const d = sctx.getImageData(0, 0, cols, rows).data; lum = new Float32Array(cols * rows); act = new Float32Array(cols * rows); if (!introDone) act.fill(1); nz = new Float32Array(cols * rows);
      for (let q = 0; q < nz.length; q++) { const hv = Math.sin(q * 12.9898) * 43758.5453; nz[q] = hv - Math.floor(hv); }
      for (let i = 0; i < lum.length; i++) { const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255; lum[i] = Math.min(1, Math.pow(l, 0.8) * 1.25); }
      fitName();
    }

    function frame(t) {
      if (dead) return;
      if (!visible) { raf = 0; return; }
      if (ready && !introStart) { introStart = t; letters.forEach((L) => { L.s = 200 + L.cx / W * 1700 + Math.random() * 150; L.e = L.s + 450 + Math.random() * 350; }); }
      let ip = 0; if (introStart && !introDone) { ip = Math.min(1, (t - introStart) / 2800); if (ip >= 1) { introDone = true; ip = 1; } }
      const intro = !introDone, ht = intro ? '' : (coarse ? 'Touch the portrait' : 'Move over the portrait'), ho = (introDone && touched) ? 0 : 1;
      if (ht !== lastHint) { hint.textContent = ht; lastHint = ht; } if (ho !== lastHo) { hint.style.opacity = ho; lastHo = ho; }
      if (!touched && introDone) { tx = ir.x + ir.w * 0.5 + Math.cos(t / 1300) * ir.w * 0.18; ty = ir.y + ir.h * 0.4 + Math.sin(t / 1700) * ir.h * 0.14; hover = true; }
      const dt = Math.min(100, lastT ? t - lastT : 16.7); lastT = t;
      const kFade = Math.exp(-dt / FADE_TAU), kR = 1 - Math.exp(-dt / (hover ? GROW_TAU : RETRACT_TAU));
      tickLetters(t);
      mx += (tx - mx) * 0.22; my += (ty - my) * 0.22; R += ((hover ? RAD : 0) - R) * kR; if (R < 0.5) R = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
      let any = false;
      lx.globalCompositeOperation = 'source-over'; lx.setTransform(dpr, 0, 0, dpr, 0, 0); lx.clearRect(0, 0, W, H);
      ex.globalCompositeOperation = 'source-over'; ex.setTransform(dpr, 0, 0, dpr, 0, 0); ex.clearRect(0, 0, W, H);
      lx.font = (CH - 1) + 'px ui-monospace,Menlo,Consolas,monospace'; lx.textBaseline = 'top';
      const n = RAMP.length - 1, tk = (t / 70) | 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, x = c * CW, y = r * CH, z = nz[i]; let a = act[i], want = false;
        if (intro && x + z * 220 > ip * (W + 300)) want = true; else if (R > 0) { const d = Math.hypot(x + CW / 2 - mx, y + CH / 2 - my); want = d < R * (1 - 0.5 * z); }
        if (want) a += (1 - a) * 0.3; else a *= kFade;
        if (a < 0.02) { act[i] = 0; continue; }
        act[i] = a; any = true;
        let l = lum[i]; if (C.inv) l = 1 - l; l = l < 0 ? 0 : l > 1 ? 1 : l;
        const glitch = a < 0.85 || ((tk * 31 + i * 17) % 97 === 0); let ch, col;
        if (glitch) { ch = GL[(tk * 7 + i * 13) % GL.length]; col = 'rgba(255,74,28,' + Math.min(1, a + 0.2).toFixed(2) + ')'; }
        else { ch = RAMP[(l * n) | 0]; col = 'rgba(' + C.rgb + ',' + (0.35 + 0.65 * l).toFixed(2) + ')'; }
        const sh = (z > 0.9 && (tk + i) % 6 === 0) ? (((tk + c) % 3) - 1) * CW * 0.6 : 0;
        ex.fillStyle = 'rgba(0,0,0,' + Math.min(1, a * 1.7).toFixed(2) + ')'; ex.fillRect(x, y, CW + 0.5, CH + 0.5);
        if (ch !== ' ') { lx.fillStyle = col; lx.fillText(ch, x + sh, y); }
      }
      if (any) {
        lx.globalCompositeOperation = 'destination-in'; lx.setTransform(1, 0, 0, 1, 0, 0); lx.drawImage(mc, 0, 0);
        ex.globalCompositeOperation = 'destination-in'; ex.setTransform(1, 0, 0, 1, 0, 0); ex.drawImage(mc, 0, 0);
        /* punch the photo out under the ASCII cells so the name behind it shows through, then draw the glyphs */
        ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(ec, 0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(lc, 0, 0, W, H);
      }
      raf = requestAnimationFrame(frame);
    }

    function pt(e) {
      const b = hero.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top,
        on = px >= ir.x && px <= ir.x + ir.w && py >= ir.y && py <= ir.y + ir.h;
      hero.dataset.on = on ? '1' : '';
      if (!touched) { touched = true; mx = px; my = py; }
      if (on) { if (!hover) { mx = px; my = py; } tx = px; ty = py; }
      hover = on;
    }
    const onLeave = () => { if (touched) hover = false; };
    const onUp = (e) => { if (e.pointerType !== 'mouse') hover = false; };
    hero.addEventListener('pointermove', pt);
    hero.addEventListener('pointerdown', pt);
    hero.addEventListener('pointerleave', onLeave);
    hero.addEventListener('pointerup', onUp);
    hero.addEventListener('pointercancel', onUp);

    /* the mobile address bar changes the viewport height while scrolling, which stretched the canvas.
       On touch devices pin the hero to its first height and only re-measure on a width change (rotation). */
    const pin = () => { if (coarse) { hero.style.height = ''; hero.style.height = hero.clientHeight + 'px'; } };
    pin();
    const ro = new ResizeObserver(() => {
      if (hero.clientWidth !== W) { pin(); layout(); }
      else if (!coarse && Math.abs(hero.clientHeight - H) > 0) layout();
    });
    ro.observe(hero);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf && !dead) { lastT = 0; raf = requestAnimationFrame(frame); }
    });
    io.observe(hero);

    function setImage(src) {
      const i = new Image();
      /* the canvas reads pixels back, so a portrait from another origin must load with CORS */
      if (new URL(src, location.href).origin !== location.origin) i.crossOrigin = 'anonymous';
      i.onerror = () => { if (src !== DEFAULT_PORTRAIT) setImage(DEFAULT_PORTRAIT); };
      i.onload = () => {
        if (dead) return;
        const s = Math.min(1, 1200 / Math.max(i.width, i.height)), c = document.createElement('canvas');
        c.width = Math.round(i.width * s); c.height = Math.round(i.height * s); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        img = c; maskSrc = c; layout();
      };
      i.src = src;
    }

    img = placeholder(); maskSrc = img; layout();
    function go() { if (ready || dead) return; lockWidths(); fitName(); ready = true; }
    if (document.fonts && document.fonts.load) document.fonts.load('900 100px Fraunces', profile.name).then(go, go);
    const goTimer = setTimeout(go, 1500);
    setImage(profile.portrait || DEFAULT_PORTRAIT);
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { touched = true; introDone = true; introStart = 1; act.fill(0); }
    raf = requestAnimationFrame(frame);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(goTimer);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <section id="hero" ref={root} aria-label="Introduction">
      <h1 id="name" aria-label={profile.name}></h1>
      <p id="fullname" className="fullname" aria-hidden="true">{profile.name}</p>
      <canvas id="cv" role="img" aria-label={`Portrait of ${firstName}. Hovering turns the part of the body under the cursor into ASCII characters.`}></canvas>
      <div className="hint" id="hint" aria-hidden="true"></div>
      <p className="tag">I build AI agents that ship.<span>Agentic AI and GenAI</span></p>
      <div className="meta">{profile.role}{profile.location && <><br />{profile.location}</>}</div>
    </section>
  );
}

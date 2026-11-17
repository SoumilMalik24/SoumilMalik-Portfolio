import { lazy, Suspense, useEffect } from 'react';
import Nav from './landing/Nav';
import Hero from './landing/Hero';
import About from './landing/About';
import Projects from './landing/Projects';
import Experience from './landing/Experience';
import Skills from './landing/Skills';
import Contact from './landing/Contact';
import Cursor from './landing/Cursor';
import useLandingFx from './landing/useLandingFx';
import startTracking from './analytics/track';
import { kirby } from './data';

/* Kirby's avatar runtime is about a third of the JS: load it in its own chunk so it doesn't delay first paint */
const KirbyGuide = lazy(() => import('./landing/KirbyGuide'));

export default function App() {
  useLandingFx();
  useEffect(() => startTracking(), []);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Cursor />
      <Nav />
      <main id="main" className="curtain">
        <Hero />
        <About />
        <Projects />
        <Experience />
        <Skills />
      </main>
      <Contact />
      {kirby.enabled && <Suspense fallback={null}><KirbyGuide /></Suspense>}
    </>
  );
}

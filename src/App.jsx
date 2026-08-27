import { useState } from 'react';
import TopBar from './components/TopBar';
import Nav from './components/Nav';
import Hero from './components/Hero';
import DagWorkflowStudio from './components/DagWorkflowStudio';
import Projects from './components/Projects';
import Skills from './components/Skills';
import About from './components/About';
import Timeline from './components/Timeline';
import Contact from './components/Contact';
import Footer from './components/Footer';
import ChatbotWidget from './components/ChatbotWidget';
import ScrollToTop from './components/ScrollToTop';
import CommandPalette from './components/CommandPalette';
import useTheme from './hooks/useTheme';

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  return (
    <div className="app-wrapper">
      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        onToggleTheme={toggleTheme}
        theme={theme}
      />

      {/* Top Status Telemetry */}
      <TopBar />

      {/* Modern Navigation Header */}
      <Nav
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenCmd={() => setIsCmdOpen(true)}
      />

      {/* Main Content Layout */}
      <main>
        <Hero onOpenCmd={() => setIsCmdOpen(true)} />
        <DagWorkflowStudio />
        <Projects />
        <Skills />
        <About />
        <Timeline />
        <Contact />
      </main>

      {/* Clean Footer */}
      <Footer />

      {/* Fast Autonomous Copilot Widget */}
      <ChatbotWidget />

      {/* Scroll to Top Trigger */}
      <ScrollToTop />
    </div>
  );
}

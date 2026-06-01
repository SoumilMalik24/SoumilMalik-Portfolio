import TopBar from './components/TopBar';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Band from './components/Band';
import About from './components/About';
import Projects from './components/Projects';
import Timeline from './components/Timeline';
import Stack from './components/Stack';
import Skills from './components/Skills';
import Contact from './components/Contact';
import Footer from './components/Footer';
import ChatbotWidget from './components/ChatbotWidget';

export default function App() {
  return (
    <div className="site">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <TopBar />
      <Nav />
      <Hero />
      <Band />
      <About />
      <Projects />
      <Timeline />
      <Stack />
      <Skills />
      <Contact />
      <Footer />
      <ChatbotWidget />
    </div>
  );
}

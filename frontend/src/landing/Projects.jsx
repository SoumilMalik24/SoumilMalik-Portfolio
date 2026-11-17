import { projects } from '../data';
import BoxShowcase from './BoxShowcase';

export default function Projects() {
  return (
    <section id="projects" className="sec work" aria-label="Featured work">
      <h2 className="h2 rv"><span className="mask"><span>Featured work</span></span></h2>
      <p className="work-sub rv">Things I built, and what they do. Pick a card from the box.</p>
      <BoxShowcase items={projects} />
    </section>
  );
}

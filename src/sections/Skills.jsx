import { useState, useEffect } from "react";
import SectionTag from "../components/SectionTag";
import { SKILLS } from "../data/skills";

const entries = Object.entries(SKILLS);
const CHAR_MS  = 25;   // ms per character typed
const PAUSE_MS = 180;  // ms pause after command fully typed before advancing

function TerminalLine({ group, items, isDone, charIndex }) {
  if (isDone === "waiting") return null;

  const cmdStr  = "list skills ";
  const flagStr = `--group ${group}`;
  const fullStr = cmdStr + flagStr;

  if (isDone === true) {
    // Line complete — show full command + skill boxes
    return (
      <>
        <div aria-hidden="true">
          <span className="sk-prompt">❯ </span>
          <span className="sk-cmd">{cmdStr}</span>
          <span className="sk-flag">{flagStr}</span>
        </div>
        <div className="sk-out" role="list" aria-label={`${group} skills`}>
          {items.map((skill) => (
            <span key={skill} className="sk-tag" role="listitem">{skill}</span>
          ))}
        </div>
      </>
    );
  }

  // Currently typing this line
  const displayed = fullStr.slice(0, charIndex);
  return (
    <div aria-hidden="true">
      <span className="sk-prompt">❯ </span>
      <span className="sk-cmd">{displayed.slice(0, cmdStr.length)}</span>
      <span className="sk-flag">{displayed.slice(cmdStr.length)}</span>
      <span className="terminal-cursor" />
    </div>
  );
}

export default function Skills() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (lineIndex >= entries.length) return;

    const group   = entries[lineIndex][0];
    const fullLen = ("list skills " + `--group ${group}`).length;

    // Use a longer delay once the command is fully typed (pause before advancing)
    const delay = charIndex < fullLen ? CHAR_MS : PAUSE_MS;

    const t = setTimeout(() => {
      if (charIndex < fullLen) {
        setCharIndex((c) => c + 1);
      } else {
        setLineIndex((l) => l + 1);
        setCharIndex(0);
      }
    }, delay);

    return () => clearTimeout(t);
  }, [lineIndex, charIndex]);

  const isComplete = lineIndex >= entries.length;

  return (
    <section aria-label="Skills">
      <SectionTag label="system / skills" />

      <div className="skills-terminal" role="region" aria-label="Skills terminal">
        {entries.map(([group, items], i) => {
          const isDone =
            i < lineIndex  ? true      :
            i === lineIndex ? "typing"  :
                              "waiting";

          return (
            <TerminalLine
              key={group}
              group={group}
              items={items}
              isDone={isDone}
              charIndex={charIndex}
            />
          );
        })}
        {isComplete && (
          <div aria-hidden="true">
            <span className="sk-prompt">❯ </span>
            <span className="terminal-cursor" />
          </div>
        )}
      </div>
    </section>
  );
}


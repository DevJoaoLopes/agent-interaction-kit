import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

const chapters = [
  {
    label: "01 / THE DRIFT",
    title: "HTTP 200. Still a broken UI.",
    detail: "The backend renamed total to amount. The UI still expects total.",
    status: "Schema drift",
    field: "amount",
    price: "$ —",
  },
  {
    label: "02 / THE CHECK",
    title: "Catch it before your users do.",
    detail: "AIK-RESULT-002 · Missing required result field: total",
    status: "FAIL · exit 1",
    field: "amount",
    price: "$ —",
  },
  {
    label: "03 / THE FIX",
    title: "A clear contract. A deliberate fix.",
    detail: "The developer restores total in the contract and implementation.",
    status: "Developer fixes",
    field: "total",
    price: "$ —",
  },
  {
    label: "04 / IN SYNC",
    title: "The right data. In the right place.",
    detail: "Run the check again. Both contracts now agree.",
    status: "PASS · exit 0",
    field: "total",
    price: "$129.00",
  },
];

function Scene({ stage }: { stage: number }) {
  const chapter = chapters[stage];
  return (
    <div className="story-scene" data-stage={stage}>
      <article className="schema-panel">
        <div className="panel-eyebrow">BACKEND / PROVIDER</div>
        <h3>getOrder()</h3>
        <pre>
          <code>
            {"{\n  id: string,\n  "}
            <span className={stage < 2 ? "field-error" : "field-ok"}>{chapter.field}: number</span>
            {"\n}"}
          </code>
        </pre>
        <span className="panel-filename">aik.provider.json</span>
      </article>
      <div className="check-bridge" aria-label="AIK contract check">
        <span className="bridge-line" />
        <div className="check-mark">
          aik<small>check</small>
        </div>
        <span className="bridge-line" />
      </div>
      <article className="schema-panel ui-panel">
        <div className="panel-eyebrow">FRONTEND / CONSUMER</div>
        <h3>Order summary</h3>
        <div className="story-product">
          <img src="/headphones.svg" width="130" height="100" alt="" loading="lazy" />
          <div>
            <span>Studio headphones</span>
            <strong className={stage === 3 ? "field-ok" : "field-error"}>{chapter.price}</strong>
          </div>
        </div>
        <span className="panel-filename">expects total: number</span>
      </article>
    </div>
  );
}

export default function ContractStory() {
  const target = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end end"] });
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const sceneScale = useTransform(scrollYProgress, [0, 0.3, 0.65, 1], [0.97, 1, 1, 0.97]);
  useMotionValueEvent(scrollYProgress, "change", (progress) =>
    setStage(Math.min(3, Math.floor(Math.max(0, progress) * 4))),
  );
  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 768px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => setEnhanced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return (
    <section
      ref={target}
      className={`contract-story ${enhanced && !reduce ? "is-enhanced" : ""}`}
      aria-label="How AIK detects a breaking contract"
    >
      <div className="animated-story shell" aria-hidden={!enhanced || !!reduce}>
        <div className="chapter-line">
          <span>{chapters[stage].label}</span>
          <span>ILLUSTRATIVE TOOL CONTRACT</span>
        </div>
        <h2>{chapters[stage].title}</h2>
        <motion.div style={{ scale: sceneScale }}>
          <Scene stage={stage} />
        </motion.div>
        <div className="story-result" data-stage={stage}>
          <strong>{chapters[stage].status}</strong>
          <span>{chapters[stage].detail}</span>
        </div>
        <div className="story-progress">
          <motion.div style={{ scaleX }} />
        </div>
        <div className="story-stages">
          <span>Drift</span>
          <span>Check</span>
          <span>Fix</span>
          <span>In sync</span>
        </div>
      </div>
      <div className="static-story shell">
        {chapters.map((chapter, i) => (
          <section key={chapter.label}>
            <span className="eyebrow">{chapter.label}</span>
            <h2>{chapter.title}</h2>
            <Scene stage={i} />
            <p>
              <strong>{chapter.status}</strong> · {chapter.detail}
            </p>
          </section>
        ))}
      </div>
    </section>
  );
}

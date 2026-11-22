"use client";

import Image from "next/image";
import { ArrowRight, CalendarDays, ChartNoAxesCombined, FileText, MessageSquareCheck } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./BusinessLanding.module.css";

const base = "/images/landing/business";

const workflowSteps = [
  { label: "Business knowledge", title: "Give the team a brief they can use.", copy: "Keep the offer, audience and brand voice in one place so the team and AI can work from the same facts.", image: "knowledge", alt: "Showwork Business Knowledge with upload controls and three sample source documents" },
  { label: "Content planning", title: "See what’s on the calendar.", copy: "Keep each post’s creative and copy with its date so the team can see what’s coming and catch gaps early.", image: "calendar", alt: "Showwork content calendar with a month of sample collection launch posts" },
  { label: "Team approvals", title: "Find the decision holding up a post.", copy: "Keep team and client feedback with the post and see whether it needs changes or has been approved.", image: "review", alt: "Showwork Team Review with review stages and approval status for a launch post" },
  { label: "Publishing", title: "Know what went live.", copy: "Schedule approved work on supported accounts and check its publishing status from the workspace.", image: "publishing", alt: "Showwork publishing panel showing the publishing status for an approved post" },
  { label: "Analytics & reporting", title: "Look past the list of posts.", copy: "See how much work cleared review and check available results from connected channels.", image: "analytics", alt: "Showwork Analytics & Reporting and the sample workspace’s content pipeline" },
  { label: "Improvement", title: "Plan the next campaign with a reason.", copy: "Use what you learned to decide which ideas to repeat and what the team should test next.", image: "calendar", alt: "Showwork content calendar, where the team can apply what it learned to its next plan" },
] as const;

const dimensions = {
  knowledge: [1200, 690],
  calendar: [1200, 760],
  review: [1200, 650],
  publishing: [1200, 650],
  analytics: [1180, 541],
  workspaces: [1200, 902],
} as const;

export type WorkflowStep = { label: string; title: string; copy: string; image: keyof typeof dimensions; alt: string };

function screenHref(image: WorkflowStep["image"]) {
  return image === "workspaces" ? "/images/landing/freelancers/workspaces.webp" : `${base}/${image}.webp`;
}

export function WorkspaceScreen({ image, alt, priority = false }: { image: WorkflowStep["image"]; alt: string; priority?: boolean }) {
  const [width, height] = dimensions[image];
  return (
    <Image src={screenHref(image)} alt={alt} width={width} height={height} priority={priority}
      sizes="(max-width: 720px) 94vw, (max-width: 1200px) 75vw, 950px" className={styles.capture} />
  );
}

export function WorkflowShowcase({ steps = workflowSteps, idPrefix = "business" }: { steps?: readonly WorkflowStep[]; idPrefix?: string } = {}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = steps.length;
    const vertical = matchMedia("(max-width: 720px)").matches;
    const directions = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    const direction = directions.indexOf(event.key);
    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : direction < 0 ? -1 : (index + count + (direction === 0 ? -1 : 1)) % count;
    if (next < 0) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const query = matchMedia("(max-width: 720px)");
    const update = () => setVertical(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <>
      <div className={styles.workflowTabs} role="tablist" aria-label="Marketing workflow" aria-orientation={vertical ? "vertical" : "horizontal"}>
        {steps.map((item, index) => (
          <button type="button" role="tab" id={`${idPrefix}-tab-${index}`} key={item.label}
            aria-selected={index === active} aria-controls={`${idPrefix}-panel-${index}`} tabIndex={index === active ? 0 : -1}
            ref={node => { tabs.current[index] = node; }}
            onClick={() => setActive(index)} onKeyDown={event => selectFromKeyboard(event, index)}>
            <span>{item.label}</span><ArrowRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      {steps.map((step, index) => (
        <div id={`${idPrefix}-panel-${index}`} className={styles.workflowPanel} role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${index}`} tabIndex={0} hidden={index !== active} key={step.label}>
          {index === active && <>
            <div className={styles.screenText}>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <a href={screenHref(step.image)} target="_blank" rel="noopener">View full-size screen <span className="sr-only">(opens in a new tab)</span></a>
            </div>
            <figure className={styles.browser}>
              <WorkspaceScreen image={step.image} alt={step.alt} />
              <figcaption>Showwork workspace · Sample data</figcaption>
            </figure>
          </>}
        </div>
      ))}
    </>
  );
}

const scattered = [
  { label: "Content schedules", Icon: CalendarDays },
  { label: "Brand documents", Icon: FileText },
  { label: "Approval requests", Icon: MessageSquareCheck },
  { label: "Marketing reports", Icon: ChartNoAxesCombined },
];

export function MarketingReality() {
  const graphic = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!graphic.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setConnected(true);
      observer.disconnect();
    }, { threshold: .52 });
    observer.observe(graphic.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.realityGraphic} data-connected={connected} ref={graphic}>
      <ul className={styles.sourceList}>
        {scattered.map(({ label, Icon }) => <li key={label}><Icon size={17} aria-hidden="true" />{label}</li>)}
      </ul>
      <div className={styles.connector} aria-hidden="true"><ArrowRight size={20} /></div>
      <figure className={styles.connectedScreen}>
        <WorkspaceScreen image="calendar" alt={workflowSteps[1].alt} />
        <figcaption>One organised Showwork workspace</figcaption>
      </figure>
    </div>
  );
}

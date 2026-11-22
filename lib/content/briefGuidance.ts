import type { BriefField, CreativeBrief } from "./brief";

export const STRATEGY_FIELDS = ["objective", "targetAudience", "keyMessage", "desiredResponse", "brandConnection", "pillar"] as const satisfies readonly BriefField[];

export const BRIEF_STRATEGY_GUIDANCE = `
Give the manager a decision-ready strategy for this particular post.
Target audience: name a recognisable segment, their situation, and the concern that makes this idea useful now.
Objective: explain why this post belongs in this campaign and the specific change in understanding or behaviour it should produce. Do not use broad objectives such as improve engagement without explaining the intended change.
Core idea: state the specific premise the team will make. Key message: state the takeaway in audience language. Desired response: name one realistic thought or action. Pillar: identify the campaign theme this post advances.
Brand connection: explain the relevant business detail and how it informs the idea. Use the workspace profile and business documents for verified business claims. External research can inform audience hypotheses; brand personality informs tone and creative choices. Neither establishes business facts. If an essential audience detail, offering, or proof point is missing, state the particular gap in the internal brief and keep claims narrow.
`;

export const BRIEF_DIRECTION_GUIDANCE = `
Write a creator-ready handoff grounded in the strategy and the brand's distinctive style. Give one specific scene, contrast, demonstration, visual idea, or argument the creator can start from. Explain what the audience should notice or feel and one brand detail that should carry through. For a carousel, describe a conceptual progression; for a Reel or Video, a watchable moment or turning point; for a graphic, one visual communication idea; for a text post, the central argument. Use resources the brief supports or present simple creative possibilities as suggestions. Leave production choices open. Do not repeat the caption, prescribe shots, write scripts, or dictate individual slides.
`;

export const BRIEF_GROUNDING_REVIEW = `
Check the strategy and creative direction of EVERY brief. Could a manager explain why this belongs in this business's calendar? Could the creator start without asking what to make? Flag vague segments, generic goals, unsupported claims, interchangeable brand connections, and directions that just describe a mood or repeat the caption. Repair every weak section you can using grounded details. Where evidence is insufficient, keep the brief honest and state the specific missing detail in the internal section.
`;

export function missingBriefStrategy(brief: CreativeBrief) {
    return [...STRATEGY_FIELDS, "coreIdea" as const].filter(field => !brief[field]?.trim());
}

export const solutionAudiences = {
  "marketing-agencies": { label: "Marketing Agencies", homeSection: "agencies" },
  businesses: { label: "Businesses", homeSection: "businesses" },
  "social-media-managers": { label: "Social Media Managers", homeSection: "managers" },
  "small-businesses-retailers": { label: "Small Businesses & Retailers", homeSection: "retailers" },
  creatives: { label: "Creatives (Videographers, Photographers, etc.)", homeSection: "creatives" },
} as const;

export type SolutionSlug = keyof typeof solutionAudiences;

export const solutionNavigation = Object.entries(solutionAudiences).map(([slug, audience]) => ({
  ...audience,
  menuLabel: slug === "creatives" ? "Creatives" : audience.label,
  href: `/solutions/${slug}`,
}));

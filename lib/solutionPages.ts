import type { EntryProduct } from "@/lib/productJourney";
import { FREE_TIER_LIMIT, TIERS } from "@/lib/subscriptionTiers";

type Recommendation = {
  product: EntryProduct;
  plan: string;
  monthly: number;
  planKey?: string;
  reason: string;
};

export type SolutionRecommendations = [Recommendation, Recommendation];

type SolutionContent = {
  headline: [string, string];
  description: string;
  photo: { src: string; alt: string };
  workflowTitle: string;
  steps: [string, string][];
  scenario: { title: string; description: string; preview: "delivery" };
  recommendations: SolutionRecommendations;
  questions: [string, string][];
  action: string;
  signedInAction: string;
  closing: string;
};

export const solutionPages = {
  creatives: {
    headline: ["Make it easier to hire you", "and easier to work with you."],
    description: "Give prospects a portfolio they can browse and paying clients a place to review and receive their work. Built for videographers, photographers, designers and creative studios.",
    photo: { src: "/images/hero3.png", alt: "Creative professional greeting a client in a studio" },
    workflowTitle: "Support the work from first enquiry to final delivery.",
    steps: [
      ["Show work that wins the brief", "Curate relevant projects, services and testimonials in a public portfolio you can send to prospects."],
      ["Get feedback in context", "Share the client’s project link, keep files and comments together, and track review decisions where available."],
      ["Give the client a clear handover", "Release final files through the project so your client knows where to find them."],
    ],
    scenario: { title: "Hand over a campaign your client can navigate.", description: "After a shoot, your client opens a project link to review the campaign images. They can see the work together, send feedback and return to the project for final files when you release them.", preview: "delivery" },
    recommendations: [
      { product: "portfolio", plan: "Personal Portfolio", monthly: 0, reason: "Build a public home for your projects, services and testimonials. Share one link with prospects." },
      { product: "delivery", plan: "Free", monthly: 0, reason: `Try a client handover with ${FREE_TIER_LIMIT} project per 30 days. Paid plans start at ₦${TIERS.STARTER.priceNgnMonthly.toLocaleString("en-NG")}/month for higher project capacity.` },
    ],
    questions: [
      ["Can I use both tools for the same project?", "Yes. Use Project Delivery for client review and file handover. You can add work you’re allowed to share publicly to your Portfolio."],
      ["Will a client need my Showwork login to review their files?", "No. Share the project’s client link and provide its access code when required. Clients see the files and actions available under your project settings."],
    ],
    action: "Start a delivery project",
    signedInAction: "Open your projects",
    closing: "Give your next client a better handover.",
  },
} satisfies Record<"creatives", SolutionContent>;

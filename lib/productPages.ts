import type { EntryProduct } from "@/lib/productJourney";

type ProductPageContent = {
  name: string;
  href: string;
  summary: string;
  headline: [string, string];
  description: string;
  audience: string;
  photo: { src: string; alt: string; position?: string };
  example: { title: string; description: string };
  questions: [string, string][];
  action: string;
  signedInAction: string;
  workflow: string;
  features: [string, string][];
  closing: string;
  guide: string;
};

export const productPages = {
  portfolio: {
    name: "Portfolio",
    href: "/portfolio",
    summary: "Showcase your creative work",
    headline: ["Give your best work", "a home of its own."],
    description: "Build a portfolio that brings your projects, services and testimonials together. Share one link so potential clients can discover your work and get in touch.",
    audience: "For photographers, designers, filmmakers and independent creatives.",
    photo: { src: "/images/hero1.png", alt: "Filmmaker preparing his camera for a shoot at dusk", position: "65% center" },
    example: {
      title: "Send a link that makes the case for hiring you.",
      description: "Imagine a client asks to see your photography. Send them a page with the projects most relevant to their brief, the services you offer, and a clear way to enquire. This example shows how a photographer might introduce a body of work.",
    },
    questions: [
      ["What can I show?", "Group your photos, videos and documents into project sections. Use your introduction, services and approved testimonials to give visitors more context."],
      ["How can prospective clients reach me?", "Add your contact email or WhatsApp number and choose the call to action that appears on your portfolio."],
      ["Do visitors need a Showwork account?", "Anyone with your public portfolio link can view it. Check the live preview before sharing the link so you can see what your visitors will see."],
    ],
    action: "Create your portfolio",
    signedInAction: "Open your portfolio",
    workflow: "From selected work to a shareable site.",
    features: [
      ["Curate your projects", "Choose the work you want to be known for and give each project the context it deserves."],
      ["Introduce yourself", "Show what you offer and add testimonials that help clients understand what it’s like to work with you."],
      ["Publish and share", "Send one portfolio link in proposals, on social profiles or directly to prospective clients."],
    ],
    closing: "Make your work easy to find.",
    guide: "/help/portfolio",
  },
  workspace: {
    name: "Marketing Workspace",
    href: "/content-workspace",
    summary: "Plan, review and publish content",
    headline: ["Give your marketing team", "one place to work."],
    description: "Bring brand knowledge, content planning, approvals and publishing into one workspace, so everyone can see what’s ready and what needs a decision.",
    audience: "For social media managers, in-house teams and agencies.",
    photo: { src: "/images/landing/4.webp", alt: "Marketing professional at a desk with a content calendar on her monitor", position: "60% center" },
    example: {
      title: "See what’s ready before launch day.",
      description: "Picture a three-post launch campaign. One post is still a draft, one is with the client for review, and one is approved. The calendar gives everyone a shared view of the creative, copy, schedule and next decision.",
    },
    questions: [
      ["Can I keep different clients’ content separate?", "Give each brand its own workspace for content and business knowledge. The number of active workspaces and collaborators depends on your plan."],
      ["Can a client review content before it goes live?", "Share a client review view where they can see posts, leave feedback and approve content. Your team can track decisions before publishing."],
      ["What can I try before I subscribe?", "Eligible accounts get a free three-day trial with Agency feature access and no card required. After the trial, choose a plan based on the workspaces, people and tools you need."],
    ],
    action: "Start your free trial",
    signedInAction: "Open your workspaces",
    workflow: "Take a campaign from idea to published.",
    features: [
      ["Plan with brand context", "Build a content calendar around your campaign goals and use your business knowledge to inform AI-assisted drafts."],
      ["Keep approvals with the work", "Share posts for review so teammates and clients can leave feedback, request changes and approve the content."],
      ["Publish and learn", "Publish approved posts to supported channels and use available performance data to inform your next plan."],
    ],
    closing: "Plan your next campaign in Showwork.",
    guide: "/help/workspace",
  },
  engage: {
    name: "Showwork Engage",
    href: "/engage",
    summary: "Manage customer messages in one inbox",
    headline: ["Keep customer", "conversations moving."],
    description: "Bring WhatsApp, Instagram and Facebook enquiries into one inbox. Draft replies with AI, or enable automatic replies for eligible messages when your team is away.",
    audience: "For businesses and teams that sell or support customers by chat.",
    photo: { src: "/images/hero2.png", alt: "Business owner working on a laptop in a warmly lit office", position: "65% center" },
    example: {
      title: "Give an after-hours enquiry a useful first reply.",
      description: "A customer asks about your services after closing time. With automatic replies enabled for eligible messages, Engage can reply using your business knowledge. Your team can open the same conversation and take over. Select a channel in the example to see how it works.",
    },
    questions: [
      ["Can I keep replies manual?", "Yes. Handle conversations yourself, draft replies with AI for review, or opt in to automatic replies for eligible messages."],
      ["Which accounts can I connect?", "You can connect supported WhatsApp, Instagram and Facebook business accounts. Available messaging actions depend on account permissions and the channel’s reply window."],
      ["What happens when the trial ends?", "Choose a paid plan to keep using Engage. See the trial and paid reply allowances in the pricing section above."],
    ],
    action: "Try Engage free",
    signedInAction: "Open Engage",
    workflow: "Give every enquiry a clear next step.",
    features: [
      ["Connect your channels", "Bring messages from supported business accounts into one shared inbox."],
      ["Reply with business context", "Use what Showwork knows about your services and policies to draft replies. You can opt in to automatic replies for eligible enquiries."],
      ["Take over when needed", "Your team can step in when a question needs a personal response or more attention."],
    ],
    closing: "Give your team one inbox.",
    guide: "#pricing",
  },
  delivery: {
    name: "Project Delivery",
    href: "/delivery",
    summary: "Share files, get approvals and hand over work",
    headline: ["Your best work deserves", "a better handover."],
    description: "Present the work, collect client feedback and share final files in one place. Give clients a clear path from first review to final download.",
    audience: "For photographers, filmmakers, designers and creative studios delivering client work.",
    photo: { src: "/images/landing/7.webp", alt: "Creative professional reviewing finished work with a client on a tablet" },
    example: {
      title: "Make the handover as considered as the work.",
      description: "After a campaign shoot, share a project link with your client. They can review the work in context, give feedback and find the final files once you release them. The example shows what a completed campaign handover can look like.",
    },
    questions: [
      ["How do I share a project with my client?", "Send the project’s share link. The client can open the presentation and see the files and actions available under your project’s access settings."],
      ["Can I collect feedback and approval before delivering?", "Clients can approve files or request revisions where review is available. You can track decisions on each file and share the final downloads when ready. Review and collaboration options vary by plan."],
      ["Which plan should I start with?", "Use Free to try a first delivery. Compare paid plans by the number of projects you deliver and the review tools you need."],
    ],
    action: "Start a delivery project",
    signedInAction: "Open your projects",
    workflow: "Make the next step clear at every stage.",
    features: [
      ["Share the work in context", "Bring files and project details together in a presentation your client can review."],
      ["Collect feedback and sign-off", "Keep revisions and approvals with the project so everyone can follow the client’s decisions."],
      ["Hand over the final files", "Share approved deliverables from one place so clients can easily find what they need."],
    ],
    closing: "Give your next project a clear finish.",
    guide: "/help/project-delivery",
  },
} satisfies Record<EntryProduct, ProductPageContent>;

export const productNavigation = [productPages.workspace, productPages.engage, productPages.delivery, productPages.portfolio];

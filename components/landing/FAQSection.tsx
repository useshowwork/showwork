import { ArrowUpRight, MessageCircle, Plus } from "lucide-react";

const questions = [
  {
    question: "What is Showwork?",
    answer:
      "Showwork is an intelligent marketing operations platform that helps businesses and marketing professionals bring together business knowledge, content planning, AI-assisted creation, collaboration, supported social publishing, customer conversations, and available performance insights in one connected workspace.",
  },
  {
    question: "Is Showwork suitable for an existing marketing team?",
    answer:
      "Yes. Marketing Workspace connects preparation, collaboration, supported execution, and performance visibility. Your plan determines workspace capacity, collaborator limits, and access to advanced features.",
  },
  {
    question: "Can we use our existing social accounts?",
    answer:
      "You can authorize supported accounts through Channels. Publishing, messaging, and analytics support differ by platform, account eligibility, and the permissions granted.",
  },
  {
    question: "How does AI help the team?",
    answer:
      "Available assistance includes business-context-based content preparation, inbox reply drafting, and performance-informed recommendations. Reply drafting and performance recommendations require Studio or Agency. AI allowances and service availability apply; your team remains responsible for decisions.",
  },
  {
    question: "Does approved content publish automatically?",
    answer:
      "Auto-publishing can be enabled or turned off. A post must also meet its schedule, account permissions, media requirements, and any platform-specific consent rules. Approval alone does not guarantee publication.",
  },
  {
    question: "What analytics are available?",
    answer:
      "Basic analytics are included in each plan. Advanced analytics and AI performance recommendations require Studio or Agency. The metrics shown depend on the connected platform, account permissions, and available data.",
  },
  {
    question: "Can we manage conversations and leads?",
    answer:
      "Studio and Agency include Social Inbox and lead management for supported connections. Keep conversation history, contact details, notes, and lead status available for follow-up. This is not a complete sales CRM.",
  },
  {
    question: "Which plan should we choose, and can we try it?",
    answer:
      "Compare workspace capacity, collaborator limits, AI allowances, and included features in the pricing section. Marketing Workspace offers a three-day trial with Agency feature access. You can also request a business demo by email.",
  },
  {
    question: "How is Marketing Workspace different from Project Delivery?",
    answer:
      "Marketing Workspace supports ongoing marketing operations, from content preparation through supported publishing, conversations, and insights. Project Delivery is a separate product for presenting creative deliverables, collecting feedback, approvals, and project handovers.",
  },
  {
    question: "How do we get started?",
    answer:
      "Create an account, set up a Marketing Workspace, add business context, and invite collaborators within your plan limits. Authorize supported social accounts through Channels when you are ready to connect publishing, messages, or reporting.",
  },
];

export default function FAQSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-24 border-t border-[#E5E7EB] bg-[#F4F5F7] px-5 py-24 text-[#111317] sm:px-8 sm:py-32 lg:px-16"
    >
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
        <div>
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#155FC7]">
            <span aria-hidden="true" className="h-px w-8 bg-current" />A little
            clarity
          </p>
          <h2
            id="faq-heading"
            className="mt-6 font-[var(--font-fraunces)] text-[clamp(3rem,5vw,5.5rem)] font-normal leading-[0.98] tracking-[-0.055em]"
          >
            Good questions.
            <br />
            <span className="text-[#155FC7]">Clear answers.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-[#626974]">
            A clearer picture of how Showwork fits your team’s marketing
            workflow.
          </p>
          <div className="mt-10 max-w-sm rounded-2xl border border-[#E1E5EC] bg-white/70 p-6">
            <MessageCircle
              aria-hidden="true"
              size={22}
              className="text-[#155FC7]"
            />
            <h3 className="mt-4 text-sm font-semibold">
              Still have a question?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#626974]">
              Let’s talk about what you’re working on.
            </p>
            <a
              href="mailto:hello@useshowwork.com"
              className="mt-4 inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-[#155FC7] transition-colors hover:text-[#0052FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2478FF]"
            >
              Get in touch <ArrowUpRight aria-hidden="true" size={16} />
            </a>
          </div>
        </div>

        <div className="space-y-3">
          {questions.map(({ question, answer }, index) => (
            <details
              key={question}
              open={index === 0}
              className="group rounded-2xl border border-[#E1E5EC] bg-white transition-colors open:border-[#2478FF]/30 open:bg-[#EEF4FF]"
            >
              <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2478FF] sm:px-7 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden="true"
                  className="hidden text-xs font-medium tabular-nums text-[#626974] sm:block"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="flex-1 text-sm font-semibold leading-6 sm:text-base">
                  {question}
                </h3>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F5F7] text-[#626974] transition-colors group-hover:bg-[#E5EDFC] group-open:bg-[#2478FF] group-open:text-white">
                  <Plus
                    aria-hidden="true"
                    size={16}
                    className="transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  />
                </span>
              </summary>
              <p className="px-5 pb-7 text-sm leading-7 text-[#535C69] sm:pl-[4.75rem] sm:pr-16">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

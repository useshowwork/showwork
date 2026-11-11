import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  "title": "Terms of Service | Showwork",
  "description": "Read the terms for using Showwork, including marketing workspaces, portfolio websites, client project delivery, accounts and subscriptions.",
  "path": "/terms",
  "keywords": []
});

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#101828]">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8 lg:py-24">
        <div className="mb-12">
          <a
            href="/"
            className="text-sm font-semibold tracking-tight text-[#101828]"
          >
            Showwork
          </a>

          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">
            Legal
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#101828] sm:text-5xl">
            Terms of Service
          </h1>

          <p className="mt-4 text-sm text-[#667085]">
            Last updated: September 9, 2026
          </p>
        </div>

        <div className="space-y-10 rounded-[28px] border border-[#E4E7EC] bg-white p-6 shadow-[0_20px_60px_rgba(16,24,40,0.06)] sm:p-10">
          <section>
            <h2 className="text-xl font-semibold">1. Agreement</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              These Terms of Service ("Terms") govern your access to and use
              of Showwork. By creating an account or using Showwork, you
              agree to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. The Showwork Service</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              Showwork provides tools for creators, agencies, businesses,
              and teams to organize, present, approve, manage, and deliver
              creative and social media content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Your Account</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              You are responsible for maintaining the security of your
              account and for activity performed through your account. You
              agree to provide accurate information and to notify Showwork
              if you believe your account has been accessed without
              authorization.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Your Content</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              You retain ownership of content that you upload or submit to
              Showwork. You grant Showwork the limited rights necessary to
              host, process, display, transmit, and otherwise provide that
              content as part of the services you request.
            </p>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              You are responsible for ensuring that you have the necessary
              rights and permissions to upload, share, publish, or otherwise
              use content through Showwork.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              5. Third-Party Integrations
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              Showwork may provide integrations with third-party services,
              including Meta, Facebook, and Instagram. Your use of those
              services remains subject to the applicable third-party terms
              and policies.
            </p>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              When you connect a third-party account, you authorize Showwork
              to perform the actions that are permitted by the integration
              and the permissions you grant.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Acceptable Use</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              You may not use Showwork to violate applicable laws, infringe
              another person's rights, distribute malicious software,
              attempt unauthorized access, interfere with the service, or
              abuse third-party integrations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Payments</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              Certain Showwork features may require a paid plan. Pricing,
              billing periods, trials, renewals, and applicable payment
              terms will be presented to you before or during purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">8. Availability</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              We work to keep Showwork available and reliable, but we do not
              guarantee uninterrupted or error-free operation. The service
              may occasionally be unavailable because of maintenance,
              upgrades, third-party service interruptions, or circumstances
              outside our reasonable control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">9. Account Suspension</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              We may suspend or terminate access where reasonably necessary
              to protect Showwork, its users, third parties, or to address
              violations of these Terms or applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              10. Intellectual Property
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              Showwork and its software, branding, interfaces, designs,
              documentation, and other original materials are owned by
              Showwork or its licensors and are protected by applicable
              intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">11. Disclaimer</h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              Showwork is provided on an "as available" basis to the extent
              permitted by applicable law. We do not guarantee that every
              feature will always operate without interruption or that
              third-party platforms will accept or process every requested
              action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              12. Limitation of Liability
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              To the maximum extent permitted by applicable law, Showwork
              will not be liable for indirect, incidental, special,
              consequential, or punitive damages arising from your use of
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              13. Changes to These Terms
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              We may update these Terms from time to time. Updated Terms
              will be posted on this page with a revised effective date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">
              14. Contact
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#475467]">
              Questions about these Terms can be sent to:
            </p>

            <a
              href="mailto:hello@useshowwork.com"
              className="mt-3 inline-block text-sm font-semibold text-[#2478FF] hover:underline"
            >
              hello@useshowwork.com
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}

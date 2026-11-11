import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = pageMetadata({
  "title": "Account & Personal Data Deletion | Showwork",
  "description": "Learn how to request deletion of your Showwork account and personal data, including information associated with connected social media services.",
  "path": "/data-deletion",
  "keywords": []
});

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] text-[#101828]">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8 lg:py-24">
        <a
          href="/"
          className="text-sm font-semibold tracking-tight text-[#101828]"
        >
          Showwork
        </a>

        <div className="mt-12 rounded-[28px] border border-[#E4E7EC] bg-white p-7 shadow-[0_20px_60px_rgba(16,24,40,0.06)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">
            Privacy
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#101828]">
            Data Deletion
          </h1>

          <p className="mt-5 text-sm leading-7 text-[#475467]">
            You can request deletion of your Showwork account and associated
            personal information at any time.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[#101828]">
            How to request deletion
          </h2>

          <p className="mt-3 text-sm leading-7 text-[#475467]">
            Send a request to:
          </p>

          <a
            href="mailto:hello@useshowwork.com?subject=Showwork%20Data%20Deletion%20Request"
            className="mt-2 inline-block text-sm font-semibold text-[#2478FF] hover:underline"
          >
            hello@useshowwork.com
          </a>

          <p className="mt-6 text-sm leading-7 text-[#475467]">
            Please include the email address associated with your Showwork
            account so that we can identify the account and process your
            request.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[#101828]">
            Connected Instagram accounts
          </h2>

          <p className="mt-3 text-sm leading-7 text-[#475467]">
            If you connected an Instagram account to Showwork, you can also
            disconnect that account from the relevant Showwork workspace.
            Disconnecting the account prevents Showwork from using that
            connection for future publishing actions.
          </p>

          <h2 className="mt-10 text-xl font-semibold text-[#101828]">
            What happens after your request
          </h2>

          <p className="mt-3 text-sm leading-7 text-[#475467]">
            We will review your request and take the appropriate steps to
            delete eligible personal information associated with your
            account, subject to any information we are required to retain
            for legal, security, accounting, or other legitimate purposes.
          </p>

          <div className="mt-10 border-t border-[#EEF0F3] pt-6">
            <p className="text-xs text-[#98A2B3]">
              For privacy questions, contact{" "}
              <a
                href="mailto:hello@useshowwork.com"
                className="font-medium text-[#667085] hover:underline"
              >
                hello@useshowwork.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

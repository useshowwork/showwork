# Growth Marketing Workspace tier

Growth is ₦12,900 monthly for up to 10 client workspaces. It sits between Creator and Studio. Annual billing follows the existing 5% discount: ₦147,060 per year. Its allowances include 5 collaborators, 20 GB storage, 250 AI generations and 250 regenerations per cycle (regenerations also use the shared generation allowance).

Randy in AI Studio and its business research endpoints require Growth or higher. Creator retains AI content generation and business knowledge/brand voice tools. Studio and Agency retain Randy access. The existing full Agency trial and complimentary-access policies continue to determine effective plan access. The support-chat Randy is unaffected.

## Before releasing

1. Apply migration `20261106030000_workspace_growth_plan` through the normal migration deployment process. It adds GROWTH to the ContentWorkspacePlan enum without moving existing subscribers or changing their prices.
2. Create Paystack plans at ₦12,900 monthly (1,290,000 kobo) and ₦147,060 annually (14,706,000 kobo).
3. Configure their plan codes on the web deployment:

   PAYSTACK_CONTENT_WORKSPACE_GROWTH_MONTHLY_PLAN_CODE
   PAYSTACK_CONTENT_WORKSPACE_GROWTH_ANNUAL_PLAN_CODE

4. Regenerate Prisma, deploy the updated application, and rebuild/restart VPS processes that use the shared Prisma client or plan/feature policies. Apply schema changes before starting updated services.
5. Test monthly and annual checkout, payment verification/webhooks, a 10-client cap, upgrades/downgrades, and Randy access on the workspace owner's plan. Public pricing and billing pickers use the shared tier configuration.

Migration and external Paystack plan configuration have not been applied by the code change. Never change existing Creator/Studio/Agency Paystack plan prices to add this tier.

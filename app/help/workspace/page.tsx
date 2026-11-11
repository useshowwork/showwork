import { pageMetadata } from "@/lib/seo";
import type { Metadata } from 'next';
import WorkspaceHelpCenter from '@/components/help/WorkspaceHelpCenter';
import { workspaceGuides } from '@/lib/help/workspaceGuides';
export const metadata: Metadata = pageMetadata({
  "title": "Marketing Workspace & Content Calendar Help | Showwork",
  "description": "Learn to use Showwork for content planning, AI drafts, business knowledge, approvals, social publishing, inbox conversations, leads and reporting.",
  "path": "/help/workspace",
  "keywords": [
    "Showwork workspace help",
    "content calendar guide",
    "social publishing help"
  ]
});
export default async function WorkspaceHelpPage({ searchParams }: { searchParams: Promise<{ guide?: string | string[] }> }) {
  const params = await searchParams;
  const guide = typeof params.guide === 'string' && workspaceGuides.some(item=>item.id===params.guide) ? params.guide : undefined;
  return <WorkspaceHelpCenter initialGuideId={guide}/>;
}

export type WorkflowPost = {
  isAiDraft?: boolean; internalReviewStatus?: string; approvalStatus: string;
  publishStatus?: string | null; instagramPublishStatus?: string | null; tikTokPublishStatus?: string | null;
};
export function calendarWorkflow(post: WorkflowPost) {
  const statuses = [post.publishStatus, post.instagramPublishStatus, post.tikTokPublishStatus];
  if (statuses.includes('PUBLISHED')) return { stage: 4, label: 'Published', detail: 'Your content is live.', tone: 'green' } as const;
  if (statuses.includes('PUBLISHING')) return { stage: 3, label: 'Publishing', detail: 'Your content is being sent to the platform.', tone: 'blue' } as const;
  if (statuses.includes('SCHEDULED')) return { stage: 3, label: 'Scheduled', detail: 'Queued for its scheduled publishing time.', tone: 'blue' } as const;
  if (post.isAiDraft) return { stage: 0, label: 'Draft', detail: 'Ready for a manager to review and approve.', tone: 'slate' } as const;
  if (post.internalReviewStatus !== 'APPROVED') return { stage: 1, label: post.internalReviewStatus === 'NEEDS_CHANGES' ? 'Internal changes requested' : 'Pending internal review', detail: 'Team review comes first. This content is hidden from your client.', tone: 'amber' } as const;
  if (post.approvalStatus !== 'APPROVED') return { stage: 2, label: post.approvalStatus === 'NEEDS_REVISION' ? 'Client changes requested' : 'Awaiting client review', detail: 'Internally approved and available for your client to review.', tone: 'blue' } as const;
  if (statuses.includes('FAILED')) return { stage: 3, label: 'Publishing needs attention', detail: 'Approved content could not be published. Check the publishing details.', tone: 'amber' } as const;
  return { stage: 3, label: 'Ready to publish', detail: 'Both reviews are complete. Scheduling depends on auto-publish and platform settings.', tone: 'green' } as const;
}

export type CalendarStageFilter = "all" | "internal" | "client" | "publishing";
export function matchesCalendarStage(post: WorkflowPost, filter: CalendarStageFilter) {
  const stage = calendarWorkflow(post).stage;
  return filter === "all" || (filter === "internal" ? stage === 1 : filter === "client" ? stage === 2 : stage >= 3);
}

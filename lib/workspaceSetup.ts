export type WorkspaceSetupState = {
  enabled: boolean;
  publishingChosen: boolean;
  autoPublishEnabled: boolean;
  hasKnowledge: boolean;
  hasBrandVoice: boolean;
  hasChannels: boolean;
  hasContent: boolean;
  complete: boolean;
};
export const WORKSPACE_SETUP_STEPS = [
  { id: "publishing", label: "Publishing" },
  { id: "knowledge", label: "Business knowledge" },
  { id: "voice", label: "Brand voice" },
  { id: "channels", label: "Connect channels" },
  { id: "generate", label: "Create content" },
  { id: "content", label: "Review content" },
] as const;
export function workspaceSetupStep(state: WorkspaceSetupState) {
  if (!state.publishingChosen) return 0;
  if (!state.hasKnowledge) return 1;
  if (!state.hasBrandVoice) return 2;
  if (!state.hasChannels) return 3;
  if (!state.hasContent) return 4;
  return state.complete ? 6 : 5;
}
export function canGenerateDuringSetup(state: WorkspaceSetupState) {
  return !state.enabled || state.complete || (state.publishingChosen && state.hasKnowledge && state.hasBrandVoice && state.hasChannels);
}

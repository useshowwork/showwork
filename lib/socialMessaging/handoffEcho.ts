import { TEAM_ACKNOWLEDGEMENT } from "./handoffConsent";

const echoWindowMs = 30_000;

type Message = {
  id: string;
  text: string;
  direction: string;
  status: string;
  sentByCreatorId: string | null;
  platformCreatedAt: Date;
};

export function isHandoffAcknowledgement(message: Message) {
  return message.direction === "OUTBOUND" && message.sentByCreatorId === null && message.text === TEAM_ACKNOWLEDGEMENT;
}

export function handoffEchoWindow(date: Date) {
  return { gte: new Date(date.getTime() - echoWindowMs), lte: new Date(date.getTime() + echoWindowMs) };
}

export function withoutDuplicateHandoffEchoes<T extends Message>(messages: T[], tracked: ReadonlySet<string>) {
  const originals = messages.filter(message => tracked.has(message.id) && isHandoffAcknowledgement(message));
  return messages.filter(message => {
    if (tracked.has(message.id) || message.status !== "SENT" || !isHandoffAcknowledgement(message)) return true;
    const window = handoffEchoWindow(message.platformCreatedAt);
    return !originals.some(original => original.platformCreatedAt >= window.gte && original.platformCreatedAt <= window.lte);
  });
}

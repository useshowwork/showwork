export const REPLY_TONES = [
  {
    value: "professional",
    label: "Professional",
    description: "Clear, courteous, and confident.",
    instruction:
      "Use calm, courteous, confident language. Be approachable without sounding casual or bureaucratic.",
  },
  {
    value: "warm",
    label: "Warm & friendly",
    description: "Welcoming, relaxed, and still professional.",
    instruction:
      "Use warm, conversational language and natural contractions. Be welcoming without excessive enthusiasm, pet names, or forced familiarity.",
  },
  {
    value: "concise",
    label: "Direct & concise",
    description: "Get to the answer with fewer words.",
    instruction:
      "Lead with the answer in one to three short sentences. Keep courtesy but remove introductions and filler.",
  },
  {
    value: "premium",
    label: "Premium & polished",
    description: "Thoughtful, refined service without sales pressure.",
    instruction:
      "Use understated, polished, attentive language. Offer considered guidance without extravagant adjectives, flattery, or pushy upselling.",
  },
  {
    value: "empathetic",
    label: "Patient & empathetic",
    description: "Listen carefully and guide people through concerns.",
    instruction:
      "Acknowledge the specific concern briefly, then offer a practical next step. Be patient without over-apologizing, patronizing, or claiming to know how someone feels.",
  },
  {
    value: "upbeat",
    label: "Upbeat & engaging",
    description: "Positive and lively without sounding scripted.",
    instruction:
      "Use positive, energetic but professional language. Avoid hype, repeated exclamation marks, forced slang, and cheerfulness when the customer is upset.",
  },
] as const;

export type ReplyTone = (typeof REPLY_TONES)[number]["value"];
export type ReplyProfile = {
  tone: ReplyTone;
  allowWebSearch?: boolean;
  paymentInstructions?: string;
  industry: string;
  businessContext: string;
  pricingAndPolicies: string;
  qualificationQuestions: string;
  handoffRules: string;
};
export const REPLY_PROFILE_FIELDS = [
  { key: "paymentInstructions", label: "Approved payment instructions", limit: 1500, placeholder: "Payment methods, official checkout link, or business bank details you approve AI to share. Never include customer card details, PINs or passwords." },
  {
    key: "industry",
    label: "Industry",
    limit: 120,
    placeholder: "e.g. Event photography, skincare, real estate, hospitality",
  },
  {
    key: "businessContext",
    label: "Business, services & support",
    limit: 2000,
    placeholder:
      "What you sell, who you help, locations, business hours, contact details, and what makes your service useful.",
  },
  {
    key: "pricingAndPolicies",
    label: "Confirmed prices & policies",
    limit: 2000,
    placeholder:
      "Prices with currency and what is included, delivery times, booking requirements, refunds, and links customers can use. Only add confirmed facts.",
  },
  {
    key: "qualificationQuestions",
    label: "Questions that move things forward",
    limit: 1200,
    placeholder:
      "e.g. For event enquiries: event type, date, location, then coverage needed. Ask only for information the customer has not already shared.",
  },
  {
    key: "handoffRules",
    label: "When AI should offer your team",
    limit: 1200,
    placeholder:
      "e.g. Custom quotes, refund decisions, order-specific issues, or a customer asking to speak to a person. Include your support contact if appropriate.",
  },
] as const;

export function isReplyTone(value: unknown): value is ReplyTone {
  return REPLY_TONES.some((tone) => tone.value === value);
}
export function normalizeReplyProfile(value: unknown): ReplyProfile {
  const data =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const profile: ReplyProfile = {
    tone: isReplyTone(data.tone) ? data.tone : "professional",
    allowWebSearch: data.allowWebSearch === true,
    paymentInstructions: "",
    industry: "",
    businessContext: "",
    pricingAndPolicies: "",
    qualificationQuestions: "",
    handoffRules: "",
  };
  for (const field of REPLY_PROFILE_FIELDS)
    profile[field.key] =
      typeof data[field.key] === "string"
        ? (data[field.key] as string).trim().slice(0, field.limit)
        : "";
  return profile;
}
export function validateReplyProfile(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "Customer-care settings must be an object.";
  const data = value as Record<string, unknown>;
  if (data.allowWebSearch !== undefined && typeof data.allowWebSearch !== "boolean") return "Web search must be on or off.";
  if (!isReplyTone(data.tone)) return "Choose a supported reply tone.";
  for (const field of REPLY_PROFILE_FIELDS) {
    if (field.key === "paymentInstructions" && data[field.key] === undefined) continue;
    if (field.key === "paymentInstructions" && /\b(password|passcode|otp|cvv|cvc|pin|private key|card number)\b/i.test(String(data[field.key]))) return "Approved payment instructions must not contain private credentials or customer card details.";
    if (typeof data[field.key] !== "string")
      return `${field.label} must be text.`;
    if ((data[field.key] as string).length > field.limit)
      return `${field.label} must be ${field.limit.toLocaleString()} characters or less.`;
  }
  return null;
}

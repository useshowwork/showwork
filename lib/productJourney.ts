/** Product choice travels inside the auth return URL, including OTP and login/signup switches. */
export type EntryProduct = "workspace" | "delivery" | "portfolio";
type Query = { get(name: string): string | null };
const homes: Record<EntryProduct, string> = { workspace: "/dashboard/calendars", delivery: "/dashboard/projects", portfolio: "/dashboard/portfolio" };
const workspacePlans = ["CREATOR", "GROWTH", "STUDIO", "UNLIMITED"];
const deliveryPlans = ["STARTER", "GROWTH", "UNLIMITED"];

export function safeAuthReturn(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value) || value.trim() !== value) return null;
  try {
    const url = new URL(value, "https://showwork.invalid");
    return url.origin === "https://showwork.invalid" ? url.pathname + url.search + url.hash : null;
  } catch { return null; }
}
function productName(value: string | null): EntryProduct | null {
  if (value === "workspace" || value === "content-workspace") return "workspace";
  return value === "delivery" || value === "portfolio" ? value : null;
}
export function productDestination(product: EntryProduct, plan?: string | null, cycle?: string | null): string {
  const paid = product === "workspace" ? workspacePlans : product === "delivery" ? deliveryPlans : [];
  if (!plan || !paid.includes(plan)) return homes[product];
  const params = new URLSearchParams({ product: product === "workspace" ? "content-workspace" : "delivery", tier: plan, cycle: cycle?.toUpperCase() === "ANNUAL" ? "ANNUAL" : "MONTHLY" });
  return `/dashboard/billing?${params}#${product === "workspace" ? "workspace-plan" : "delivery-plan"}-${plan}`;
}
export function productEntryHref(product: EntryProduct, options: { plan?: string | null; cycle?: string | null; signedIn?: boolean } = {}): string {
  const destination = productDestination(product, options.plan, options.cycle);
  return options.signedIn ? destination : `/signup?next=${encodeURIComponent(destination)}`;
}
export function readProductJourney(params: Query): { product: EntryProduct | null; destination: string | null } {
  const next = safeAuthReturn(params.get("next"));
  const url = next ? new URL(next, "https://showwork.invalid") : null;
  const product = productName(params.get("product")) ?? productName(url?.searchParams.get("product") ?? null)
    ?? (url?.pathname.startsWith("/dashboard/calendars") ? "workspace" : url?.pathname.startsWith("/dashboard/projects") ? "delivery" : url?.pathname.startsWith("/dashboard/portfolio") ? "portfolio" : null);
  const plan = params.get("plan") ?? params.get("tier") ?? url?.searchParams.get("tier") ?? url?.searchParams.get("plan");
  const cycle = params.get("cycle") ?? url?.searchParams.get("cycle");
  if (product && plan) return { product, destination: productDestination(product, plan, cycle) };
  return { product, destination: next ?? (product ? homes[product] : null) };
}
export function journeyQuery(values: Record<string, string | string[] | undefined>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(values)) if (typeof value === "string") query.set(key,value);
  return query;
}

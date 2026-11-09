import { publishingFetch as fetch } from "@/lib/publishing/executionContext";

/** Safe to return to a manager. Never include provider messages, URLs or tokens. */
export class MetaDiscoveryError extends Error {
  constructor(public readonly code: string, message: string, public readonly diagnostics?: MetaDiscoveryDiagnostics, public readonly providerCode?: number, public readonly providerSubcode?: number) { super(message); }
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
  instagram_business_account?: { id: string; username?: string };
}
export type MetaDiscoveryDiagnostics = {
  discoveryStatus: "ACCOUNTS_FOUND" | "NO_FACEBOOK_PAGES" | "NO_INSTAGRAM_RELATIONSHIP" | "DISCOVERY_INCOMPLETE";
  facebookPagesFound: number;
  instagramAccountsFound: number;
  businessDiscovery: "NOT_GRANTED" | "CHECKED";
  sources: { accounts: number; granular: number; business: number };
  issues: { stage: "page_list" | "business_list" | "business_pages" | "page_token" | "instagram_link"; code: string; providerCode?: number; providerSubcode?: number }[];
};
export type MetaPageDiscoveryResult = MetaPage[] & { diagnostics?: MetaDiscoveryDiagnostics };

type TokenInfo = {
  is_valid?: boolean; app_id?: string; type?: string; user_id?: string;
  expires_at?: number; data_access_expires_at?: number; scopes?: string[];
  granular_scopes?: { scope: string; target_ids?: string[] }[];
};

async function get<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const version = process.env.META_GRAPH_API_VERSION || "v26.0";
  const url = new URL(`https://graph.facebook.com/${version}${path}`);
  url.search = new URLSearchParams(params).toString();
  let response: Response, body: any;
  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    body = await response.json();
  } catch {
    throw new MetaDiscoveryError("META_DISCOVERY_UNAVAILABLE", "Meta account discovery could not be reached. Try again shortly.");
  }
  if (!response.ok || !body || typeof body !== "object" || body.error) {
    if (body?.error?.code === 190) throw new MetaDiscoveryError("META_TOKEN_INVALID", "Your Meta authorization expired or is invalid. Reconnect with Facebook.");
    throw new MetaDiscoveryError("META_PAGE_ACCESS_FAILED", "Meta could not verify Page access or its Instagram relationship. Reconnect and grant access to the Page and linked Instagram account; check your Facebook Page assignment if this continues.", undefined, Number.isSafeInteger(body?.error?.code) ? body.error.code : undefined, Number.isSafeInteger(body?.error?.error_subcode) ? body.error.error_subcode : undefined);
  }
  return body as T;
}

export async function validateMetaUserToken(userToken: string, appId: string, appSecret: string): Promise<TokenInfo> {
  if (!userToken || !appId || !appSecret) throw new MetaDiscoveryError("META_APP_NOT_CONFIGURED", "The server's Meta app credentials are not configured.");
  const { data } = await get<{ data?: TokenInfo }>("/debug_token", `${appId}|${appSecret}`, { input_token: userToken });
  const now = Math.floor(Date.now() / 1000);
  if (!data?.is_valid || !data.user_id ||
    (data.expires_at && data.expires_at <= now) || (data.data_access_expires_at && data.data_access_expires_at <= now)) {
    throw new MetaDiscoveryError("META_TOKEN_INVALID", "Your Meta authorization expired or is invalid. Reconnect with Facebook.");
  }
  if (data.app_id !== appId || data.type !== "USER") {
    throw new MetaDiscoveryError("META_TOKEN_MISMATCH", "Meta returned authorization for a different app or token type. Restart the connection; the administrator should check the Meta app credentials.");
  }
  return data;
}

/** Uses provider-issued candidates only. Business listing never proves personal
 * Page access: every additional candidate needs a Page token issued to this user.
 * No permission is added to OAuth by this discovery service.
 */
export async function discoverMetaPages(userToken: string, config: { appId: string; appSecret: string; instagram?: boolean }): Promise<MetaPageDiscoveryResult> {
  const token = await validateMetaUserToken(userToken, config.appId, config.appSecret);
  const required = ["pages_show_list", ...(config.instagram ? ["pages_read_engagement", "instagram_basic"] : [])];
  const missing = required.filter(scope => !token.scopes?.includes(scope));
  if (missing.length) throw new MetaDiscoveryError("META_DISCOVERY_PERMISSION_MISSING", `Meta did not grant: ${missing.join(", ")}. Reconnect and allow these permissions for the client's Page and Instagram account.`);
  const diagnostics: MetaDiscoveryDiagnostics = {
    discoveryStatus: "NO_FACEBOOK_PAGES", facebookPagesFound: 0, instagramAccountsFound: 0,
    businessDiscovery: token.scopes?.includes("business_management") ? "CHECKED" : "NOT_GRANTED",
    sources: { accounts: 0, granular: 0, business: 0 }, issues: [],
  };
  function issue(stage: MetaDiscoveryDiagnostics["issues"][number]["stage"], error: unknown) {
    if (!(error instanceof MetaDiscoveryError)) throw error;
    if (stage !== "instagram_link" && ["META_TOKEN_INVALID", "META_TOKEN_MISMATCH"].includes(error.code)) throw error;
    // Deliberately omit provider messages, URLs, tokens and business names.
    diagnostics.issues.push({ stage, code: error.code, providerCode: error.providerCode, providerSubcode: error.providerSubcode });
  }
  let requests = 0;
  async function request<T>(path: string, params: Record<string,string>): Promise<T> {
    if (++requests > 100) throw new MetaDiscoveryError("META_DISCOVERY_LIMIT", "Meta returned too many assets to check in one attempt. Some accounts may be missing. Try authorizing only the client's assets.");
    return get<T>(path, userToken, params);
  }
  async function list<T>(path: string, fields: string, accept: (row: T) => void) {
    let after: string | undefined;
    const cursors = new Set<string>();
    do {
      const result = await request<{data?: T[]; paging?: {next?: string; cursors?: {after?: string}}}>(path, {fields, limit: "100", ...(after ? {after} : {})});
      if (!Array.isArray(result.data)) throw new MetaDiscoveryError("META_DISCOVERY_INVALID_RESPONSE", "Meta returned an incomplete account list. Please retry.");
      result.data.forEach(accept);
      after = result.paging?.next ? result.paging.cursors?.after : undefined;
      if (result.paging?.next && (!after || cursors.has(after))) throw new MetaDiscoveryError("META_DISCOVERY_PAGINATION_FAILED", "Meta could not return the complete account list. Please retry.");
      if (after) cursors.add(after);
    } while (after);
  }
  const pageGrants = token.granular_scopes ?? [];
  const listGrant = pageGrants.find(grant => grant.scope === "pages_show_list");
  const allowed = listGrant?.target_ids ? new Set(listGrant.target_ids) : null;
  const pages = new Map<string, MetaPage>();
  const candidates = new Map<string, "granular" | "business">();
  try {
    await list<MetaPage>("/me/accounts", "id,name,access_token,tasks", page => {
      if (/^\d+$/.test(page.id) && (!allowed || allowed.has(page.id))) {
        if (page.access_token) { pages.set(page.id, page); diagnostics.sources.accounts++; }
        else candidates.set(page.id, "granular");
      }
    });
  } catch (error) { issue("page_list", error); }
  const pageScopes = new Set(["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "pages_manage_posts", "pages_messaging"]);
  for (const grant of pageGrants) if (pageScopes.has(grant.scope) && token.scopes?.includes(grant.scope)) {
    for (const id of grant.target_ids ?? []) if (/^\d+$/.test(id) && (!allowed || allowed.has(id))) candidates.set(id, "granular");
  }
  // Meta's documented Business edges are supplementary and used only if this
  // token ALREADY has business_management. Never request it speculatively.
  if (diagnostics.businessDiscovery === "CHECKED") {
    const businesses = new Set<string>();
    try { await list<{id:string}>("/me/businesses", "id", row => { if (/^\d+$/.test(row.id)) businesses.add(row.id); }); }
    catch (error) { issue("business_list", error); }
    for (const business of businesses) for (const edge of ["owned_pages", "client_pages"]) {
      try { await list<{id:string}>(`/${business}/${edge}`, "id", row => {
        if (/^\d+$/.test(row.id) && (!allowed || allowed.has(row.id)) && !candidates.has(row.id)) candidates.set(row.id, "business");
      }); } catch (error) { issue("business_pages", error); }
    }
  }
  for (const [id, source] of candidates) {
    if (pages.has(id)) continue;
    try {
      const page = await request<MetaPage>(`/${id}`, { fields: "id,name,access_token" });
      if (page.id !== id || !page.access_token) throw new MetaDiscoveryError("META_PAGE_TOKEN_MISSING", "Meta did not issue a Page token for the authorizing user's assigned access.");
      pages.set(id, page); diagnostics.sources[source]++;
    } catch (error) { issue("page_token", error); }
  }
  for (const [id, page] of pages) {
    if (!page.name || !page.access_token) { pages.delete(id); issue("page_token", new MetaDiscoveryError("META_PAGE_TOKEN_MISSING", "Meta returned an incomplete Page.")); continue; }
    if (config.instagram) try {
      const relationship = await get<Pick<MetaPage,"instagram_business_account">>(`/${page.id}`, page.access_token, {fields:"instagram_business_account{id,username}"});
      page.instagram_business_account = relationship.instagram_business_account;
    } catch (error) { issue("instagram_link", error); }
  }
  diagnostics.facebookPagesFound = pages.size;
  diagnostics.instagramAccountsFound = [...pages.values()].filter(page => page.instagram_business_account?.id).length;
  diagnostics.discoveryStatus = diagnostics.issues.length ? "DISCOVERY_INCOMPLETE" : config.instagram && diagnostics.instagramAccountsFound ? "ACCOUNTS_FOUND" : !pages.size ? "NO_FACEBOOK_PAGES" : config.instagram ? "NO_INSTAGRAM_RELATIONSHIP" : "ACCOUNTS_FOUND";
  // When nothing is usable, do not disguise failed discovery as an empty list.
  if (diagnostics.issues.length && !(config.instagram ? diagnostics.instagramAccountsFound : pages.size)) {
    throw new MetaDiscoveryError("META_DISCOVERY_INCOMPLETE", "Meta could not finish checking your assigned accounts. Check Page access and the selected assets, then retry. This does not mean you have no Pages.", diagnostics);
  }
  const result: MetaPageDiscoveryResult = [...pages.values()];
  Object.defineProperty(result, "diagnostics", {value: diagnostics});
  return result;
}

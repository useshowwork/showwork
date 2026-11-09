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
  pages?: { pageId: string; name: string; tasks: string[] | null; instagramRelationship: "FOUND" | "NOT_RETURNED" | "CHECK_FAILED" | "NOT_CHECKED"; instagramAccountId: string | null }[];
  pagesTruncated?: boolean;
  accountsReturned?: number;
  accountsExcludedBySelection?: number;
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
  diagnostics.accountsReturned = 0;
  diagnostics.accountsExcludedBySelection = 0;
  const pages = new Map<string, MetaPage>();
  const candidates = new Map<string, "granular" | "business">();
  try {
    await list<MetaPage>("/me/accounts", config.instagram ? "id,name,access_token,tasks,instagram_business_account{id,username}" : "id,name,access_token,tasks", page => {
      diagnostics.accountsReturned!++;
      if (allowed && !allowed.has(page.id)) diagnostics.accountsExcludedBySelection!++;
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
      const page = await request<MetaPage>(`/${id}`, { fields: config.instagram ? "id,name,access_token,instagram_business_account{id,username}" : "id,name,access_token" });
      if (page.id !== id || !page.access_token) throw new MetaDiscoveryError("META_PAGE_TOKEN_MISSING", "Meta did not issue a Page token for the authorizing user's assigned access.");
      pages.set(id, page); diagnostics.sources[source]++;
    } catch (error) { issue("page_token", error); }
  }
  const failedRelationships = new Set<string>();
  for (const [id, page] of pages) {
    if (!page.name || !page.access_token) { pages.delete(id); issue("page_token", new MetaDiscoveryError("META_PAGE_TOKEN_MISSING", "Meta returned an incomplete Page.")); continue; }
    if (config.instagram && !page.instagram_business_account?.id) {
      // The authorizing user's token can expose delegated relationships that a
      // Page token cannot. Preserve relationships already returned by user-token
      // enumeration, and keep the Page token exclusively as the Page credential.
      let lookupError: unknown;
      for (const credential of [userToken, page.access_token]) {
        try {
          const relationship = await get<Pick<MetaPage,"instagram_business_account">>(`/${page.id}`, credential, {fields:"instagram_business_account{id,username}"});
          if (relationship.instagram_business_account?.id) {
            page.instagram_business_account = relationship.instagram_business_account;
            break;
          }
        } catch (error) { lookupError = error; }
      }
      if (!page.instagram_business_account?.id && lookupError) {
        failedRelationships.add(id);
        issue("instagram_link", lookupError);
      }
    }
  }
  // Explicit safe projection: never spread provider Page objects (they contain tokens).
  diagnostics.pages = [...pages.values()].slice(0, 25).map(page => ({
    pageId: page.id, name: page.name,
    tasks: Array.isArray(page.tasks) ? page.tasks.filter(task => typeof task === "string") : null,
    instagramRelationship: !config.instagram ? "NOT_CHECKED" : failedRelationships.has(page.id) ? "CHECK_FAILED" : page.instagram_business_account?.id ? "FOUND" : "NOT_RETURNED",
    instagramAccountId: page.instagram_business_account?.id ?? null,
  }));
  diagnostics.pagesTruncated = pages.size > 25;
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

/** Read-only support probe. A supplied ID is never added to discovery candidates
 * or accepted as connection evidence. Meta must authorize each request itself.
 * Only explicit safe projections leave this helper; credentials never do.
 */
export async function inspectMetaPageAccess(userToken: string, config: {appId: string; appSecret: string}, pageId: string) {
  if (!/^\d{5,30}$/.test(pageId)) throw new MetaDiscoveryError("META_PAGE_ID_INVALID", "Enter the numeric Facebook Page ID, not a Business Portfolio or Instagram ID.");
  const token = await validateMetaUserToken(userToken, config.appId, config.appSecret);
  const pageGrant = token.granular_scopes?.find(grant => grant.scope === "pages_show_list");
  const selection = pageGrant?.target_ids ? pageGrant.target_ids.includes(pageId) ? "SELECTED" : "NOT_SELECTED" : "UNSPECIFIED";
  const result: {
    readOnly: true; pageId: string; pageListSelection: string; pageName?: string;
    pageTokenIssued: boolean; pageCheck: string;
    userTokenRelationship?: {status: string; instagramAccountId?: string; username?: string; code?: string; providerCode?: number};
    pageTokenRelationship?: {status: string; instagramAccountId?: string; username?: string; code?: string; providerCode?: number};
    error?: {code:string; providerCode?:number; providerSubcode?:number};
  } = {readOnly: true, pageId, pageListSelection: selection, pageTokenIssued: false, pageCheck: "NOT_CHECKED"};
  function safeFailure(error: unknown) {
    if (!(error instanceof MetaDiscoveryError)) throw error;
    return {code:error.code,providerCode:error.providerCode,providerSubcode:error.providerSubcode};
  }
  let page: MetaPage;
  try {
    page = await get<MetaPage>(`/${pageId}`, userToken, {fields:"id,name,access_token"});
    if (page.id !== pageId) { result.pageCheck = "IDENTITY_MISMATCH"; return result; }
    result.pageTokenIssued = !!page.access_token;
    result.pageCheck = page.access_token ? "PAGE_TOKEN_ISSUED" : "NO_PAGE_TOKEN";
    if (typeof page.name === "string") result.pageName = page.name;
  } catch (error) { result.pageCheck = "ACCESS_CHECK_FAILED"; result.error = safeFailure(error); return result; }
  async function relationship(accessToken: string) {
    try {
      const response = await get<Pick<MetaPage,"instagram_business_account">>(`/${pageId}`,accessToken,{fields:"instagram_business_account{id,username}"});
      const ig = response.instagram_business_account;
      return ig?.id ? {status:"FOUND",instagramAccountId:ig.id,username:ig.username} : {status:"NOT_RETURNED"};
    } catch (error) { return {status:"CHECK_FAILED",...safeFailure(error)}; }
  }
  result.userTokenRelationship = await relationship(userToken);
  if (page.access_token) result.pageTokenRelationship = await relationship(page.access_token);
  return result;
}

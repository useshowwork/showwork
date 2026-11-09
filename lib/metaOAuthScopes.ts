/** Enable separately for each Meta app only after verifying its approved access
 * level. A token grant is still checked by discovery; this flag grants nothing.
 * Existing connections and the default OAuth permissions are unchanged.
 */
export function metaBusinessManagementScopes(channel: "instagram" | "facebook"): string[] {
  const setting = channel === "instagram"
    ? process.env.INSTAGRAM_REQUEST_BUSINESS_MANAGEMENT_SCOPE
    : process.env.FACEBOOK_REQUEST_BUSINESS_MANAGEMENT_SCOPE;
  return setting === "true" ? ["business_management"] : [];
}

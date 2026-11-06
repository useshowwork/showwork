# Marketing Workspace homepage positioning — 6 November 2026

## Positioning sources

Read the supplied Strategy Bible and Operational Playbooks 04 and 06. Their central direction is connected marketing operations: business knowledge, execution, customer conversations, team coordination and marketing intelligence. Prioritise established business teams, while retaining distinct agency and independent social media manager paths. Communicate recognisable problems and concrete workflows in clear, practical language.

The documents are strategy references, not evidence that every proposed capability is live. Their hypothetical ₦69,900 business price, proposed targets and research milestones were not adopted as product facts. Current commercial values remain in `lib/contentWorkspaceEntitlements.ts`.

## Page changes

- Lead with the team outcome and explain the connected workspace in the hero.
- Make analytics and AI recommendations visible before the existing content workflow. Explain the path from synced performance to evidence, recommendations and content planning.
- Give customer conversations a dedicated explanation, separating team-reviewed AI drafts from opt-in automatic replies and team takeover.
- Explain shared business knowledge and team continuity without promising exhaustive source understanding.
- Present Randy as a research partner for exploring market questions and campaign direction, with confirmation for research and knowledge updates.
- Add business demo, agency evaluation and independent manager signup paths. Keep Project Delivery and Portfolio as distinct secondary products.
- Preserve existing pricing, trial links, demo modal, signed-in destinations and content workflow interaction.

## Implementation evidence and limits

| Communication | Implementation evidence | Access / conditions |
| --- | --- | --- |
| Basic and advanced analytics | `lib/reporting/data.ts`, reporting adapters, entitlement configuration | Basic on all plans; advanced from Studio. Metrics depend on permissions, channel and synced history. |
| AI performance recommendations | `app/api/calendars/[id]/reporting/analyze/route.ts` | Studio+. Uses available metrics and business knowledge; requires data and AI allowance. |
| Recommendation into generation | `lib/reporting/recommendationHandoff.ts`, generator integration | User-directed planning, not autonomous optimisation or guaranteed performance. |
| AI reply drafting | `app/api/calendars/[id]/inbox/[conversationId]/draft/route.ts` | Studio+. Business knowledge context; team reviews and sends. |
| Automatic replies and takeover | `lib/socialMessaging/autoReply.ts`, `dispatchAutoReply.ts`, inbox conversation/settings routes | Agency, opt-in, eligible messages and permissions; team can take over. |
| Randy research | `app/api/calendars/[id]/research/route.ts`, `lib/knowledge/randy/`, research service | Growth+. Confirmation and role checks apply. |

All illustrative workflow/chat content remains labelled. No invented customer metrics, endorsements, competitor comparisons or guaranteed business outcomes were added. No confidential PDF content or files are served publicly. This is local source validation, not a live production publishing, messaging or AI acceptance test.

## Official editorial brief implementation

The subsequent official landing-page brief replaces the previous card-led homepage layout. Implemented all nine supplied photographic sections, problem-first narrative, interactive connected foundations, five product tabs, five workflow stages, business-led audience journeys, distinct Project Delivery introduction, practical adoption section, FAQs, pricing and final CTA. Header and footer use real product, help, blog, legal and local section destinations. Business and agency journeys open the existing demo-request flow; they do not claim a new consulting/onboarding service or instant confirmed booking.

### Asset provenance

- Supplied `public/images/landing/1.webp` through `9.webp` retained unchanged.
- Actual mobile asset is named `1mobile.webp`, not `1mob.webp`. A native responsive picture serves only the applicable hero image with eager loading and high fetch priority. Other photography uses lazy Next Image rendering, responsive sizes and reserved aspect ratios.
- User explicitly approved using cropped views from previously shared desktop screenshots. Browser chrome and unrelated page information were excluded. Generated assets contain the original UI pixels resized/compressed as WebP, not AI-generated dashboards.
- `product/knowledge.webp`: shared 6 November 07:47:54 screenshot; `product/planning.webp`: shared 5 November 22:30:03 screenshot; `product/review.webp`: shared 5 November 22:37:22 screenshot. They document captured product views and may show earlier styling, not a claim to be a new live capture.
- Project Delivery uses the existing genuine `public/images/deli.png` interface asset.
- No suitable actual screenshot was available for messaging/intelligence. Those panels use supplied editorial photographs and capability captions, clearly distinguished from screenshot captions. New screenshots remain a future asset improvement; no fictional interface was substituted.

### Interaction and validation scope

Native details menus and FAQs support keyboard activation. Product/foundation/workflow tabsets use selected states, roving tab focus, Left/Right/Home/End navigation and labelled panels. The header responds to Escape/outside clicks, and the mobile menu provides visible destinations and a demo action. IntersectionObserver provides one-time reveals and active section indication without continuous scroll listeners; reduced-motion users see static content. All content remains visible without animation support.

Local checks cover TypeScript, SSR navigation/anchor invariants, image presence, mobile hero selection, tab relationships, current trial/plan boundaries and shared footer destinations. Browser viewport, screen-reader and Core Web Vitals measurements have not been performed in this tool session; the brief's performance thresholds are targets, not measured results. No database, publishing worker, billing or production deployment changes were made.

## Editorial simplification after review

The user's latest direction supersedes the nine-image structure: shorten the page, remove photography from the problem section, reduce words and repeated explanations, and retain purposeful interaction. Removed the separate foundations and adoption narratives, the repeated workflow screenshot, audience photograph and closing photograph. The problem is now a compact text composition; product tabs hold feature depth; the five-stage workflow is an interactive strip; audience paths and Project Delivery have concise copy. Hero photography and genuine product screens carry the visual story. Reduced section spacing, shortened feature descriptions, consolidated FAQs, and condensed the homepage-only footer. Original image assets remain available unchanged. No new product claims or commercial changes.

## Product representations replace screenshots

Per the latest user direction, all homepage product screenshots and feature photographs were replaced with code-native illustrative scenes for business knowledge, content planning, team approvals, AI reply drafting, performance recommendations and Project Delivery. The interactive tabs remain. Scenes are labelled “Illustrative example”; no invented performance numbers or fake customer evidence are used. Hero photography stays. The three screenshot crops created for the previous iteration were removed from public assets now that they are unused.

## Flow and team imagery refinement

Replaced the horizontal process selector with a top-to-bottom ordered timeline. Connected numbered nodes animate between reader-selected steps; each button expands its concise explanation and supports Up/Down/Home/End navigation. No auto-advance or scroll control is introduced, and reduced-motion disables transitions. Restored supplied photograph 4 beside the workspace introduction and photograph 9 at the team-oriented final CTA. Product examples remain code-native representations; the problem remains text-only.

## Primary brand colour correction

Showwork blue is the primary brand. Replaced the green-led page palette with blue actions, pale blue surfaces, blue interface representations and navy supporting sections. Timeline active nodes and connectors use official blue tokens. Existing layout, photography and interactions remain unchanged.

## Customer enquiries solution

Added unanswered enquiries to the problem narrative and a dedicated after-hours response section. It explains that delayed replies can lose interest, then presents business-aware opt-in automatic replies and team takeover. Product-tab and FAQ copy use the same positioning. Channel eligibility, permissions and messaging-window limitations remain visible; no sales-conversion guarantee is made.

The existing highest Marketing Workspace plan is Agency (`UNLIMITED`), currently ₦59,900/month; no new “Genius” subscription was invented. Its solution CTA targets `/dashboard/billing?product=content-workspace&tier=UNLIMITED&cycle=MONTHLY#workspace-plan-UNLIMITED`. Existing login/signup return paths preserve the product/tier/cycle; the billing UI now highlights and scrolls to the requested workspace plan after authentication. Non-paid accounts and trial users can explicitly open the existing quote-and-confirm checkout for a plan; existing paid subscribers retain the existing plan-switch flow. Visiting the link does not start checkout or payment automatically.

## Sculpted section transitions

Added three decorative, code-native SVG joins inspired by the Showwork overlapping-frame mark: hero/problem, customer-enquiries/process (fourth/fifth main sections), and final CTA/footer. Each uses a distinct smooth stepped contour, layered official blue accents and the following section's surface colour. Decorative elements are hidden from assistive technology and do not receive pointer events. CSS view timelines provide progressive scroll-linked transforms where supported; other browsers get the static contour and reduced-motion disables animation. No scrolling control, continuous JS listeners or animation dependency was added.

The supplied reference website could not be retrieved through the web tool or local network, so its exact behavior was not verified. This implementation is an original interpretation of the requested transition, not a verified reproduction. Full browser scrolling/viewport QA remains unperformed.

## Reference clarified by supplied transition screenshots

The supplied three Sobha screenshots establish a full-section overlap and expansion: an inset content panel with large upper corners rises over the preceding section, expands to the viewport edges and straightens as scrolling continues. Replaced the previous decorative SVG joins with a wrapper around the real problem section, process section and footer. The content is never scaled or duplicated. Opening/footer panels use a larger left corner; the process panel reverses the asymmetry. Negative overlap and preceding-section bottom spacing keep content clear.

A passive, requestAnimationFrame-coalesced listener updates clipping geometry only while each panel is near the viewport. Motion reverses on upward scrolling, respects live reduced-motion preference changes and cleans up observers/listeners. Unsupported observers or reduced-motion users receive the fully open layout. Keyboard focus inside a panel bypasses clipping. Lifecycle tests cover opening, reversing, preference changes and teardown. These checks do not replace browser scrolling/visual QA, which remains unperformed.

## Verified transition correction in Chrome

Corrected the early expansion and moving backdrop after the user's follow-up. The previous scene now stays sticky while its incoming content surface rises. The panel holds its inset/rounded silhouette until roughly the upper 38% of the viewport, then physically widens through margins and corner radii as it approaches the header. This replaces content clipping, which could cut text near a curved edge. Related sections share the same white/navy surface so the effect needs no empty full-screen spacer. Pointer interactions preserve the motion; keyboard-visible focus opens the panel for readability.

The footer uses its available end-of-document travel rather than a header position it cannot reach. Browser captures confirmed its inset and radii reach zero at the bottom. Mobile uses natural document flow rather than pinning a hero taller than the device. The dedicated mobile hero source remains selected correctly.

Verified against localhost in isolated headless Chrome at 1440×900, 768×1024 and 390×844. Measured desktop backdrop top remained 86px through the reveal; opening inset progressed about 79→75→24→0px at successive scroll positions, process and footer reached full width, and all three panels became static/full-width under reduced motion. No horizontal overflow at tested widths and no console errors on the final page load. These are browser geometry/screenshots and reduced-motion checks, not Core Web Vitals measurements or a live Sobha interaction recording. Sobha's live browser view was Cloudflare-blocked; the supplied transition screenshots remained the visual reference.

## Mobile pinned reveals

Enabled the same pinned-backdrop panel reveal on phones at all three boundaries. Mobile surfaces retain their narrower insets and asymmetric corners, then expand to full width. For a section taller than the phone viewport, the sticky top is `min(header bottom, viewport height − section height)`: readers can scroll through the complete section before its lower content holds behind the incoming surface. Resizing recalculates this value, and teardown/reduced-motion changes remove it.

Verified in isolated Chrome phone emulation at 390×844, with overflow checks at 375×812 and 320×720. All three mobile panels reached zero inset/radius at their open position; sticky backdrops held at the measured offsets, the dedicated mobile hero loaded, no horizontal overflow or console errors were observed, and reduced-motion restored natural/static flow. Captures were reviewed for the opening and process panels. Native iOS Safari was not separately tested.

## Product explorer redesign

Replaced the horizontal underline tabs and oversized checklist illustration with one bordered explorer: a vertical feature rail on desktop, a touch-scrollable selector on smaller screens, a visual canvas, and concise outcome copy/action beneath it. Removed the old representation renderer and obsolete homepage style rules. The new `WorkspaceFeatureVisual` component provides distinct code-native scenes for business context, content planning, team review, customer replies and recommendations; it is also reused in the dedicated customer-replies section. No screenshots or generated bitmap dashboards were introduced.

The knowledge scene uses selectable Documents / Website / Brand voice inputs, connecting lines and a blue business-context core. Selecting a source updates the core text, with a polite live announcement. Other scenes represent editorial content cards, review handoffs, a contextual reply and evidence-to-action. All are labelled illustrative; commercial gates and the Agency subscription destination remain unchanged. Reduced-motion disables entry transitions.

Verified all five views in isolated Chrome at 1440px and 390px, source selection, End-key tab selection/focus, and responsive overflow at 320, 375 and 768px. No console errors were recorded. TypeScript and the 16 focused homepage/help/transition checks passed. This is presentation validation, not a production AI/messaging/publishing test.

## Connected customer inbox value section

Replaced the AI-only enquiry illustration and longer narrative with a business-focused connected-inbox solution: “Your next customer shouldn’t have to wait.” Short copy explicitly names WhatsApp, Instagram and Facebook, shared team handling, business-aware AI replies and human takeover. The primary CTA is now “Get started with Agency”, using the existing highest-plan billing destination; the secondary opens the demo modal. Agency pricing remains configuration-driven. Opt-in, channel permissions and reply-window conditions remain in a short note. Unified inbox/drafting entitlements were not changed; this section sells the Agency automation bundle.

New `ConnectedInboxVisual` uses the repository's platform logos and shows three channels converging into one inbox. Selecting a thread changes the channel, enquiry and illustrative AI reply. It does not send messages or connect accounts. Phone layouts use a compact channel selector. No screenshot assets or invented sales statistics were added.

Added an incoming `replies` surface reveal in addition to the outgoing process reveal. The previous scene pins at its lower edge inside a bounded sequence. Nested surfaces use `overflow: clip` so their descendants' sticky positioning remains functional; a replies surface does not inherit the entire previous scene's minimum height. SSR/no-JS baseline remains natural flow for the new pinned scene. Reduced-motion resets the positioning and expansion.

Browser validation after hydration confirmed ~77px inset/223px upper corner at the rounded state, zero inset/radius near the header, and a stationary preceding scene. Verified all three channel choices, the Agency URL, no overflow at 1440, 768, 390 and 320px, reduced motion and no console errors. Focused tests assert platform assets, Agency CTA and the new reveal. Backend inbox source checks found existing Meta/WhatsApp messaging handling; this task performed no live messaging acceptance test.

### Product-specific signup journeys

Product CTAs now preserve Marketing Workspace, Project Delivery or Portfolio as an internal auth return destination. Signup verification and login return directly to that app, bypassing the generic welcome page. Workspace and delivery pricing CTAs include the exact tier and monthly/annual cycle inside the encoded return URL; billing highlights the chosen plan and still requires payment confirmation. Existing sessions bypass the signup/login form. Workspace/delivery signup preselects the corresponding account role without another product choice. Legacy pricing query parameters are supported; external return URLs are rejected.

Validation: mocked signup/OTP/login flows, all paid tiers and cycles, rendered pricing buttons, existing-session redirects, homepage navigation and billing regression checks. No real signup, email, payment or database migration was performed.

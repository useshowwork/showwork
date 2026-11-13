# Recommendation audit — 13 November 2026

## Scope and conclusion

Reviewed the Marketing Workspace Analytics & Reporting recommendation flow, interpreting “Spotlight” as the recommendations described in the request. The `/spotlight` route is a separate creator competition. This is a source-code audit, not an analysis of live customer data or a live model evaluation. No application behavior was changed.

The existing system generates several performance findings from a limited report snapshot. It does not assemble one prioritized strategy, establish causal attribution, or learn from the outcome of an earlier recommendation. A prompt-only change would improve presentation but cannot supply missing evidence.

## Findings

1. **The output contract requires fragmentation.** `lib/openai.ts`, `generateReportingInsights`, requests 2–5 findings, validates an array of up to five, and uses WHAT_WORKED / UNDERPERFORMED / TREND / RECOMMENDATION types. `ReportingInsights.tsx` renders individual cards with per-card generation and Apply all. `CalendarReportingPanel.tsx` selects the first actionable finding for Your next step; this is array selection, not explicit strategic prioritization.
2. **Paid distribution cannot be assessed from the supplied input.** The analyze route supplies no boost status, ad campaign identity, spend, paid/organic separation, targeting or promotion dates. Reporting models have general JSON fields, but the recommendation mapping does not pass those through. Unknown promotion must remain unknown, never default to organic. High totals alone cannot establish that creative quality caused performance.
3. **Business context exists, but campaign context is incomplete.** `getBusinessKnowledgeContext(..., "analytics")` includes workspace profile, brand personality, a business overview, selected source passages and eligible saved research. The request does not explicitly supply current campaign objectives, constraints, promotion annotations or manager explanations. The retrieval query is generic. It is inaccurate to say the system has no context; it lacks the context needed for these decisions.
4. **The evidence window is limited.** The endpoint sorts available selected-period posts newest-first and sends at most 100. Platform-native source queries also cap posts at 500 per connection across current and comparison periods. `totalPostCount` counts the assembled records, not independently verified complete platform history. Only first/last selected snapshots are sent for Showwork posts; native posts carry current lifetime counters. Previous-period aggregates are supplied, but previous-period post-level creative evidence is not. There is no normalized equal-age post cohort analysis in the recommendation path.
5. **Creative treatment is not inspected.** The model receives captions, post type and a category where available. It receives no images, video frames, transcript, hook analysis, retention curve or comment text. It therefore cannot substantiate claims about why the visual, opening or audience reaction worked. Post clicks and engagement-rate denominator metadata are also omitted from the insight payload despite existing snapshot fields.
6. **Business outcomes are aggregate.** Supplied lead totals and stages do not establish which post or campaign produced qualified enquiries or purchases. Engagement and sales intent must not be treated as equivalent.
7. **Research is reused rather than initiated.** This analysis call does not enable web search or launch a research run. The context helper can append saved successful research completed within 30 days, including a fallback run whose source fingerprint differs. External research can motivate a hypothesis; it cannot explain private ad delivery or prove account-specific causation.
8. **Evidence and memory are weakened at presentation and handoff.** A separate `evidence` field is saved in supportingData, but Explore the evidence displays `description`. Handoff also passes description rather than the separate evidence field. Refresh deletes/replaces matching period/platform insights; prior recommendations and their outcomes are not inputs. The same record does not explicitly retain the exact selected platform set for a cross-channel finding, risking overlapping scopes being mixed in later views.

## Recommended design

Produce one decision per workspace and exact analysis scope, backed by multiple internal observations. Its contract should contain: problem; relevant evidence references; business objective; constraints and alternative explanations; confidence and missing information; one prioritized recommendation; experiment specification; review date; and a success metric. Continue/change/pause decisions should be subordinate to that single direction, not independent generic instructions per successful post.

Build the evidence before calling the model:

- Record campaign objective, audience, offer, distribution status (paid / organic / mixed / unknown), promotion dates and known interventions. Start with manager annotations; add provider ad integrations only after verifying available permissions, identifiers and metrics for each channel.
- Normalize comparisons within account, platform, objective, distribution type, format and equal observation age where data permits. Preserve unavailable values, freshness and metric definitions. Separate observed facts, supported associations and untested hypotheses.
- Aggregate the complete available scoped history before sampling examples. Include previous-period cohorts and coverage disclosures. Do not claim all-time learning if history is incomplete.
- Add permissioned creative evidence and post/campaign outcome attribution where available. Abstain from unsupported claims when creative evidence, retention or attribution is missing.
- Use targeted research when a specific external question matters; save sources and dates. Do not search private campaign data. Ask the manager a focused contextual question when only the manager can supply the answer.
- Save recommendation versions, scope, source IDs, rationale, experiment and evaluation outcome. Subsequent analysis should compare the expected result with what actually happened.

## Product output

Present one primary panel: Situation → Why this matters → Constraints/unknowns → Recommended next move → How to judge it. Show supporting post groups and sources beneath the rationale. Replace per-post creation and Apply all with Create a plan from this recommendation. Carry the evidence, constraints and test into the brief; do not apply one winning format across every post.

Illustrative output, not a finding about any current account: “The leading post has the most reach, but its promotion status is unknown, so this is insufficient evidence to repeat its format across the calendar. Run one small, comparable organic test of the strongest recurring topic while preserving the rest of the content mix. Compare results at the same post age against similar organic posts using the campaign's primary outcome, then decide whether to expand.” If promotion context is essential to the decision, the immediate recommendation may instead be to confirm it before changing the calendar.

## Delivery sequence and acceptance

1. One structured recommendation, visible rationale/evidence, exact scope, explicit unknown promotion status, and a focused question when needed.
2. Campaign annotations, comparable cohorts, coverage/freshness rules and paid/organic evidence where supported.
3. Creative inspection, targeted cited research, versioned experiments and outcome evaluation.

Acceptance cases: boosted outlier; unknown promotion; young versus mature post; high engagement but weak qualified enquiries; sparse data; missing creative evidence; conflicting research; incomplete sampling; selected-platform scope; and a previous recommendation that failed. Verify exactly one recommendation, traceable evidence and no unsupported causal or sales claims. Existing UI/handoff and arithmetic tests are useful regressions, not tests of recommendation intelligence.

## Verification performed

Ran the existing reporting comparison and recommendation tests: 25 passed, 1 failed. The failure is `applying filtered recommendations twice populates the mounted generator and submits the latest batch` at `tests/reporting-recommendations.test.cjs:233`, where the test reads `.props` from an undefined element. This audit made no application changes; the failure requires separate investigation and does not establish a production failure. No live provider or model calls were performed.

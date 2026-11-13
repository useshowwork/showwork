exports.legacyStrategy = (direction = 'Prioritize wedding-package decision guides') => ({
  version: 1, status: 'READY', title: 'A month of better wedding enquiries', objective: 'Qualified wedding enquiries', diagnosis: 'Reach does not establish purchase intent', direction, rationale: 'Address the documented package questions', confidence: 'LOW', challenges: ['Promotion status is unknown'], questions: [],
  evidence: [{ sourceId: 'post:one', observation: 'One post reached 100 people; promotion is unconfirmed' }],
  contentMix: [{ decision: 'TEST', topic: 'Choosing a wedding package', format: 'Carousel', sharePercent: 70, reason: 'Resolve purchase questions' }, { decision: 'CONTINUE', topic: 'Documented project examples', format: 'Reel', sharePercent: 30, reason: 'Support the decision with existing work' }],
  weeks: Array.from({length: 4}, (_, i) => ({ week: i+1, theme: `Decision stage ${i+1}`, audience: 'Couples comparing packages', hooks: ['Which coverage fits your day?'], proof: 'Use documented package inclusions only', callToAction: 'Ask about suitable coverage' })),
  channels: [{ platform: 'INSTAGRAM', postsPerWeek: 2, execution: 'Use carousels for comparisons' }],
  measurement: { primaryMetric: 'Qualified enquiries', successRule: 'Compare with recorded baseline; establish one if missing', review: 'Review weekly and after the month', experiment: 'Test the package question theme against comparable organic posts once promotion is confirmed' }
});

exports.strategy = (direction = 'Prioritize wedding-package decision guides') => ({
 version: 2, title: 'Help couples choose the right coverage', objective: 'Qualified wedding enquiries',
 working: 'Package examples are attracting attention.', diagnosis: 'Reach does not establish purchase intent.',
 direction, rationale: 'Resolve documented package questions with concrete comparisons and existing project examples.',
 confidence: 'LOW', limitation: 'Promotion status is unknown.',
 evidence: [{ sourceId: 'post:one', observation: 'One post reached 100 people; promotion is unconfirmed.' }]
});

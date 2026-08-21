// hitbut — this repo's own rules: the ones that are true here and portable nowhere.
// Seeded empty at adoption; everything in it is this repo's to write. A lesson that
// would hold in another repo belongs in a canon pack instead — propose it upstream.
export default {
  id: 'hitbut',
  version: 1,
  ruleRoutingGuidance: {
    belongs: 'working rules and lessons specific to this repository and not portable to any other',
    excludes: 'anything true beyond this repo — that belongs in a canon pack, proposed upstream',
  },
  detect: null,
  marker: null,
  prose: 'RULES.md',
  worldRules: [],
};

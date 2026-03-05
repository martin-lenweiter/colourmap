# @contractspec/app.web-colourmap-application

## 0.3.0

### Minor Changes

- 03267db: Colour Map 1-month implementation plan: contracts, safety boundaries, onboarding context upload, summary correction, data controls (export/delete), and privacy disclaimers.

### Patch Changes

- 6efdaca: AI-native governance and discoverability: add comprehensive llms.txt and robots.txt to all 4 apps, create 5 new governance rules (prompt-engineering, mcp-governance, ai-provider-governance, ai-safety, data-governance), expand security.md with AI-specific patterns, sync all rules via agentpacks
- 03267db: ColourMap 3-month plan: priority engine, practice lifecycle, weekly/monthly reflection, ALYN contracts
  - WS1: Full prompting priorities (acute, staleness, misalignment, pattern, broadening)
  - WS1: Practice suggestion flow with adopt/tune/dismiss, one-at-a-time constraint
  - WS1: Weekly/monthly reflection prompts based on last session date
  - WS2: ALYN practice handoff and adherence feedback contracts

- 03267db: Colourmap 6-month plan: WS1 pattern detection, WS2 wider-view trends
  - Add ColourmapPatternFlag schema and migration
  - Pattern detection pipeline (8+ weeks history, confidence-scored flags)
  - User confirm/dismiss API for pattern validity
  - Wider-view state history API (all 3 spaces)
  - Wire patternFlags into state API and data export

- a441819: Voice and AI-Agent audit: standardize voice on providers-impls, add lib.ai-agent/lib.ai-providers to colourmap, jarvis, hcircle. Voice logic extracted to colourmap-product; listVoices endpoint; callCoach and narrative providers migrated to AI SDK; HCircle agent factory for MCP connectivity.
- Updated dependencies [03267db]
- Updated dependencies [03267db]
- Updated dependencies [03267db]
- Updated dependencies [a441819]
  - @contractspec/bundle.colourmap-product@0.5.0
  - @contractspec/lib.database-colourmap-product@0.4.1

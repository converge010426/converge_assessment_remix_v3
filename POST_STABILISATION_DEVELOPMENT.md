# CONVERGE ASSESSMENTS — POST-STABILISATION DEVELOPMENT RECORD

Purpose: permanent handover record for structural improvements and deferred work. This file is documentation only; it does not authorize implementation of the items below.

## Operating rule
Current priority remains:
**STABILITY > MINIMAL CHANGE > CORRECT ASSESSMENT FLOW > FINAL POLISH**
No structural refactor is to be mixed into production stabilisation or Phase 1–4 report work unless separately authorised.

## Post-stabilisation structural backlog

### 1. Make the landing page a self-contained module
Goal: make the complete customer-facing landing page a portable, archivable unit.

Desired future structure:
    src/landing/
      LandingPage.tsx
      landingContent.ts
      landingStyles.css
      assets/
        approved hero/banner asset

Requirements:
- The landing page should be removable, archived, restored, or moved to another platform with minimal impact on questionnaire, reports, payment, or backend code.
- App.tsx should act primarily as the application shell/router rather than containing the whole landing page.
- Preserve the exact approved customer-facing design and wording when extracting it.
- Do not redesign during extraction.

### 2. Establish clear application module boundaries
Target conceptual structure:
    LANDING
    QUESTIONNAIRE
    RESULTS / SCORING
    REPORTS
      MBTI
      COMPREHENSIVE
      CANDIDATE SUITABILITY
    PAYMENT
    APPLICATION SHELL / ROUTING
    SHARED SERVICES

Goal: allow one area to be worked on, archived, tested, or moved without disturbing unrelated areas.

### 3. Create a protected production baseline
Maintain a clearly identified, known-good production commit/tag after stabilisation.
The baseline must include:
- approved landing page/banner
- working Begin Assessment
- working Return Home
- 76-question assessment
- correct product selection
- correct product retention
- correct report routing
- working payment behaviour
Future structural work should branch from this baseline and remain independently reversible.

### 4. Separate assessment-session state from product selection
Required marketplace behaviour:
**One completed 76-question assessment -> additional reports reuse the same answers.**
The system must distinguish:
- same candidate / same completed assessment requesting another report
- genuinely new candidate / new assessment
Do NOT clear the 76 answers merely because the user selects MBTI, Comprehensive, or Candidate Suitability.
A genuinely new candidate must start with a clean assessment.
This needs a deliberate state model rather than another temporary workaround.

### 5. Make answer persistence a first-class assessment-session component
Current code already contains persistence/replay mechanisms in src/v2MarketFixes.ts.
Future work should consolidate this into a clearly owned assessment-session module so that:
- answers survive Return Home when appropriate
- answers can be reused for additional reports
- candidate identity changes invalidate the prior assessment
- persistence behaviour is testable independently
- no DOM simulation/replay hack is required if a cleaner state handoff can be achieved without changing behaviour

### 6. Isolate report modules
Reports should eventually have clear independent ownership:
    reports/
      mbti/
      comprehensive/
      candidate-suitability/
      shared/
Goal:
- report-specific wording/layout changes should not affect questionnaire logic
- one report can be tested independently
- Phase 1/2 refinements can be traced to the affected report module
- future handovers can identify exactly where report behaviour lives

### 7. Isolate payment
Payment configuration and checkout behaviour should remain independent of landing/questionnaire/report presentation.
Preserve the existing server-side pricing model and approved payment configuration.

### 8. Create a formal handover/change ledger
Keep a permanent record of:
- production baseline commit
- approved fixes
- Phase 1–4 commits
- deployment IDs
- known-good deployment
- intentionally rejected/contaminated commits
- deferred structural work
- test status
This record should be updated whenever a major production milestone is completed.

## Known recovery references
Clean navigation/questionnaire base:
- 24f5194dc817f975fae293724f86f96262ac70f1
Current product/navigation recovery reference:
- fcab8824d9ea72f8fa318019d7ba7ef93e5fa285
Return Home:
- 0dfbf0db1df653e93061bd923e23d775907e3089
Payment final fix:
- b6c384fa21b46a7e49cb39772182223633591461
Phase 1:
- d2f9c977ea4594cd4a18a7bf14dd7f9cf4712012
Phase 2:
- 8551651913a4da6509f6938c93b5b6688311b786
Phase 3:
- diagnostic only; no code commit
Phase 4A:
- 63bc439efe82a5c2b7ec0553adc177950cf8c6f0
Contaminated commit — DO NOT use as production base:
- 6feef92c10eeab2a420345b4dd164dbf53bb3f52

## Immediate work sequence
1. Finish and verify the approved landing page.
2. Verify Begin Assessment without refresh.
3. Test MBTI end-to-end.
4. Test Comprehensive end-to-end.
5. Test Candidate Suitability end-to-end.
6. Test Return Home.
7. Test product selection and retention.
8. Confirm the completed 76 answers can be reused for additional reports without repeating the questionnaire.
9. Establish a known-good production baseline.
10. Begin Phase 1–4 report work from that stable baseline.
11. Only after stabilisation: address this structural backlog.

## Handover rule for future chats
A new chat should treat this file as the authoritative list of deferred structural improvements. Do not re-invent these items, and do not implement them merely because they are listed here. They remain deferred until the stabilised production baseline is confirmed.
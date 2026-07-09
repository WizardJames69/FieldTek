---
target: landing page (src/pages/Landing.tsx)
total_score: 30
p0_count: 1
p1_count: 3
timestamp: 2026-07-09T05-00-35Z
slug: src-pages-landing-tsx
---
# FieldTek Landing Critique (dual-agent, 2026-07-08)

Method: dual-agent (A: design review, B: deterministic detector + technical audit). Browser overlay skipped (no browser session; source-level + detector evidence).

## Design Health Score: Nielsen 30/40 (Good band) · Technical audit 14/20

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | carousel dots display-only |
| 2 | Match System / Real World | 3 | "RAG Pipeline", "Context Fusion", "Ranked Hypotheses" engineer-speak |
| 3 | User Control and Freedom | 3 | solid modals, anchor nav |
| 4 | Consistency and Standards | 3 | 3 CTA labels for one modal |
| 5 | Error Prevention | 4 | zod, duplicate-email handled |
| 6 | Recognition Rather Than Recall | 3 | 3 abstract diagrams force recall |
| 7 | Flexibility and Efficiency | 3 | fine for landing |
| 8 | Aesthetic and Minimalist Design | 2 | 13 sections, Sentinel explained 4x |
| 9 | Error Recovery | 3 | adequate |
| 10 | Help and Documentation | 3 | FAQ + contact |
| **Total** | | **30/40** | Good |

## Anti-Patterns Verdict

Not slop; competent Linear-clone template (own CSS comments say "Linear-style", index.css:296,590,1147). Deterministic detector on LIVE files: 0 findings (1 hit = dead-file PricingSection false positive, bg-orange-500/5 alpha ignored by rule). Structural tells: 12-13 AnimatedEyebrow kickers (every section), two numbering systems (01-04 + FIG 1/2/3), side-stripe borders x3 (ProblemSection:70, HowItWorksSection:72, SocialProofSection:101), five identical icon-card grids, Inter + Plus Jakarta Sans (reflex fonts), zero type voice. Positives: NO gradient text, ONE backdrop-blur (navbar), committed orange-on-black.

## Priority Issues

- **[P0] Zero social proof at conversion.** SocialProofSection contains no proof (no testimonials/logos/counts/credential). Fix: honest design-partner framing + surface modal promises (50% founding, 48h response) on page; rename section Early Access.
- **[P1] Sentinel explained 4x; sections 5-7 = three abstract SVG diagrams back-to-back.** Fatigue valley; 7-node pipeline exceeds working memory. Fix: merge into one section led by SentinelCommandPanel demo; <=4 plain steps.
- **[P1] Page never shows real product** (all div-art). Founder decision: keep stylized mockups for now; real screenshots after app UI pass.
- **[P1] Reduced-motion gap**: AnimatedSection.tsx, ScrollReveal.tsx, AnimatedCounter.tsx use framer inline transforms; CSS kill-switch (index.css:2068) does not catch them. Fix: MotionConfig reducedMotion="user" + counter gate.
- **[P2] Template grammar**: eyebrows, numbered scaffolding, side-stripes, reflex fonts.
- **[P2] CTA label chaos**: Get Early Access / Apply for Beta Access / Apply for Early Access, same modal.
- **[P2] 60+ hardcoded hexes** (IntelligenceLoop 21, SentinelReasoning 21, Hero 16) bypass tokens.

## Persona Red Flags

- Jordan (HVAC owner): hero passes 5s test; bounces at RAG Pipeline (DisplayCards:61) + Diagnostic Graph/Context Fusion/Ranked Hypotheses + diagram valley; footer "AI-native operating system" buzzword.
- Casey (mobile): SentinelReasoningSection:103 + IntelligenceLoop diagram hidden md:block = mobile tells different story; 13-section scroll; fake-tappable dots (IsometricFeatures:269).
- Riley: HeroProductShot:88 "View All" cursor-pointer does nothing; theme toggle expectation dead (force-dark by design); /admin/login in footer.

## Minor Observations

50%/48h promises hidden inside modal only; eyebrow color inconsistent (zinc vs orange); emerald/blue/amber dilute mono+orange; orphan dead code (FloatingOrbs, GlowDivider, HeroBeamLines, ROICalculator, ComparisonSection, ThemeToggle, demo widgets); spring bounce 0.3 in hero; FloatingOrbs infinite blur never pauses offscreen (orphan, moot unless mounted).

## Strengths

Honest-claims discipline (rare, keep verbatim); trade-domain fluency; SentinelCommandPanel demo = best asset (buried section 8); restraint (no gradient text, minimal glass, lazy-load strategy correct, fonts async).

## Questions

1. Best asset = live 92%-confidence diagnosis; why not the hero moment?
2. Delete every eyebrow/glow/2 diagrams: does page say less, or just look less dark-SaaS?
3. "Social Proof" with no proof: copy problem or GTM reality?

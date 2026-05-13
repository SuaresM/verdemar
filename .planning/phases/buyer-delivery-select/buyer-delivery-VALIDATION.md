---
phase: buyer-delivery-select
slug: buyer-delivery-select
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-12
---

# buyer-delivery-select — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed in this project |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

**Note:** This is a frontend-only PWA with no automated test suite. Validation relies on TypeScript compilation (`tsc --noEmit`) and grep-based acceptance criteria per plan task. Manual browser testing covers behavior.

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit` + manual browser spot-check
- **Before `/gsd-verify-work`:** TypeScript must compile clean; all grep acceptance criteria must pass

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Feature | Automated Command | Status |
|---------|------|------|---------|-------------------|--------|
| 01-T1 | 01 | 1 | CityCombobox strict mode | `npx tsc --noEmit` + grep checks | ⬜ pending |
| 02-T1 | 02 | 2 | Register strict prop | `npx tsc --noEmit` + grep checks | ⬜ pending |
| 02-T2 | 02 | 2 | Profile CityCombobox + readOnly state | `npx tsc --noEmit` + grep checks | ⬜ pending |
| 03-T1 | 03 | 1 | Cart constants + state | `npx tsc --noEmit` + grep checks | ⬜ pending |
| 03-T2 | 03 | 1 | Cart 2-step zone+day selector | `npx tsc --noEmit` + grep checks | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No framework install needed — TypeScript is already configured in this project.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| CityCombobox blur resets invalid input | DOM interaction | Type partial city, blur without selecting → query resets to last valid value and error shows |
| CityCombobox accepts valid selection | DOM interaction | Type "Gama", select from dropdown → query stays, state auto-fills "DF" |
| 2-step selector Step 1 → Step 2 cascade | DOM interaction | Select zone → Step 2 appears with correct day options |
| Day selection stores correct string | State inspection | Select day → "Selecionado: Quarta — 07:00 às 09:00" appears below selector |
| No-zones error disables checkout | DOM interaction | Supplier with no zones → error shown, "Finalizar" button disabled |
| Checkout blocked until both steps chosen | DOM interaction | Only zone selected, no day → button disabled; both selected → enabled |

---

## Validation Sign-Off

- [x] All tasks have grep-verifiable `<acceptance_criteria>` in plans
- [x] TypeScript compilation is the automated gate per task
- [x] Wave 0 not needed (no framework install required)
- [x] No watch-mode flags
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

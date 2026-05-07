---
phase: user-settings-update
plan: "01"
subsystem: auth-ui
tags: [password-change, bottom-sheet, supabase-auth, supplier, buyer]
dependency_graph:
  requires: []
  provides: [password-change-supplier, password-change-buyer]
  affects: [src/pages/supplier/StoreSettings.tsx, src/pages/buyer/Profile.tsx]
tech_stack:
  added: []
  patterns: [bottom-sheet-modal, supabase-auth-updateUser, controlled-form-state]
key_files:
  created: []
  modified:
    - src/pages/supplier/StoreSettings.tsx
    - src/pages/buyer/Profile.tsx
decisions:
  - "No current-password field required (D-02): Supabase session JWT is the auth factor"
  - "Client-side validation only: min 8 chars + must match, checked before API call"
  - "pwForm state resets on successful save to prevent accidental re-submission"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-07T14:22:02Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase user-settings-update Plan 01: Password Change Modals Summary

Bottom-sheet password-change modals added to StoreSettings (supplier) and Profile (buyer), calling supabase.auth.updateUser with client-side min-8-char and match validation.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Password modal in StoreSettings (supplier) | 8dd69bb | src/pages/supplier/StoreSettings.tsx |
| 2 | Password modal in Profile (buyer) | c256285 | src/pages/buyer/Profile.tsx |

## What Was Built

### StoreSettings.tsx (supplier)
- Added `Lock` to lucide-react imports
- Added `supabase` client import from `../../lib/supabaseClient`
- Added 3 state variables: `showPwModal`, `pwForm` (`{ password, confirm }`), `pwSaving`
- Added `handleSavePassword` async function with:
  - Min-8-char validation → `toast.error`
  - Must-match validation → `toast.error`
  - `supabase.auth.updateUser({ password })` call
  - `toast.success` on success, closes modal, resets form
  - `toast.error` on API error
- Added "Segurança" card section (between Delivery Zones card and submit button) with "Alterar senha" trigger button
- Added bottom-sheet password modal with `type="password"` inputs (T-pw-03 mitigation applied)

### Profile.tsx (buyer)
- Added `Lock` to lucide-react imports
- Added `supabase` client import from `../../lib/supabaseClient`
- Added 3 state variables: `showPwModal`, `pwForm`, `pwSaving`
- Added `handleSavePassword` with identical validation and API logic
- Added "Alterar senha" button BEFORE "Sair da conta" in the Actions section (blue icon)
- Added bottom-sheet password modal at root level (outside `px-4 py-4` container)

## Verification

- TypeScript compilation: PASSED (tsc --noEmit, zero errors)
- StoreSettings: "Segurança" card present, `showPwModal` state wired, `supabase.auth.updateUser` called once
- Profile: "Alterar senha" at line 211, "Sair da conta" at line 221 (correct order), `supabase.auth.updateUser` called once
- Both modals: `fixed inset-0 z-50 flex flex-col justify-end bg-black/40` pattern, backdrop click closes modal

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| (none) | — | No new network endpoints or trust boundaries introduced beyond what the plan's threat model already covers |

The plan's T-pw-03 mitigation (`type="password"` on both inputs) was applied to both files as required.

## Known Stubs

None — both modals are fully wired to `supabase.auth.updateUser`.

## Self-Check: PASSED

- [x] src/pages/supplier/StoreSettings.tsx — file exists and modified
- [x] src/pages/buyer/Profile.tsx — file exists and modified
- [x] Commit 8dd69bb — exists (Task 1)
- [x] Commit c256285 — exists (Task 2)
- [x] TypeScript: no errors
- [x] showPwModal present in both files
- [x] handleSavePassword defined and wired in both files
- [x] supabase.auth.updateUser called once in each file

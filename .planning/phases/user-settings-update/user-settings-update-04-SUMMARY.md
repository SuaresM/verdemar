---
phase: user-settings-update
plan: 04
subsystem: api, ui
tags: [hono, supabase-auth, admin, react, password-reset]

# Dependency graph
requires:
  - phase: user-settings-update
    provides: requireAuth, requireAdmin middleware and adminSupabase client in api/[...route].ts
provides:
  - POST /api/admin/reset-password Hono route (admin-only, sends Supabase recovery email)
  - "Resetar senha" button per user card in admin Team page with per-user in-flight state
affects: [user-settings-update, admin-team]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Admin action pattern: per-user loading state with string | null (resetting)"
    - "Server-side email retrieval via service_role — email never exposed to client"

key-files:
  created: []
  modified:
    - api/[...route].ts
    - src/pages/admin/Team.tsx

key-decisions:
  - "Email retrieved server-side via adminSupabase.auth.admin.getUserById — never returned to browser (T-ar-03 mitigation)"
  - "generateLink type 'recovery' used so Supabase sends the email automatically without extra orchestration"
  - "Per-user resetting state (string | null) mirrors existing updating pattern for consistent UX"

patterns-established:
  - "Per-user async button state: useState<string | null>(null) keyed by userId"

requirements-completed: [admin-password-reset]

# Metrics
duration: 1min
completed: 2026-05-07
---

# Phase user-settings-update Plan 04: Admin Password Reset Summary

**Admin-only Hono route POST /api/admin/reset-password with service_role email lookup and Supabase recovery link generation, wired to a per-user "Resetar senha" button in Team.tsx**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-07T14:28:03Z
- **Completed:** 2026-05-07T14:29:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- New Hono route `POST /api/admin/reset-password` protected by `requireAuth` + `requireAdmin` — email fetched via `adminSupabase.auth.admin.getUserById` and never returned to client
- Recovery email triggered via `adminSupabase.auth.admin.generateLink({ type: 'recovery', email })` — Supabase delivers it automatically
- "Resetar senha" button added per user card in `src/pages/admin/Team.tsx` with per-user in-flight tracking (resetting state), loading label "Enviando...", and appropriate toast feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add POST /api/admin/reset-password to Hono API** - `07c556f` (feat)
2. **Task 2: Add Resetar senha button to Team.tsx** - `f4dea6a` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `api/[...route].ts` - Added POST /admin/reset-password route after the PATCH /admin/users/:id/role route
- `src/pages/admin/Team.tsx` - Added apiClient import, resetting state, handleResetPassword handler, and "Resetar senha" button in each user card

## Decisions Made
- Email is retrieved server-side only via service_role — the API returns `{ ok: true }` on success without echoing the email address (satisfies T-ar-03 information disclosure mitigation)
- `generateLink` with `type: 'recovery'` was chosen because Supabase handles email delivery automatically — no SMTP configuration needed in the Hono layer
- Per-user `resetting` state mirrors the existing `updating` pattern so role buttons and reset button can be independently disabled

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin password reset is fully wired end-to-end
- Manual verification needed: confirm a Supabase recovery email is received when "Resetar senha" is clicked in the admin Team page (requires live Supabase project with email delivery configured)
- Route is guarded: unauthenticated or non-admin requests will receive 401/403

---
*Phase: user-settings-update*
*Completed: 2026-05-07*

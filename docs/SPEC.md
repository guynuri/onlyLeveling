# SPEC: onlyLeveling

Status: **draft v1**, from the grill-me interview of 2026-11-05. Decisions marked *(setting)* are
in-app settings the user can change later, not repo data. Open items are at the end.

## 1. Goals and non-goals

**Goals**
- A home dumbbell coach that plans, logs and progresses training, with deterministic numbers and
  AI-written text.
- **Primary goal: build muscle. Secondary: get stronger.** The goal is a setting *(setting)* and can
  change at any time without a data migration.
- Multi-user from day one (private data per account), invite-only sign-up.
- Installable iPhone PWA, offline first, synced to Cloudflare D1.

**Non-goals (v1)**
- Nutrition tracking (later phase, see §9).
- Weekly AI review (later phase).
- Barbell, machines, cables, bench. Training equipment is dumbbells only.
- Native apps, App Store, Android.
- Hebrew/RTL UI. English only.
- Medical advice. Suggestions are training guidance only.

## 2. Settings and onboarding

First sign-up runs a short **onboarding interview**. Answers are stored as settings *(setting)*.

| Setting | Default / value | Notes |
|---|---|---|
| Goal | Build muscle (secondary: strength) | Changeable any time. Feeds rep ranges and plan proposals. |
| Days per week | 3 | Plan builder respects it. Changeable any time. |
| Session length | ~45 min | Limits exercises per session. |
| Dumbbells owned | Uneven adjustable set, stored as an exact list | Owned weights in kg, per unit. Editable any time. See §3.4. |
| Load meaning | `as entered` per exercise | `as entered` / `each bell` / `total`, per `REFERENCE_NOTES.md` §8. |
| Bench / barbell | None | Dumbbells only, so exercises must work standing or on the floor. |
| Experience | Returning after a break | Drives the starting load and progression pace. Editable. |
| Injuries / avoid list | None | Editable. Excluded exercises never appear in plans or swaps. |
| Theme | Follow phone | Light and dark. |
| Units | kg | |
| Rest between sets | 90 s (`restSec`) | Ported default, `REFERENCE_NOTES.md` §5. 0 = off. |
| Warm-up pause (rest-pause) | 15 s | |
| Push notifications | Rest-timer end, workout reminder | §8.4. |

Settings live in one config module with thresholds (§4.5). No thresholds are scattered through the code.

## 3. Training module

### 3.1 Plans
- **First plan**: the AI proposes a plan from the onboarding answers. Rules **validate and decide**:
  equipment (dumbbells only), days per week, session length, exclusions, and volume. The engine sets
  every weight, rep and set number (§5 contract). If the AI fails, see §6.3.
- **Plan rotation (MVP)**: exercises stay until a coach card says stall, too easy or stale (§4).
  Weekly review (which would also propose rotations) is later. Until then, rotation is card-driven.
- **Rotation intent recorded by the user**: "Weekly review decides", so in v1 the coach card *is* the
  accept/reject point for each swap, and the weekly review will reuse the same accept flow later.
- **Rep ranges per exercise (proposal)**. Compound lifts 6–10 reps; isolation and accessory lifts 10–15;
  calves and core 10–20. Stated as a default table in config, editable per exercise. Hypertrophy
  research (Schoenfeld and colleagues) shows similar growth across a wide rep range when sets are near
  failure, so the range is about fit and fatigue, not a fixed rule. I did not find a source that settles
  the compound-versus-isolation split. This table is a judgment call, flagged in §11.

### 3.2 Logging
- Log sets: weight (from the owned list), reps, done. Optional RIR per set.
- **In-workout screen**: big buttons, one-handed, thumb reach. Target weight and reps pre-filled from
  the plan. One tap confirms a set; edit only if different. Rest timer front and centre. Starting a rest
  abandons any running hold.
- Rest timer uses wall-clock `endsAt`, so a backgrounded page catches up (`REFERENCE_NOTES.md` §5).
- Finished session saves locally first, then pushes to D1.

### 3.3 Progression (double progression, per exercise)
- Default: double progression over the exercise's rep range (§3.1). All sets at top of range → next
  owned weight, reset to bottom of range.
- Weights snap to the owned list. With no owned list, fall back to the increment grid.
- Progression is **derived, not stored**: `nextPrescription(history, config, routine)` recomputes each
  time (`REFERENCE_NOTES.md` §2). Editing a mistyped set changes the next target with no drift.
- A set counts as a hit only if done with at least the target reps. Only the first N planned sets decide
  the outcome; extra sets never move the weight.
- Dumbbell load meaning (`as entered`, `each`, `total`) is stamped per session. Old sets are never
  reinterpreted (`REFERENCE_NOTES.md` §8).

### 3.4 Dumbbells
- Owned weights stored as an exact list per unit (kg). Uneven steps are fine.
- Movement functions: next/previous owned bell, double jump = two bells up, one-arm = 1 bell,
  otherwise 2 bells (`REFERENCE_NOTES.md` §8). Ported, with a unit test.

### 3.5 e1RM and PRs
- e1RM by Epley **only** from sets of 12 reps or fewer. Returns null above 12. Uses `w` and `r`, never
  `topW`.
- Weight PR and e1RM record are computed in a pure module against history *excluding* the current session.
- Results write to `workout.prs` at finish.

## 4. Coach module (rules, no AI)

Suggestions appear as **cards on the Home screen**. Each card shows the reason with the numbers. Buttons:
**Accept**, **Not now**, **Never for this exercise**.

| Rule | Trigger (defaults, in config) | Suggestion |
|---|---|---|
| Too easy | Logged RIR ≥ 3 at top of range for **2 consecutive sessions** | Bigger jump (next-but-one owned weight) or one extra set |
| Stalled | **No e1RM gain over 2 weeks** of sessions (changed from 3 weeks) | Deload (factor 0.9, §4.1) or swap |
| Stale | Same exercise **8+ weeks** | Variation (swap with same pattern, muscle and equipment) |

Stall is measured as: a session is a stall step if its best e1RM at that weight does not beat the best
e1RM from before the current 14-day window. Stall fires when no session in the last 14 days beat the
best e1RM from before that window. Ported mechanism, changed trigger (`REFERENCE_NOTES.md` §2).

**Swaps**: same movement pattern, same target muscle, owned equipment, preferring exercises not used
recently. Movement pattern needs a labelling pass (`DATA_SOURCES.md` §7 item 3).

### 4.1 Deload
- Factor 0.9 (allowed 0.5–0.95, per config). Candidate chosen by `selectDeloadCandidate`: closest
  estimated 1RM, then fewer rep changes, then heavier load (`REFERENCE_NOTES.md` §2).

### 4.2 Accept / reject flow
- Accept → the plan changes and history is kept. A plan change stamps `planned` so it isn't mistaken
  for progression.
- Not now → the card returns after 7 days (config).
- Never → the exercise is excluded from suggestions for that user.
- Every suggestion stores its reason and the user's choice, for later review.

Wording: "suggestion", "based on your last N sessions". Never "prescription" or "medical". A footer line
says: *Training guidance, not medical advice.*

## 5. AI coach (MVP scope: plan proposal only)

**Rule: the AI suggests, the rules decide.** The AI writes text and proposes structure. The engine
computes every number.

### 5.1 MVP AI use
- **First plan proposal** only. Weekly review and meal ideas are later (§9).
- Feature text, such as the exercise explanation on a card, may be AI-written later. Not MVP.

### 5.2 Providers
- One OpenAI-compatible client, configurable base URL and model. Fallback chain (CLAUDE.md):
  Workers AI → Groq → Gemini → OpenRouter. No code outside the client knows a provider name.
- Called only through the Worker. Keys are Worker secrets.

### 5.3 What leaves the device
- **Compact summaries only.** Goal, days per week, session length, owned dumbbell weights, experience,
  avoid list, and per-exercise trend summaries (e.g. best e1RM, last 3 sessions' top set). No dates of
  birth, no free-text notes, no raw logs, no account identity beyond an opaque user id.

### 5.4 Output schema (JSON, validated)

```json
{
  "plan": {
    "name": "string, max 60 chars",
    "days": [
      {
        "label": "string, e.g. 'Day A'",
        "exercises": [
          { "exerciseId": "string, must exist in the library", "reason": "string, max 200 chars" }
        ]
      }
    ]
  },
  "note": "string, max 400 chars, training guidance wording"
}
```

The AI never returns weights, reps, sets or rest. The engine adds those from config and history.

### 5.5 Validation (every response)
1. Parse as JSON. Reject non-JSON.
2. Schema check (types, required keys, lengths).
3. Every `exerciseId` exists in the library and is dumbbell-compatible.
4. No excluded exercise (avoid list).
5. Day count equals the setting (days per week). Exercise count per day fits session length.
6. Repeat or fail on any violation.

### 5.6 Failure behaviour
- **Retry once**, with the next provider in the chain.
- If still invalid or unreachable, **fall back to the rules-based plan** (template fills from the library
  to the same validators), and say so on screen: "Built by rules; AI unavailable."
- Copy-paste fallback (CLAUDE.md golden rule): kept as a manual option in settings for when the Worker is
  unreachable. Not automatic. See §11.
- The AI is never trusted for numbers. A wrong AI plan is caught by validation, not by the user.

### 5.7 Cost and abuse
- Per-user AI call cap per day (config). Invite-only sign-up limits cost further.
- Weekly review cache applies when it returns (later).

## 6. Platform and data

### 6.1 Auth and accounts
- **Passkeys (WebAuthn)** for sign-in. No passwords.
- **Sign-up requires an invite code.** Existing users issue codes from settings. Codes are single-use
  (proposal, §11).
- Multi-user: every record has `userId`. Every query is scoped to the authenticated user.

### 6.2 Sync and conflicts
- Cloudflare D1 is the source of truth. IndexedDB is the local cache and write outbox (CLAUDE.md).
- Every change saved locally first, pushed when online, pulled on open.
- **Conflicts: last write wins per record.** Unit of record = one session, one entry, or one set row.
- Show a **"last synced"** indicator. Failed pushes retry with backoff and show a visible error. Sync never
  fails silently.

### 6.3 Backups and export
- D1 is the backup. A **full JSON export** from settings, for the whole account.
- Import from JSON is not in v1 (see §9).

### 6.4 Push notifications (iOS PWA)
- Requires the app installed to the Home Screen. The app says so in settings and does not fail silently.
- **Rest timer end** and **workout reminder** (on training days, time set in settings).
- Fallback when push is not allowed: an on-screen alert while the app is open.

### 6.5 iOS PWA limitations (known constraints)
- Deleting the PWA deletes local data. D1 sync is the backup, so data must be synced before users rely on
  it.
- Test on a real iPhone in standalone mode.
- Background timers are wall-clock based (§3.2).

## 7. Data model (summary)

```
User       { id, passkeyCredentials[], inviteCodeUsed, createdAt }
Settings   { userId, goal, daysPerWeek, sessionMinutes, owned: {unit: weights[]},
             experience, avoid: exerciseId[], theme, restSec, reminderTime, ... }
Exercise   { id, name, aliases[], equipment, force, mechanic, level, category,
             primaryMuscles[], secondaryMuscles[], movementPattern, instructions[],
             images[], source, textSource, license, author, sourceUrl }   // from DATA_SOURCES.md §6
Plan       { id, userId, name, days[], createdAt, source: 'ai'|'rules'|'manual' }
Routine    { id, planId, exercises: [{ exerciseId, sets, repsMin, repsMax, weight?, dbLoad, rest }] }
Workout    { id, userId, routineIds[], start, end, entries[], prs[], excludeFromProgression? }
Entry      { id (exerciseId), sets[], planned, note? }
SetRow     { w, r, done, rir?, phase, at }
Suggestion { id, userId, rule, exerciseId, reason, createdAt, status: pending|accepted|rejected|snoozed|never }
```

Live-only bookkeeping (own rest, planned seconds) is stripped at finish (`REFERENCE_NOTES.md` §1).
Config thresholds are not in the data model.

## 8. UI and UX

### 8.1 Look and feel
- Dark and light, following the phone. Calm, dense, functional. One accent colour.
- English only. Every screen works at phone width with a 16 px gutter.

### 8.2 Key screens
1. **Onboarding interview** (first sign-up only).
2. **Home**: today's session, coach cards (§4), last synced indicator.
3. **Plan**: days, exercises, rep ranges. Propose a new plan, accept or reject.
4. **In-workout**: one-handed logging (§3.2). Rest timer.
5. **History**: sessions, PRs, per-exercise trend.
6. **Exercise**: details, text from `DATA_SOURCES.md`, images with credit.
7. **Settings**: all §2 settings, export, invite codes, passkey, Credits screen (`docs/CREDITS.md`).

### 8.3 Credits
Credits screen lists text licence per exercise, each image's author and licence, and Everkinetic credit.

## 9. MVP vs later

**MVP (v1), the smallest version I'd use next week**
- Accounts: passkey sign-in, invite-code sign-up, multi-user data.
- Onboarding interview, settings (§2).
- AI first-plan proposal, validated by rules, with rules-based fallback.
- Logging with the one-handed in-workout screen, rest timer, double progression, owned-weight snapping.
- Coach cards: stall (2 weeks), too easy, stale (8 weeks), with accept / not now / never.
- Swaps via cards.
- D1 sync, outbox, last-synced indicator, JSON export.
- Push: rest timer end and workout reminder.

**Later phases**
- Phase 2: XP, streaks, badges (derived from sessions and progression, §10).
- Phase 2: Weekly AI review (cached), proposing swaps and rotations through the same accept flow.
- Phase 3: Nutrition: calorie and protein log, starter USDA list, recents and favourites, custom foods,
  quick-add kcal, targets via Mifflin-St Jeor × activity, goal-adjusted, protein 1.6–2.2 g/kg, weekly
  calorie adjustment from the 7-day body-weight trend (CLAUDE.md). Meal ideas (AI) with it.
- Phase 3: Open Food Facts and barcode scanning (ODbL attribution).
- Later: Hebrew/RTL, native apps, bench and barbell support when equipment changes.

## 10. Acceptance criteria

**Accounts**
- A new user cannot register without a valid, unused invite code.
- A user cannot read another user's workouts or settings (test with two accounts).
- Passkey sign-in works on iPhone Safari (standalone mode).

**Onboarding and settings**
- Onboarding completes in under 2 minutes and saves every answer.
- Every §2 setting can be edited later and takes effect on the next plan or session.

**Plans**
- AI-proposed plan passes all §5.5 checks, or the rules-based fallback is shown with the "Built by rules"
  label.
- No plan contains an excluded exercise or non-dumbbell equipment.
- Plan day count equals days-per-week setting.

**Logging and progression**
- A set logs in three taps or fewer (confirm with pre-filled values).
- Progression with owned weights picks the next owned bell, never an off-list weight.
- Changing a logged set changes the next target with no drift (derived, §3.3).
- Extra sets beyond the plan never move the weight.
- e1RM is null above 12 reps; present for 12 and below.

**Coach**
- Each suggestion card shows the numbers behind it.
- Stall fires at 2 weeks with no e1RM gain; not before.
- Too easy fires only after 2 consecutive sessions with RIR ≥ 3 at top of range.
- Stale fires at 8 weeks on the same exercise.
- Accept applies the change; never-exercises do not reappear.

**Sync and data**
- Offline logging works; the record appears in D1 after reconnect.
- A failed push shows an error and retries; it never disappears silently.
- Last-synced time updates after each successful sync.
- JSON export contains all user data and re-imports with no loss (manual check in v1).

**Push**
- Rest-timer alert fires when the app is installed and backgrounded.
- Workout reminder fires at the chosen time on training days.
- Denied permission shows the on-screen fallback.

**Guidance wording**
- Every suggestion screen shows the non-medical footer.

## 11. Open questions

1. **Rep-range table**: is the proposed default (compound 6–10, isolation 10–15, calves/core 10–20)
   right? The research I found does not settle compound versus isolation. Confirm or edit.
2. **Stale window**: stays at 8 weeks. Confirm.
3. **Deload after N missed sessions** (openGym does this; `REFERENCE_NOTES.md` §12, CLAUDE.md open
   question): recommend **no**, stall rule only. Confirm.
4. **Copy-paste fallback**: keep as a manual option (proposed), or drop it?
5. **Invite codes**: single-use or multi-use? Who issues them (only you, or every user)?
6. **AI plan on day one**: the "rules-based fallback" uses the same validators. Is that enough, or do you
   want the rules-based template to be a separate, always-available starting point?
7. **Movement pattern labels**: who tags them (`DATA_SOURCES.md` §7 item 3)? Proposed: one labelling
   pass by you with review.
8. **Provider chain**: CLAUDE.md order (Workers AI → Groq → Gemini → OpenRouter). Confirm, or pick a
   different first provider.
9. **Settings that were deferred** to "input later": goal, days per week, owned weights, experience. The
   onboarding interview covers them; confirm onboarding is the only place they are asked.
10. **Weekly review timing and content** when it returns in phase 2.

## 12. Glossary

- **RIR**: reps in reserve (how many more reps you could have done).
- **e1RM**: estimated one-rep max, Epley from sets of 12 reps or fewer.
- **Double progression**: add reps to the top of the range, then increase weight and reset to the bottom.
- **Owned weights**: the exact list of dumbbell weights you have.

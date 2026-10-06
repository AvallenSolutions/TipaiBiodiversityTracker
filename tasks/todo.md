# AI species identifier v2

Branch: `claude/ai-identifier-v2` (from `origin/main`, 2026-10-06)

## What the data says today (live DB, 2026-10-06)

- 831 species in the library. 879 field-guide plates bundled in `public/species-images`.
- 139 sightings. 123 used the AI. 118 kept the AI's top guess.
- 117 of 123 top guesses claim 80%+ confidence. The 5 misses were also 65 to 95%. Confidence is not honest.
- One miss was dangerous: a Common Krait (deadly) was called an Indian Rat Snake at 85%.
- Only 4 of 139 sightings are linked to a library species. 47 names do not match any library name ("White browed Fantail", "Lotus").
- The Gemini API key ships to the browser (`VITE_GEMINI_API_KEY`). Anyone can copy it.
- Full-size phone photos go to Gemini as base64. No resize. No retry. Model is the `gemini-flash-latest` alias.
- `thinkingBudget: 0` turns off the model's reasoning.
- The prompt has no location, date, habitat or species list.

## Phase 1: Reliability (fixes the 503 and "Load failed" errors)

- [x] Move the Gemini call into a Supabase Edge Function `identify-species`. Key lives in Supabase secrets only.
- [x] Retry 429 / 5xx / network errors with backoff (3 tries). Then fall back to a second pinned model.
- [x] Pin model names (no `-latest` alias). Check current model list before choosing.
- [x] Shrink photos in the browser before sending (long edge 1600 px, JPEG ~0.85). Stored photo stays full size.
- [x] Friendly error text plus a "Try again" button (new sighting, pending, bulk upload).

## Phase 2: Accuracy

- [x] Send context: GPS or park, month (season), category, time of day. (Habitat left out: it is only a default value at identify time.)
- [x] Ground to the library: send the species list for the category; model returns `species_id`. Auto-link and use library spelling. Allow "not in library" answers, flagged.
- [x] Two-pass check: pass 1 gives top 5. Pass 2 sends the photo plus field-guide plates and confirmed Tipai photos of those 5, and asks the model to pick and name the field marks it used.
- [x] Turn reasoning on for pass 2.
- [x] Honest confidence: model must list visible field marks; cap confidence when key marks are hidden.
- [x] Danger flag: always warn when a candidate has a venomous or dangerous look-alike (krait / rat snake, Russell's viper / rock python, etc.).
- [x] Use every photo in the sighting, not only the last one.

## Phase 3: Self-learning ("memory", not retraining)

- [x] No separate feedback table needed: `sightings.ai_suggestions` already stores what the AI said, and the record stores the final answer. `ai_accuracy_stats()` compares them. New suggestions carry `engine: 'v2'` so old and new AI are scored apart.
- [x] Teach on: new sighting saved, bulk upload saved, verify (detail + list), edit, promote to library. Offline-synced records are caught by the admin "Teach AI from confirmed records" button.
- [x] Only naturalist and admin confirmations teach the AI. Guest picks do not.
- [x] Photo memory: embed each confirmed photo with `gemini-embedding-2` into pgvector. At ID time, fetch the 5 most similar confirmed Tipai photos and show them to Gemini as examples.
- [x] Look-alike tips: when a naturalist corrects X to Y, they can add a one-line tip. Stored and fed to the prompt when X or Y is a candidate.
- [x] New species: naturalist adds it to the library from the sighting. The photo becomes its first reference image.
- [x] Admin "AI accuracy" panel: top-1 and top-3 hit rate over time, most confused pairs.

## Verification

- [ ] Replay test on live data: admin panel "Test the AI on 20 records" (needs GEMINI_API_KEY secret + deployed function). Old AI baseline from stored data: top-1 118/123, top-3 119/123 (biased upwards: users mostly accepted the AI's pick).
- [x] Mock harness (real handler, all outbound calls stubbed): normal, primary busy -> fallback, both busy -> 503 'busy', pass 2 fails -> pass 1 result, unusable answer -> Unidentified, learn ok / rejected (removes) / staff (403), no auth (401).
- [x] Migration dry run on prod inside a transaction that aborts itself: all statements ran, stats function returned the expected v1 numbers, nothing persisted.
- [x] Plate matching parity: old vs shared module, 915 names, 0 differences.
- [ ] Phone check of the new UI (needs a signed-in user).
- [x] `npm run build` passes.

## Review

Built all three phases in one branch.

- Root cause of the reported errors: no retry on Gemini 503s, the moving `gemini-flash-latest` alias, and 5 to 8 MB photos sent as base64 straight from the phone ("Load failed" on weak signal).
- Library naming matters: the library says "Indian Krait", users typed "Common Krait". Grounding to the library fixes spelling drift and links `species_id` (only 4 of 139 records were linked).
- Not done on purpose: Gemini fine-tuning. The photo memory + tips approach needs no retraining and works from the first confirmed photo.

Done 2026-10-06: migration applied (+ search_path fix on ai_norm / ai_same_species), GEMINI_API_KEY and SITE_URL secrets set, identify-species deployed and smoke-tested (401 without sign-in, CORS ok). Plates are read from the caller's own site when it is tipaitracker.netlify.app or one of its deploy previews.

Deploy order: migration -> secrets (GEMINI_API_KEY, SITE_URL) -> deploy function -> merge PR -> admin "Teach" -> admin "Test" -> remove VITE_GEMINI_API_KEY from Netlify -> delete the old (exposed) Gemini key.

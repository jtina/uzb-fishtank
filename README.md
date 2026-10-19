# Class Fish Tank (Sinfimiz akvariumi)

A classroom aquarium for 2nd graders. Every student has a fish. The teacher feeds a fish as a reward,
and it grows with every feed: each feed adds 1/max-size of its starting size, so at the max size it is twice as big.

- **Feeding:** tap a fish in the tank, press **+1** on a student's row, or press **Feed everyone**.
- **Daily reset:** every day at 23:59 Tashkent time all fish go back to the starting size (with Supabase the database
  does this on the first visit after 23:59; an open screen picks it up within ~20 s). The leaderboard's days end at
  23:59 too. **Reset sizes** in Settings does the same by hand; the leaderboard keeps all feedings either way.
- **Leaderboard tab** (desktop and phone): pick a day on the date bar (drag or use the arrows; it covers the year of
  feedings the database keeps), jump back with **Today**, pick any day from the **calendar**, or see the last 7 days.
  Places 1-3 get gold, silver and bronze crowns (ties share a place). In the tank and the student list, the 3 biggest
  fish right now wear the crowns. Picking a past day or the 7 days shows the fish in the tank at those sizes (view
  only; feeding is off until you go back to today with the label in the tank).
- **Top fish zone (Settings):** switch it on and drag a line on the picture of the tank. Only the top 5 fish (or the
  number you set) swim above it and stay there (their food stops at the line), unless you switch on "top fish can also
  swim below the line"; the rest stay below, and their food drops quickly to the line so they don't wait long. Never more than that number go above the line: a group of tied fish only goes up if the
  whole group fits (15, 13, 10, 6, 2, 2, 2 with 5 allowed puts only the top 4 above).
- **Students:** when you add a student, their fish opens in edit view (name, fish type, color). The list is sorted by feeds.
  Tap the tank to leave edit view.
- **Decorate tab:** add decorations, drag them to move, drag a corner handle to resize, and tap one for
  Front / Back / Flip / Remove (double-click also flips).
- **Settings (⚙, desktop and phone):** for the open aquarium only: the smallest and biggest fish size, how many feeds
  it takes to reach the biggest size, swim speed (with a reset to the defaults), export of the fish list as a CSV file
  for Excel (with or without feeds), import from such a file (only a `name` column is needed, so a class list typed in
  Excel works), **Delete all fish** (this aquarium only, asks first) and **Lock**.
- **Full screen:** the button in the tank's top-right corner shows just the tank (Esc also exits). In full screen,
  double-click a decoration to move, resize, flip, layer or remove it; tap the water when done.
- **Settings:** Uzbek / English (Uzbek by default), Sunny Reef / Night Glow look, names always or on hover. There are no sounds.
- **PIN lock:** the app opens with a teacher PIN screen. It stays unlocked until the browser tab
  is closed or **Lock** is pressed.
- **Shared across devices:** with Supabase set up (below), every device shows the same class. Changes show up on
  other devices within a few seconds (at most 15). When a fish is fed on another device (e.g. a phone), the food drops
  in this tank too and the fish eats it.
- **Phone view:** on a phone the page is a remote control: just the student list with **+1** and **Feed everyone**,
  the look and names buttons (they switch the class screen),
  and **+ Add** opens a popup to pick the new student's fish. The tank and the Decorate tab are left out.

Students, feeds, decorations, the class title, the Settings values and the look and names settings are shared. Language and the
open tab are each device's own choice.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

The build uses relative paths, so `dist/` can be hosted on GitHub Pages or any static host.

## Supabase setup (shared data + PIN)

1. In your Supabase project, open **SQL Editor**, paste all of [`supabase/fishtank.sql`](supabase/fishtank.sql) and run it.
   It only creates `fishtank_*` tables and functions. Run it again after updates (it upgrades in place and keeps data).
2. In the SQL Editor, set the PINs on their own lines, replacing `XXXX` / `YYYY` with 4-digit PINs
   (don't write real PINs into this repo, it is public):
   - `select fishtank_set_pin('XXXX');` for the class aquarium
   - `select fishtank_set_pin('YYYY', 'test');` for a separate **test aquarium** (optional)
3. In Supabase → **Project Settings → API**, copy the **Project URL** and the **anon / publishable** key.
   Never use the `service_role` / secret key here.
4. In GitHub → **Settings → Secrets and variables → Actions**, add the secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`,
   then re-run the "Deploy to GitHub Pages" workflow.

The PIN entered on the lock screen decides which aquarium opens. Each aquarium has its own students, decorations,
title and settings. The one named `test` shows a "Test aquarium" badge, and its Settings have a **Tank background**
section: Classic or Reef pictures, or upload your own, for Sunny Reef and Night Glow, plus a button to use those
backgrounds in every aquarium.

You can make as many aquariums as you like, e.g. one per class: `select fishtank_set_pin('ZZZZ', 'class-2b');`
(names use a–z, 0–9, `-` and `_`; every aquarium needs a different PIN). To delete one and everything in it:
`delete from fishtank_tanks where id = 'class-2b';`

The tables are locked to the public key. The app can only use the `fishtank_*` functions, and each one checks the PIN
on the server, so the PIN is never in the page. After 10 wrong PINs from one address in 10 minutes, that address is
blocked until the 10 minutes are up. To change a PIN, run `fishtank_set_pin` again. Every device then has to enter
the new PIN.

If a change can't be saved (no internet), a warning shows above the tank, and the device goes back to the shared
data once the connection returns. Changes made while offline are not kept.

To remove the app's tables and functions from a Supabase project (e.g. one it was set up in by mistake), run
[`supabase/uninstall.sql`](supabase/uninstall.sql): first its preview query, then the remove block.

## Without Supabase (local-only)

If `SUPABASE_URL` / `SUPABASE_ANON_KEY` are not set, everything is saved only in that browser. The PIN then comes from
the `TEACHER_PIN` environment variable at build time (a repository secret for GitHub Pages), and only its hash is put in
the site. Locally: `TEACHER_PIN=5678 npm run dev`; without it, the local PIN is `0000`.
To run locally against Supabase, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env.local` file.
  Settings on the phone has a **Show the fish tank on this phone** switch (saved on that phone only).

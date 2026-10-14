# Class Fish Tank (Sinfimiz akvariumi)

A classroom aquarium for 2nd graders. Every student has a fish. The teacher feeds a fish as a reward,
and it grows with every feed: each feed adds 1/max-size of its starting size, so at the max size it is twice as big.

- **Feeding:** tap a fish in the tank, press **+1** on a student's row, or press **Feed everyone**.
- **Students:** when you add a student, their fish opens in edit view (name, fish type, color). The list is sorted by feeds.
  Tap the tank to leave edit view.
- **Decorate tab:** add decorations, drag them to move, drag a corner handle to resize, and tap one for
  Front / Back / Flip / Remove (double-click also flips).
- **Max size:** set how many feeds make a fish full size. **Reset sizes** sets every feed count to 0.
- **Full screen:** the button in the tank's top-right corner shows just the tank (Esc also exits).
- **Settings:** Uzbek / English (Uzbek by default), Sunny Reef / Night Glow look, names always or on hover. There are no sounds.
- **PIN lock:** the app opens with a teacher PIN screen. It stays unlocked until the browser tab
  is closed or **Lock** is pressed.
- **Shared across devices:** with Supabase set up (below), every device shows the same class. Changes show up on
  other devices within a few seconds (at most 15). When a fish is fed on another device (e.g. a phone), the food drops
  in this tank too and the fish eats it.
- **Phone view:** on a phone the page is a remote control: just the student list with **+1** and **Feed everyone**,
  and **+ Add** opens a popup to pick the new student's fish. The tank and the Decorate tab are left out.

Students, feeds, decorations, the class title and the max size are shared. Language, look, names and the
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
title and max size. The one named `test` shows a "Test aquarium" badge.

You can make as many aquariums as you like, e.g. one per class: `select fishtank_set_pin('ZZZZ', 'class-2b');`
(names use a–z, 0–9, `-` and `_`; every aquarium needs a different PIN). To delete one and everything in it:
`delete from fishtank_tanks where id = 'class-2b';`

The tables are locked to the public key. The app can only use the `fishtank_*` functions, and each one checks the PIN
on the server, so the PIN is never in the page. After 10 wrong PINs from one address in 10 minutes, that address is
blocked until the 10 minutes are up. To change a PIN, run `fishtank_set_pin` again. Every device then has to enter
the new PIN.

If a change can't be saved (no internet), a warning shows above the tank, and the device goes back to the shared
data once the connection returns. Changes made while offline are not kept.

## Without Supabase (local-only)

If `SUPABASE_URL` / `SUPABASE_ANON_KEY` are not set, everything is saved only in that browser. The PIN then comes from
the `TEACHER_PIN` environment variable at build time (a repository secret for GitHub Pages), and only its hash is put in
the site. Locally: `TEACHER_PIN=5678 npm run dev`; without it, the local PIN is `0000`.
To run locally against Supabase, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env.local` file.

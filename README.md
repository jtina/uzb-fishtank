# Class Fish Tank (Sinfimiz akvariumi)

A classroom aquarium for 2nd graders. Every student has a fish. The teacher feeds a fish as a reward,
and it grows from **Little → Grown → Big**.

- **Feeding:** tap a fish in the tank, press **+1** on a student's row, or press **Feed everyone**.
- **Students:** when you add a student, their fish opens in edit view (name, fish type, color). The list is sorted by feeds.
  Tap the tank to leave edit view.
- **Decorate tab:** add decorations, drag them to move, drag a corner handle to resize, and tap one for
  Front / Back / Flip / Remove (double-click also flips).
- **Max size:** set how many feeds make a fish Big (it is Grown at half). **Reset sizes** sets every feed count to 0.
- **Settings:** Uzbek / English (Uzbek by default), Sunny Reef / Night Glow look, names always or on hover, sound.
- **PIN lock:** the app opens with a teacher PIN screen. It stays unlocked until the browser tab
  is closed or **Lock** is pressed. Only a hash of the PIN is published, but a 4-digit PIN checked in the browser
  can be brute-forced, so this stops students, not a determined adult.

Everything is saved in the browser's `localStorage` on that device.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

The build uses relative paths, so `dist/` can be hosted on GitHub Pages or any static host.

## Teacher PIN

The PIN is never stored in this repo. It is read from the `TEACHER_PIN` environment variable at build time,
and only its hash is put into the site.

- **GitHub Pages:** set a repository secret named `TEACHER_PIN` (4 digits) under
  Settings → Secrets and variables → Actions. The deploy fails if it is missing. To change the PIN, update the
  secret and re-run the "Deploy to GitHub Pages" workflow.
- **Local:** `TEACHER_PIN=1234 npm run dev`. Without it, the local PIN is `0000`.

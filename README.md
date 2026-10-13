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
- **PIN lock:** the app opens with a teacher PIN screen (default `0000`). It stays unlocked until the browser tab
  is closed or **Lock** is pressed. The PIN is in the page source, so it only stops casual access.

Everything is saved in the browser's `localStorage` on that device.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # static build in dist/
```

To use a different PIN, build with `VITE_TEACHER_PIN=1234 npm run build`.
The build uses relative paths, so `dist/` can be hosted on GitHub Pages or any static host.

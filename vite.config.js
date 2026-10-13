import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// With Supabase (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY), the PIN is checked on the server and
// nothing about it goes into the bundle.
// Without Supabase (local-only mode), the PIN comes from the TEACHER_PIN environment variable and only its
// salted SHA-256 hash goes into the bundle.
const PIN_SALT = 'classFishTank:';
const DEV_PIN = '0000';

export default defineConfig(({ command }) => {
  const remote = !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY);
  let hash = null;
  if (!remote) {
    let pin = process.env.TEACHER_PIN;
    if (!pin) {
      if (command === 'build' && process.env.CI) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or TEACHER_PIN) as repository secrets.');
      pin = DEV_PIN;
    }
    if (!/^\d{4}$/.test(pin)) throw new Error('TEACHER_PIN must be exactly 4 digits.');
    hash = createHash('sha256').update(PIN_SALT + pin).digest('hex');
  }

  return {
    // Relative base so the build works from any folder (GitHub Pages, a USB stick, etc.)
    base: './',
    plugins: [react()],
    define: {
      __PIN_HASH__: JSON.stringify(hash),
      __PIN_SALT__: JSON.stringify(PIN_SALT),
    },
  };
});

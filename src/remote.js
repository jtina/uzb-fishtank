import { createClient } from '@supabase/supabase-js';

// Shared class data lives in Supabase when these are set at build time (see README).
// The key is the public anon / publishable key: the tables are locked and every call checks the PIN
// on the server (supabase/fishtank.sql).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const remoteEnabled = !!(url && key);

const sb = remoteEnabled
  ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;

// code: 'wrong_pin' | 'too_many_attempts' | 'pin_not_set' | 'network' | 'needs_update' (a function from a newer
// supabase/fishtank.sql is missing: the script needs re-running)
export class RemoteError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function call(fn, args) {
  let res;
  try { res = await sb.rpc(fn, args); } catch (e) { throw new RemoteError('network'); }
  if (res.error) throw new RemoteError(res.error.code === 'PGRST202' || res.status === 404 ? 'needs_update' : 'network');
  if (res.data && res.data.error) throw new RemoteError(res.data.error);
  return res.data;
}

export const api = {
  load: pin => call('fishtank_load', { p_pin: pin }),
  saveStudent: (pin, s) => call('fishtank_save_student', { p_pin: pin, p_student: { id: s.id, name: s.name, type: s.type, color: s.color } }),
  deleteStudent: (pin, id) => call('fishtank_delete_student', { p_pin: pin, p_id: id }),
  addFood: (pin, id, delta) => call('fishtank_add_food', { p_pin: pin, p_id: id, p_delta: delta }),
  resetFood: pin => call('fishtank_reset_food', { p_pin: pin }),
  deleteAllStudents: pin => call('fishtank_delete_all_students', { p_pin: pin }),
  saveDecor: (pin, d) => call('fishtank_save_decor', { p_pin: pin, p_decor: { id: d.id, kind: d.kind, x: d.x, size: d.size || 1, flip: !!d.flip } }),
  deleteDecor: (pin, id) => call('fishtank_delete_decor', { p_pin: pin, p_id: id }),
  orderDecor: (pin, ids) => call('fishtank_order_decor', { p_pin: pin, p_ids: ids }),
  saveConfig: (pin, title, maxFeed) => call('fishtank_save_config', { p_pin: pin, p_title: title, p_max_feed: maxFeed }),
  saveNames: (pin, names) => call('fishtank_save_names', { p_pin: pin, p_names: names }),
  saveLook: (pin, look) => call('fishtank_save_look', { p_pin: pin, p_look: look }),
  saveFishSettings: (pin, s) => call('fishtank_save_fish_settings', { p_pin: pin, p_min_size: s.minSize, p_max_size: s.maxSize, p_speed: s.speed }),
};

// Devices ping each other over a broadcast channel when they change something; the ping carries no data,
// receivers just reload through the PIN-checked functions.
export function watchChanges(tank, onChange) {
  if (!sb || !tank) return { notify() {}, close() {} };
  const channel = sb.channel('fishtank-changes-' + tank);
  channel.on('broadcast', { event: 'changed' }, () => onChange()).subscribe();
  return {
    notify: () => { channel.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {}); },
    close: () => { sb.removeChannel(channel); },
  };
}

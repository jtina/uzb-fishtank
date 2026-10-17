import { useEffect, useState } from 'react';
import { BACKGROUNDS } from './constants.js';

// The tank picture for the current look: a built-in one, or an uploaded one (fetched once, then cached).
export function useTankBackground(ref, slot, loadImage) {
  const [uploaded, setUploaded] = useState({});
  const id = ref && ref.startsWith('img:') ? ref.slice(4) : null;
  useEffect(() => {
    if (!id || uploaded[id]) return;
    let live = true;
    loadImage(id).then(url => { if (live && url) setUploaded(u => ({ ...u, [id]: url })); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (id) return uploaded[id] || BACKGROUNDS.classic[slot];
  return (BACKGROUNDS[ref] || BACKGROUNDS.classic)[slot];
}

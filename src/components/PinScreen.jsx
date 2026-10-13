import { useEffect, useRef, useState } from 'react';
import LangSwitch from './LangSwitch.jsx';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
const SHAKE = [-12, 12, -9, 9, -5, 5, 0];
const ERRORS = { wrong_pin: 'wrongPin', too_many_attempts: 'tooMany', pin_not_set: 'pinNotSet', network: 'offline' };

// onUnlock checks the PIN (on the server when Supabase is set up) and resolves to 'ok' or an error code.
export default function PinScreen({ L, lang, onLang, onUnlock }) {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');
  const [shakeX, setShakeX] = useState(0);
  const busy = useRef(false);
  const entryRef = useRef('');

  const fail = msg => {
    busy.current = true;
    setEntry(''); entryRef.current = '';
    setError(msg);
    let n = 0;
    const step = () => {
      setShakeX(SHAKE[n]); n++;
      if (n < SHAKE.length) setTimeout(step, 60); else busy.current = false;
    };
    step();
  };

  const press = v => {
    if (busy.current) return;
    let next = entryRef.current;
    if (v === 'del') next = next.slice(0, -1);
    else if (v === 'clear') next = '';
    else if (next.length < 4) next += v;
    else return;
    entryRef.current = next;
    setEntry(next);
    setError('');
    if (next.length < 4) return;
    busy.current = true;
    const check = onUnlock(next).catch(() => 'network');
    setTimeout(async () => {
      const res = await check;
      busy.current = false;
      if (res !== 'ok') fail(ERRORS[res] ? L[ERRORS[res]] : L.wrongPin);
    }, 150);
  };

  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = e => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pressRef.current(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); pressRef.current('del'); }
      else if (e.key === 'Escape' || e.key === 'Delete') { e.preventDefault(); pressRef.current('clear'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="lock">
      <div className="lock-card">
        <div className="lock-title">{L.lockTitle}</div>
        <div className="lock-sub">{L.lockSub}</div>
        <div className="pin-dots" style={{ transform: `translateX(${shakeX}px)` }}>
          {[0, 1, 2, 3].map(i => <div key={i} className={'pin-dot' + (i < entry.length ? ' on' : '')} />)}
        </div>
        <div className="pin-error">{error}</div>
        <div className="pin-keys">
          {KEYS.map(k => (
            <button
              key={k}
              className="pin-key"
              style={{ fontSize: k === 'clear' ? 17 : 28 }}
              aria-label={k === 'del' ? L.del : k === 'clear' ? L.clear : k}
              onClick={() => press(k)}
            >
              {k === 'clear' ? L.clear : k === 'del' ? '⌫' : k}
            </button>
          ))}
        </div>
        <LangSwitch lang={lang} onLang={onLang} />
      </div>
    </div>
  );
}

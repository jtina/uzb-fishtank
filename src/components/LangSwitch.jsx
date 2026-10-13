import { LANGS } from '../i18n.js';

export default function LangSwitch({ lang, onLang }) {
  return (
    <div className="chips">
      {LANGS.map(k => (
        <button key={k} className={'chip' + (k === lang ? ' on' : '')} onClick={() => onLang(k)}>{k.toUpperCase()}</button>
      ))}
    </div>
  );
}

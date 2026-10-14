// A yes / cancel popup for actions that can't be undone.
export default function ConfirmDialog({ L, title, body, confirmLabel, confirmClass = 'btn-danger', onCancel, onConfirm }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{body}</div>
        <div className="dialog-actions">
          <button className="btn-outline" onClick={onCancel}>{L.cancel}</button>
          <button className={confirmClass} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

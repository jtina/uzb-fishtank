export default function ResetDialog({ L, onCancel, onConfirm }) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">{L.resetTitle}</div>
        <div className="dialog-body">{L.resetBody}</div>
        <div className="dialog-actions">
          <button className="btn-outline" onClick={onCancel}>{L.cancel}</button>
          <button className="btn-danger" onClick={onConfirm}>{L.resetConfirm}</button>
        </div>
      </div>
    </div>
  );
}

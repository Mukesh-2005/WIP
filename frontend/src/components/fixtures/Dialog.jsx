import { useEffect, useId } from "react";

// A plain dialog window with a title and a Close button (Esc and a click on the
// dark background close it too). ConfirmModal is for yes/no questions; this is
// for dialogs that contain forms.
export default function Dialog({ title, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h3 id={titleId}>{title}</h3>
          <button className="link-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

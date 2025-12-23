import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

export default function Modal({ open, onClose, children }: Props) {
  return (
    <div
      className="modal"
      style={{ display: open ? '' : 'none' }}
      onClick={onClose}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}


import { ReactNode, useMemo } from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  isOpen: boolean;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

const ConfirmDialog = ({
  title,
  description,
  isOpen,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  confirmDisabled,
  children,
}: ConfirmDialogProps) => {
  const footer = useMemo(
    () => (
      <>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={confirmDisabled}
          onClick={onConfirm}
          className={`rounded px-4 py-2 text-sm font-semibold text-white shadow transition ${
            confirmVariant === 'danger'
              ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
              : 'bg-primary hover:bg-blue-600 disabled:bg-blue-400'
          }`}
        >
          {confirmLabel}
        </button>
      </>
    ),
    [confirmDisabled, confirmLabel, confirmVariant, onCancel, onConfirm],
  );

  return (
    <Modal
      title={title}
      description={description}
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      footer={footer}
    >
      {children}
    </Modal>
  );
};

export default ConfirmDialog;

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';

interface ModalProps {
  title: string;
  description?: string;
  isOpen: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export const Modal = ({
  title,
  description,
  isOpen,
  onClose,
  children,
  footer,
  size = 'md',
}: ModalProps) => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handler);
    }
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950/50 px-4 py-10 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className={classNames(
          'flex max-h-full w-full flex-col overflow-hidden rounded-3xl border border-neutral-200/60 bg-white/95 shadow-2xl backdrop-blur',
          sizeMap[size],
        )}
      >
        <div className="flex items-start justify-between border-b border-neutral-200/70 px-8 py-6">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">{title}</h3>
            {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-transparent p-2 text-neutral-400 transition hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200/70 px-8 py-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;

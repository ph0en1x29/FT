import { type ReactNode } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeight?: string;
}

export interface BottomSheetOrModalProps extends BottomSheetProps {}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
}: BottomSheetProps) {
  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close bottom sheet"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="absolute inset-x-0 bottom-0">
        <div
          className={`overflow-y-auto rounded-t-2xl bg-[var(--surface)] transition-transform duration-300 ease-out ${
            isOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ maxHeight }}
        >
          <div className="mx-auto my-3 h-1 w-10 rounded-full bg-gray-300" />
          {title ? (
            <div className="border-b border-[var(--border)] px-4 pb-3">
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
          ) : null}
          <div className="px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function BottomSheetOrModal({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
}: BottomSheetOrModalProps) {
  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        maxHeight={maxHeight}
      >
        {children}
      </BottomSheet>

      <div
        className={`fixed inset-0 z-50 hidden md:block ${isOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          aria-label="Close modal"
          onClick={onClose}
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="relative flex h-full items-center justify-center p-4">
          <div
            className={`mx-4 w-full max-w-lg overflow-y-auto rounded-xl bg-surface bg-[var(--surface)] p-6 shadow-xl transition-all duration-300 ${
              isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
            style={{ maxHeight }}
          >
            {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

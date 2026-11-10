import type { DragEvent, ReactNode } from "react";

export function LayerBackdrop({
  children,
  className = "",
  onClose,
  locked = false,
  onBackdropDragOver,
  onBackdropDrop,
}: {
  children: ReactNode;
  className?: string;
  onClose: () => void;
  locked?: boolean;
  onBackdropDragOver?: (event: DragEvent<HTMLElement>) => void;
  onBackdropDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <div className={`studio-backdrop ${className}`}>
      <button
        className="layer-dismiss"
        type="button"
        tabIndex={-1}
        aria-label="关闭当前面板"
        disabled={locked}
        onClick={onClose}
        onDragOver={onBackdropDragOver}
        onDrop={onBackdropDrop}
      />
      {children}
    </div>
  );
}

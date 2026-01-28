import { useEffect, useRef } from "react";
import { Button } from "./button";
import { X } from "lucide-react";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmVariant = "default",
  onConfirm,
  isLoading = false,
}: AlertDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, isLoading, onOpenChange]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!open || !dialogRef.current) return;

    // Focus cancel button on open
    cancelButtonRef.current?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [open]);

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={() => !isLoading && onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby={description ? "alert-dialog-description" : undefined}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-lg shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close button */}
        <button
          onClick={() => !isLoading && onOpenChange(false)}
          disabled={isLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <h2 id="alert-dialog-title" className="text-lg font-semibold text-gray-900 pr-8">
          {title}
        </h2>
        {description && (
          <p id="alert-dialog-description" className="mt-2 text-sm text-gray-600">
            {description}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Aguarde..." : confirmText}
          </Button>
        </div>
      </div>
    </>
  );
}

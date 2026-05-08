interface ToastAction {
  label: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

interface ToastData {
  description?: string;
  duration?: number;
  action?: ToastAction;
}

type ToastFn = (message: string, data?: ToastData) => void;

/**
 * Lazy wrapper around sonner's `toast`. The sonner module (~15 kB gzipped)
 * is loaded on first invocation instead of at import time, keeping it out
 * of the initial page JS. Safe because toast is only called from event
 * handlers, never during render.
 */
export const toast: ToastFn & {
  success: ToastFn;
  error: ToastFn;
} = Object.assign(
  (message: string, data?: ToastData) => {
    import("sonner").then((mod) => mod.toast(message, data));
  },
  {
    success: (message: string, data?: ToastData) => {
      import("sonner").then((mod) => mod.toast.success(message, data));
    },
    error: (message: string, data?: ToastData) => {
      import("sonner").then((mod) => mod.toast.error(message, data));
    },
  },
);

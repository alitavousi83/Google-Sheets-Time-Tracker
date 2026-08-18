import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore();
  const icons = { success: CheckCircle, error: AlertCircle, info: Info };
  const colors = { success: 'text-success', error: 'text-error', info: 'text-info' };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className="card px-4 py-3 flex items-center gap-3 animate-slide-up shadow-elevated"
          >
            <Icon className={`w-5 h-5 shrink-0 ${colors[toast.type]}`} />
            <p className="text-sm flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-muted hover:text-slate-700 dark:hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

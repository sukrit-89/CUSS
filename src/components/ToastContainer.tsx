import { useToastStore, type ToastType } from '@/stores/toast.store';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ICON_MAP: Record<ToastType, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, { icon: string; border: string }> = {
  success: {
    icon: 'text-green-400',
    border: 'border-green-500/20',
  },
  error: {
    icon: 'text-red-400',
    border: 'border-red-500/20',
  },
  info: {
    icon: 'text-blue-400',
    border: 'border-blue-500/20',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => {
        const Icon = ICON_MAP[t.type];
        const colors = COLOR_MAP[t.type];

        return (
          <div
            key={t.id}
            className={`liquid-glass pointer-events-auto rounded-2xl p-4 flex items-start gap-3 border ${colors.border} shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-3`}
          >
            <div className={`mt-0.5 shrink-0 ${colors.icon}`}>
              <Icon size={18} />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="text-xs font-medium text-white leading-snug">{t.title}</div>
              {t.description && (
                <div className="text-[11px] text-white/50 leading-relaxed mt-0.5">
                  {t.description}
                </div>
              )}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-white/30 hover:text-white/80 p-0.5 rounded transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === 'true');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed || installed) return null;

  const install = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-24 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-80 z-50 card p-4 shadow-elevated animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Install Time Tracker</p>
          <p className="text-xs text-muted mt-0.5">Add to your home screen for a native app experience</p>
          <div className="flex gap-2 mt-3">
            <button onClick={install} className="btn-primary text-xs py-2 px-3">Install</button>
            <button
              onClick={() => { setDismissed(true); localStorage.setItem('pwa-dismissed', 'true'); }}
              className="btn-secondary text-xs py-2 px-3"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

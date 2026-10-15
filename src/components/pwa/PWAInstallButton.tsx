import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';
import { PWAInstallModal } from './PWAInstallModal.tsx';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState<boolean>(false);

  // If already running in standalone mode (already installed), hide the install button
  if (isInstalled) {
    return null;
  }

  // If not installable and not iOS, hide
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isIOS) {
      setShowModal(true);
      return;
    }

    const installed = await install();
    if (!installed) {
      // If prompt didn't show or was cancelled, open instructional modal
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="تثبيت نظام جامعة المستقبل على جهازك (PWA)"
        className={`flex items-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer ${
          variant === 'compact'
            ? 'px-2.5 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            : 'px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm hover:from-emerald-700 hover:to-teal-700'
        } ${className}`}
      >
        <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="hidden sm:inline">تثبيت التطبيق</span>
        <span className="sm:hidden text-xs">تثبيت</span>
      </button>

      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isIOS={isIOS}
        onInstallClick={install}
      />
    </>
  );
};

import React, { useEffect } from 'react';
import { X, Bell, AlertCircle, Info, CheckCircle } from 'lucide-react';

function ToastNotification({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case 'invite':
        return <Bell className="w-5 h-5" />;
      case 'session':
        return <Info className="w-5 h-5" />;
      case 'tab':
        return <Info className="w-5 h-5" />;
      case 'status':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'invite':
        return 'bg-purple-500 text-white';
      case 'session':
        return 'bg-blue-500 text-white';
      case 'tab':
        return 'bg-indigo-500 text-white';
      case 'status':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'success':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-gray-800 text-white';
    }
  };

  return (
    <div
      className={`${getColors()} rounded-lg shadow-2xl p-4 min-w-[320px] max-w-md animate-slide-in`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default ToastNotification;

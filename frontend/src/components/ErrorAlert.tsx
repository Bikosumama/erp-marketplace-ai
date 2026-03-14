'use client';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}

export default function ErrorAlert({ message, onRetry, actionLabel = 'Retry' }: ErrorAlertProps) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        <svg
          className="h-5 w-5 text-red-500"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm text-red-700 font-medium">Error</p>
        <p className="text-sm text-red-600 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex-shrink-0 text-sm text-red-600 hover:text-red-800 font-medium underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

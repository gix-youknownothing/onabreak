import { providerRegistry } from "../lib/providerRegistry";

interface ProviderIconProps {
  providerId: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="url(#claudeIconGrad)" />
      <path
        d="M12 6.2L7.3 19H9.4l.85-2.3h3.5l.85 2.3h2.1L12 6.2Zm-1.05 8.55L12 11.6l1.05 3.15h-2.1Z"
        fill="white"
      />
      <defs>
        <linearGradient id="claudeIconGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB923C" />
          <stop offset="1" stopColor="#F43F5E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CodexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="url(#codexIconGrad)" />
      <path
        d="M8 12h8M12 8v8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="codexIconGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="url(#cursorIconGrad)" />
      <path
        d="M9 7l7 5-7 5V7z"
        fill="white"
      />
      <defs>
        <linearGradient id="cursorIconGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#6D28D9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#44403C" />
      <path
        d="M8 9l3 3-3 3M13 15h3"
        stroke="#A8A29E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrowserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#1E40AF" />
      <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.5" />
      <path d="M7 12h10M12 7c-1.5 1.5-2 3-2 5s.5 3.5 2 5c1.5-1.5 2-3 2-5s-.5-3.5-2-5z" stroke="white" strokeWidth="1" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#92400E" />
      <path d="M9 8h6M9 11h6M9 14h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#1C1917" />
      <circle cx="12" cy="12" r="2.5" fill="#F97316" />
      <circle cx="8" cy="8" r="1.5" fill="#A8A29E" />
      <circle cx="16" cy="8" r="1.5" fill="#A8A29E" />
      <circle cx="8" cy="16" r="1.5" fill="#A8A29E" />
      <path
        d="M8 8.5L10.5 11M16 8.5L13.5 11M10.5 13L8 15.5M13.5 13L16 15.5"
        stroke="#78716C"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FallbackIcon({ className, label }: { className?: string; label: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#57534E" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
        {label.charAt(0).toUpperCase()}
      </text>
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  claude: ClaudeIcon,
  codex: CodexIcon,
  cursor: CursorIcon,
  terminal: TerminalIcon,
  browser: BrowserIcon,
  document: DocumentIcon,
  git: GitIcon,
};

const SIZE_CLASSES: Record<string, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-5 h-5",
  md: "w-6 h-6",
};

export default function ProviderIcon({ providerId, size = "sm", className = "" }: ProviderIconProps) {
  const provider = providerRegistry.get(providerId);
  const iconKey = provider?.icon ?? providerId;
  const IconComponent = ICON_MAP[iconKey];
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const combinedClass = `${sizeClass} flex-shrink-0 ${className}`.trim();

  if (IconComponent) {
    return <IconComponent className={combinedClass} />;
  }

  return <FallbackIcon className={combinedClass} label={provider?.name ?? providerId} />;
}

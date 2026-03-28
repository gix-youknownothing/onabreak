import { useEffect, useRef } from "react";
import { providerRegistry } from "../lib/providerRegistry";
import { CATEGORY_LABELS, type ProviderCategory } from "../lib/providers";
import { useSettingsStore } from "../stores/settingsStore";
import ProviderIcon from "./ProviderIcon";

interface ProviderPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (providerId: string) => void;
  onManage: () => void;
  onClose: () => void;
}

interface ProviderPickerPortalProps {
  anchorEl: HTMLElement;
  onSelect: (providerId: string) => void;
  onManage: () => void;
  onClose: () => void;
}

function ProviderPickerBody({
  onSelect,
  onManage,
  onClose,
}: {
  onSelect: (providerId: string) => void;
  onManage: () => void;
  onClose: () => void;
}) {
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId);
  useSettingsStore((s) => s.quickProviderIds);

  const quickProviders = providerRegistry.getQuickList();
  const allProviders = providerRegistry.getAll();

  const categories = new Map<ProviderCategory, typeof allProviders>();
  for (const p of allProviders) {
    const list = categories.get(p.category) || [];
    list.push(p);
    categories.set(p.category, list);
  }

  const categoryOrder: ProviderCategory[] = ["ai-agent", "terminal", "browser", "document"];

  return (
    <>
      {/* Quick access */}
      {quickProviders.length > 0 && (
        <div className="p-2 border-b border-macos-border">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-macos-tertiary">
            快捷创建
          </div>
          {quickProviders.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-macos-elevated"
            >
              <ProviderIcon providerId={p.id} size="sm" />
              <span className="text-[13px] text-macos-text truncate">
                {p.name}
              </span>
              {p.id === defaultProviderId && (
                <span className="ml-auto text-[10px] text-macos-blue">
                  默认
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* All providers by category */}
      <div className="max-h-64 overflow-y-auto py-1">
        {categoryOrder.map((cat) => {
          const providers = categories.get(cat);
          if (!providers || providers.length === 0) return null;

          return (
            <div key={cat}>
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-macos-tertiary">
                {CATEGORY_LABELS[cat]}
              </div>
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-1.5 text-left transition-colors hover:bg-macos-elevated"
                >
                  <ProviderIcon providerId={p.id} size="xs" />
                  <span className="text-[12px] text-macos-secondary truncate">
                    {p.name}
                  </span>
                  {p.id === defaultProviderId && (
                    <span className="ml-auto text-[10px] text-macos-blue/70">
                      ★
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-macos-border p-1.5">
        <button
          onClick={() => {
            onClose();
            onManage();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors hover:bg-macos-elevated"
        >
          <svg className="w-3.5 h-3.5 text-macos-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[12px] text-macos-secondary">管理 Provider...</span>
        </button>
      </div>
    </>
  );
}

export default function ProviderPicker({
  anchorRef,
  onSelect,
  onManage,
  onClose,
}: ProviderPickerProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute top-full right-0 mt-1 w-64 bg-macos-card/95 backdrop-blur-xl border border-macos-border rounded-xl shadow-lg shadow-black/30 overflow-hidden z-50"
    >
      <ProviderPickerBody
        onSelect={onSelect}
        onManage={onManage}
        onClose={onClose}
      />
    </div>
  );
}

export function ProviderPickerPortal({
  anchorEl,
  onSelect,
  onManage,
  onClose,
}: ProviderPickerPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the menu relative to the anchor element using screen coordinates
  const rect = anchorEl.getBoundingClientRect();
  const style: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 4,
    right: window.innerWidth - rect.right,
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorEl, onClose]);

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed w-64 bg-macos-card/95 backdrop-blur-xl border border-macos-border rounded-xl shadow-lg shadow-black/30 overflow-hidden z-[9999]"
    >
      <ProviderPickerBody
        onSelect={onSelect}
        onManage={onManage}
        onClose={onClose}
      />
    </div>
  );
}

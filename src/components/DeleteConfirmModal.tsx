interface Props {
  open: boolean;
  target: { name: string } | null;
  kind?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ open, target, kind = "workspace", onConfirm, onCancel }: Props) {
  if (!open || !target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm mx-4 bg-macos-card border border-macos-border rounded-2xl shadow-lg shadow-black/30 overflow-hidden">
        {/* Icon */}
        <div className="flex justify-center pt-8 pb-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2 text-center">
          <h3 className="text-[17px] font-semibold text-macos-text mb-2">删除 {kind}</h3>
          <p className="text-[13px] text-macos-secondary">
            确定要删除 <span className="text-macos-text font-medium">"{target.name}"</span> 吗？
          </p>
          <p className="text-[11px] text-macos-tertiary mt-1">此操作不可撤销</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6 pt-5">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-macos-elevated text-macos-secondary rounded-lg hover:bg-macos-card text-[13px] font-medium transition-colors border border-macos-border"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-macos-red text-white rounded-lg hover:bg-red-600 text-[13px] font-medium transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

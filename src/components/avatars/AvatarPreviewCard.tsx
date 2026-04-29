"use client";

interface AvatarPreviewCardProps {
  displayName: string | null;
  avatarModelUrl: string;
  thumbnailUrl?: string | null;
  isDefault?: boolean;
  onSelect?: () => void;
  onSetDefault?: () => void;
  selected?: boolean;
}

export function AvatarPreviewCard({
  displayName,
  avatarModelUrl,
  thumbnailUrl,
  isDefault,
  onSelect,
  onSetDefault,
  selected,
}: AvatarPreviewCardProps) {
  const thumb = thumbnailUrl ?? "https://via.placeholder.com/128/334155/94a3b8?text=Avatar";

  return (
    <div
      onClick={onSelect}
      className={`
        rounded-xl border-2 p-4 cursor-pointer transition-all
        ${selected ? "border-cyan-400 bg-cyan-500/10" : "border-slate-600 bg-slate-800/60 hover:border-slate-500"}
      `}
    >
      <div className="aspect-square rounded-lg overflow-hidden bg-slate-700 mb-3">
        <img
          src={thumb}
          alt={displayName ?? "Avatar"}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://via.placeholder.com/128/334155/94a3b8?text=Avatar";
          }}
        />
      </div>
      <p className="text-sm font-medium text-slate-200 truncate">
        {displayName ?? "Unnamed Avatar"}
      </p>
      {isDefault && (
        <span className="inline-block mt-1 text-xs text-cyan-400 font-medium">Default</span>
      )}
      {onSetDefault && !isDefault && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault();
          }}
          className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
        >
          Set as default
        </button>
      )}
    </div>
  );
}

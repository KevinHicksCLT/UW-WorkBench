import type { ReactNode } from 'react';

// Section-card header for the role profile — tinted icon square + title +
// count, with an optional right-aligned slot (e.g. a filter select). Keeps
// the three profile cards visually consistent and color-coded.
export default function SectionHeader({
  icon,
  iconClass,
  title,
  count,
  right,
}: {
  icon: ReactNode;
  /** Tint classes for the icon square, e.g. 'bg-[#eef2ff] text-[#4338ca]'. */
  iconClass: string;
  title: string;
  count?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="px-4 py-2.5 border-b border-[#eaeaea] flex items-center gap-2.5 flex-wrap">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0 ${iconClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2 className="text-base font-semibold text-[#171717]">{title}</h2>
      {count !== undefined && <span className="text-[11px] text-[#a3a3a3] tnum">{count}</span>}
      {right}
    </div>
  );
}

/** 2px-dot marker tinted to a value stream's assigned color. */
export function StreamDot({ color }: { color: string }) {
  return (
    <span
      className="h-2 w-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

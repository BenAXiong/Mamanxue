import type { ReactNode } from "react";

interface GradeBarProps {
  actions?: ReactNode;
  onSelect?: (grade: number) => void;
}

const GRADES = [1, 2, 3];

export function GradeBar({ actions, onSelect }: GradeBarProps) {
  return (
    <div
      className="grade-bar fixed inset-x-0 bottom-0 z-40 bg-slate-950/90 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:px-6 md:px-8">
        {actions ? <div className="flex items-center justify-between text-sm text-slate-400">{actions}</div> : null}
        <div className="grid grid-cols-3 gap-3">
          {GRADES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSelect?.(value)}
              className="btn-primary text-lg"
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GradeBar;

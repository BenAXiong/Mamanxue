import type { ReactNode } from "react";

interface GradeBarProps {
  actions?: ReactNode;
  onGrade?: (grade: 1 | 2 | 3) => void;
  revealed?: boolean;
  onReveal?: () => void;
  onDisable?: () => void;
  onMarkHard?: () => void;
  hardActive?: boolean;
  gradeDisabled?: boolean;
}

const GRADES: Array<1 | 2 | 3> = [1, 2, 3];

export function GradeBar({
  actions,
  onGrade,
  revealed,
  onReveal,
  onDisable,
  onMarkHard,
  hardActive,
  gradeDisabled,
}: GradeBarProps) {
  const disableGrades = gradeDisabled || !revealed;

  return (
    <div
      className="grade-bar fixed inset-x-0 bottom-0 z-40 bg-slate-950/90 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] backdrop-blur"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:px-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
          {actions ? <div className="flex-1">{actions}</div> : <span className="flex-1" />}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {onMarkHard ? (
              <button
                type="button"
                onClick={onMarkHard}
                className={`btn-secondary ${
                  hardActive ? "bg-amber-600 text-white hover:bg-amber-500" : "bg-slate-800 text-slate-200"
                }`}
              >
                {hardActive ? "Marked hard" : "Mark hard"}
              </button>
            ) : null}
            {onDisable ? (
              <button type="button" onClick={onDisable} className="btn-secondary bg-slate-800 text-slate-200">
                Disable card
              </button>
            ) : null}
            {onReveal ? (
              <button type="button" onClick={onReveal} className="btn-secondary" disabled={revealed}>
                {revealed ? "Revealed" : "Reveal"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {GRADES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onGrade?.(value)}
              className="btn-primary text-lg"
              disabled={disableGrades}
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

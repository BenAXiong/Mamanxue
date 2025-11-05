import type { DeckSummary } from "../hooks/useDeckSummaries";

interface DeckListProps {
  summaries: DeckSummary[];
  selectedDeckId: string | null;
  onSelect: (deckId: string) => void;
}

const CHECK = "\u2714"; // ✔
const CROSS = "\u2716"; // ✖

export function DeckList({
  summaries,
  selectedDeckId,
  onSelect,
}: DeckListProps) {
  if (!summaries.length) {
    return (
      <section className="card space-y-3 p-6">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold text-white">Decks</h2>
          <p className="text-sm text-slate-400">
            No decks imported yet. Bootstrap will load starter decks on first
            run.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-white">Decks</h2>
        <p className="text-sm text-slate-400">
          Add workflow here.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map((summary) => (
          <DeckCard
            key={summary.deckId}
            summary={summary}
            isSelected={summary.deckId === selectedDeckId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

interface DeckCardProps {
  summary: DeckSummary;
  isSelected: boolean;
  onSelect: (deckId: string) => void;
}

function DeckCard({ summary, isSelected, onSelect }: DeckCardProps) {
  const hasMissingAudio = summary.missingAudio.length > 0;
  const badgeLabel = hasMissingAudio ? CROSS : CHECK;

  return (
    <button
      type="button"
      onClick={() => onSelect(summary.deckId)}
      className={`card space-y-2 p-4 text-left transition hover:border-blue-500 hover:shadow-lg ${
        isSelected ? "border-blue-500 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-white">
          {summary.deckId}
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-200">
          <span
            className={`text-base font-bold ${
              hasMissingAudio ? "text-red-400" : "text-emerald-300"
            }`}
            aria-label={hasMissingAudio ? "Missing audio" : "All audio present"}
          >
            {badgeLabel}
          </span>
          <span>
            {summary.count} Card{summary.count === 1 ? "" : "s"}
          </span>
        </span>
      </div>
      {hasMissingAudio ? (
        <div className="space-y-1 text-xs">
          <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-1 font-semibold text-amber-100">
            Missing audio: {summary.missingAudio.length}
          </span>
          <ul className="space-y-0.5 text-slate-400">
            {summary.missingAudio.slice(0, 3).map((path) => (
              <li key={path}>{path}</li>
            ))}
            {summary.missingAudio.length > 3 ? <li>…and more</li> : null}
          </ul>
        </div>
      ) : null}
    </button>
  );
}

export default DeckList;


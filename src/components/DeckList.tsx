import type { DeckSummary } from "../hooks/useDeckSummaries";

interface DeckListProps {
  summaries: DeckSummary[];
  selectedDeckId: string | null;
  onSelect: (deckId: string) => void;
}

export function DeckList({ summaries, selectedDeckId, onSelect }: DeckListProps) {
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
          Choose a deck to review. Missing audio files are flagged for quick
          fixes.
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
  return (
    <button
      type="button"
      onClick={() => onSelect(summary.deckId)}
      className={`card space-y-2 p-4 text-left transition hover:border-blue-500 hover:shadow-lg ${isSelected ? "border-blue-500 shadow-lg" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-white">
          {summary.deckId}
        </span>
        <span className="text-xs font-medium text-slate-400">
          {summary.count} card{summary.count === 1 ? "" : "s"}
        </span>
      </div>
      {summary.missingAudio.length ? (
        <div className="space-y-1 text-xs">
          <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-1 font-semibold text-amber-100">
            Missing audio: {summary.missingAudio.length}
          </span>
          <ul className="space-y-0.5 text-slate-400">
            {summary.missingAudio.slice(0, 3).map((path) => (
              <li key={path}>{path}</li>
            ))}
            {summary.missingAudio.length > 3 ? (
              <li>…and more</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-green-300">All audio files found.</p>
      )}
    </button>
  );
}

export default DeckList;


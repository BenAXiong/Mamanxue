import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import {
  getDeckCards,
  setCardHardFlag,
  setCardSuspended,
  type DeckCardDetail,
} from "../db/cards";

interface FiltersState {
  search: string;
  suspendedOnly: boolean;
  hasSlowAudio: boolean;
  missingAudio: boolean;
  tagFilter: string;
}

const INITIAL_FILTERS: FiltersState = {
  search: "",
  suspendedOnly: false,
  hasSlowAudio: false,
  missingAudio: false,
  tagFilter: "",
};

export function CardBrowserPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deckId = searchParams.get("deck");

  const [cards, setCards] = useState<DeckCardDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);

  const loadCards = useCallback(async () => {
    if (!deckId) {
      setCards([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getDeckCards(deckId);
      setCards(result);
    } catch (loadError) {
      console.error("Failed to load deck cards", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load cards for this deck.",
      );
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    for (const detail of cards) {
      detail.card.tags?.forEach((tag) => set.add(tag));
    }
    return Array.from(set).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((detail) => {
      const { card, review, missingAudio, missingSlowAudio } = detail;
      const suspended = review?.suspended === true;

      if (filters.suspendedOnly && !suspended) {
        return false;
      }

      if (filters.hasSlowAudio && !card.audio_slow) {
        return false;
      }

      if (filters.missingAudio && !missingAudio && !missingSlowAudio) {
        return false;
      }

      if (filters.tagFilter) {
        if (!card.tags || !card.tags.includes(filters.tagFilter)) {
          return false;
        }
      }

      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const matchesFr = card.fr.toLowerCase().includes(needle);
        const matchesEn = card.en.toLowerCase().includes(needle);
        if (!matchesFr && !matchesEn) {
          return false;
        }
      }

      return true;
    });
  }, [cards, filters]);

  const handleSuspendToggle = async (cardId: string, suspended: boolean) => {
    try {
      await setCardSuspended(cardId, suspended);
      await loadCards();
    } catch (toggleError) {
      console.error("Failed to toggle suspended state", toggleError);
      alert(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update card status.",
      );
    }
  };

  const handleHardToggle = async (cardId: string, nextHard: boolean) => {
    try {
      await setCardHardFlag(cardId, nextHard);
      await loadCards();
    } catch (toggleError) {
      console.error("Failed to toggle hard flag", toggleError);
      alert(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update card flag.",
      );
    }
  };

  if (!deckId) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Card Browser</h1>
          <p className="text-sm text-slate-400">
            No deck selected. Return to the deck manager to choose a deck.
          </p>
        </header>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="btn-secondary"
        >
          Back to decks
        </button>
      </div>
    );
  }

  const info = cards.length;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-white">Card Browser</h1>
            <p className="text-sm text-slate-400">
              Browsing deck <span className="font-semibold text-white">{deckId}</span> — {info} cards loaded.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="btn-secondary"
          >
            Back
          </button>
        </div>
      </header>

      {error ? (
        <div className="card space-y-2 p-4 text-sm text-red-200">
          <p className="font-semibold">Unable to load cards.</p>
          <p>{error}</p>
        </div>
      ) : null}

      <section className="card space-y-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search cards
            </label>
            <input
              type="search"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              placeholder="Search FR/EN text"
            />
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.suspendedOnly}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    suspendedOnly: event.target.checked,
                  }))
                }
              />
              Suspended only
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.hasSlowAudio}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    hasSlowAudio: event.target.checked,
                  }))
                }
              />
              Has slow audio
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.missingAudio}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    missingAudio: event.target.checked,
                  }))
                }
              />
              Missing audio
            </label>
            <label className="inline-flex items-center gap-2">
              <span>Tag</span>
              <select
                value={filters.tagFilter}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    tagFilter: event.target.value,
                  }))
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              >
                <option value="">All</option>
                {uniqueTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {loading ? (
          <p className="text-xs text-slate-400">Loading cards...</p>
        ) : null}
      </section>

      <section className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">FR</th>
                <th className="px-3 py-2">EN</th>
                <th className="px-3 py-2">Flags</th>
                <th className="px-3 py-2">Audio</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCards.map((detail, index) => {
                const { card, review, missingAudio, missingSlowAudio } = detail;
                const suspended = review?.suspended === true;
                const hardFlag = review?.hardFlag === true;
                const displayNumber = card.sequence ?? index + 1;

                return (
                  <tr
                    key={card.id}
                    className={`border-b border-slate-800/70 ${
                      suspended ? "bg-slate-900/50 text-slate-500" : ""
                    }`}
                  >
                    <td className="px-3 py-2 align-top text-xs text-slate-400">
                      {displayNumber}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-slate-100">
                        {card.fr.length > 80 ? `${card.fr.slice(0, 80)}…` : card.fr}
                      </p>
                      {card.notes ? (
                        <p className="text-xs text-slate-500">{card.notes}</p>
                      ) : null}
                      {card.tags && card.tags.length ? (
                        <p className="text-xs text-slate-500">
                          Tags: {card.tags.join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-slate-200">
                      {card.en.length > 100 ? `${card.en.slice(0, 100)}…` : card.en}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div className="flex flex-wrap gap-1">
                        {suspended ? (
                          <span className="rounded bg-slate-700/50 px-2 py-1 text-slate-300">
                            Suspended
                          </span>
                        ) : null}
                        {hardFlag ? (
                          <span className="rounded bg-amber-500/20 px-2 py-1 text-amber-100">
                            Hard
                          </span>
                        ) : null}
                        {missingAudio ? (
                          <span className="rounded bg-red-500/30 px-2 py-1 text-red-100">
                            Main audio missing
                          </span>
                        ) : null}
                        {card.audio_slow && missingSlowAudio ? (
                          <span className="rounded bg-red-500/20 px-2 py-1 text-red-100">
                            Slow audio missing
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-2">
                        <AudioPlayer
                          src={card.audio}
                          label="Play"
                          available={!missingAudio}
                        />
                        {card.audio_slow ? (
                          <AudioPlayer
                            src={card.audio_slow}
                            label="Slow"
                            available={!missingSlowAudio}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleSuspendToggle(card.id, !suspended)
                          }
                          className="btn-secondary"
                        >
                          {suspended ? "Unsuspend" : "Suspend"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleHardToggle(card.id, !hardFlag)}
                          className="btn-secondary"
                        >
                          {hardFlag ? "Clear hard" : "Mark hard"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {!loading && filteredCards.length === 0 ? (
        <p className="text-sm text-slate-400">
          No cards match the current filters.
        </p>
      ) : null}
    </div>
  );
}

export default CardBrowserPage;

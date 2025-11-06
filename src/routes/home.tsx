import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useDeckSummaries } from "../hooks/useDeckSummaries";
import {
  deleteDeck,
  listDecks,
  renameDeck,
  type DeckAggregation,
} from "../db/decks";
import { LAST_REVIEWED_DECK_KEY, useSessionStore } from "../store/session";

interface DeckCounts {
  review: number;
  fail: number;
  fresh: number;
  total: number;
  suspended: number;
  missingAudio: number;
}

interface DeckTreeNode {
  path: string;
  label: string;
  deck?: DeckAggregation;
  counts: DeckCounts;
  children: DeckTreeNode[];
}

const ZERO_COUNTS: DeckCounts = {
  review: 0,
  fail: 0,
  fresh: 0,
  total: 0,
  suspended: 0,
  missingAudio: 0,
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function deckToCounts(deck: DeckAggregation): DeckCounts {
  return {
    review: deck.dueToday,
    fail: deck.hardCount,
    fresh: deck.newCount,
    total: deck.total,
    suspended: deck.suspended,
    missingAudio: deck.missingAudio,
  };
}

function mergeCounts(target: DeckCounts, addition: DeckCounts): DeckCounts {
  return {
    review: target.review + addition.review,
    fail: target.fail + addition.fail,
    fresh: target.fresh + addition.fresh,
    total: target.total + addition.total,
    suspended: target.suspended + addition.suspended,
    missingAudio: target.missingAudio + addition.missingAudio,
  };
}

function buildDeckTree(decks: DeckAggregation[]): DeckTreeNode[] {
  const root: DeckTreeNode[] = [];
  const nodeMap = new Map<string, DeckTreeNode>();

  const ensureNode = (path: string, label: string, parentChildren: DeckTreeNode[]) => {
    const existing = nodeMap.get(path);
    if (existing) {
      return existing;
    }
    const node: DeckTreeNode = {
      path,
      label,
      counts: { ...ZERO_COUNTS },
      children: [],
    };
    nodeMap.set(path, node);
    parentChildren.push(node);
    return node;
  };

  decks.forEach((deck) => {
    const segments = deck.deckId.split("::");
    let parentChildren = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}::${segment}` : segment;
      const node = ensureNode(currentPath, segment, parentChildren);

      if (index === segments.length - 1) {
        node.deck = deck;
        node.counts = deckToCounts(deck);
      }

      parentChildren = node.children;
    });
  });

  const rollupCounts = (node: DeckTreeNode): DeckCounts => {
    let totals = node.deck ? deckToCounts(node.deck) : { ...ZERO_COUNTS };
    node.children.forEach((child) => {
      const childTotals = rollupCounts(child);
      totals = mergeCounts(totals, childTotals);
    });
    node.counts = totals;
    return totals;
  };

  root.forEach((node) => {
    rollupCounts(node);
  });

  return root;
}

function collectPaths(nodes: DeckTreeNode[], target: Set<string> = new Set()): Set<string> {
  nodes.forEach((node) => {
    target.add(node.path);
    if (node.children.length) {
      collectPaths(node.children, target);
    }
  });
  return target;
}

export function HomePage() {
  const deckSummaries = useDeckSummaries();
  const setDeck = useSessionStore((state) => state.setDeck);
  const loadQueueForToday = useSessionStore((state) => state.loadQueueForToday);

  const [decks, setDecks] = useState<DeckAggregation[]>([]);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [lastDeckId, setLastDeckId] = useState<string | null>(null);
  const [deckTreeOpen, setDeckTreeOpen] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setLastDeckId(window.localStorage.getItem(LAST_REVIEWED_DECK_KEY));
  }, []);

  const loadDeckSnapshot = useCallback(async () => {
    setLoadingDecks(true);
    setDeckError(null);
    try {
      const result = await listDecks();
      setDecks(result);
      return result;
    } catch (error) {
      console.error("Failed to list decks", error);
      setDeckError(error instanceof Error ? error.message : "Unable to load decks.");
      return undefined;
    } finally {
      setLoadingDecks(false);
    }
  }, []);

  useEffect(() => {
    void loadDeckSnapshot();
  }, [deckSummaries, loadDeckSnapshot]);

  const deckTree = useMemo(() => buildDeckTree(decks), [decks]);

  useEffect(() => {
    const validPaths = collectPaths(deckTree);
    setExpandedPaths((previous) => {
      let changed = false;
      const next = new Set<string>();

      previous.forEach((value) => {
        if (validPaths.has(value)) {
          next.add(value);
        } else {
          changed = true;
        }
      });

      if (!next.size && deckTree.length > 0) {
        deckTree.forEach((node) => next.add(node.path));
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [deckTree]);

  const totals = useMemo(
    () =>
      deckTree.reduce(
        (acc, node) => mergeCounts(acc, node.counts),
        { ...ZERO_COUNTS },
      ),
    [deckTree],
  );

  const hasDecks = decks.length > 0;

  const continueLabel = useMemo(() => {
    if (lastDeckId) {
      const matchingDeck = decks.find((deck) => deck.deckId === lastDeckId);
      if (matchingDeck) {
        return matchingDeck.dueToday > 0
          ? `Continue ${matchingDeck.deckId} (${formatCount(matchingDeck.dueToday)} due)`
          : `Continue ${matchingDeck.deckId}`;
      }
    }
    return "Continue reviewing";
  }, [decks, lastDeckId]);

  const resolveDeckId = useCallback(() => {
    if (lastDeckId && decks.some((deck) => deck.deckId === lastDeckId)) {
      return lastDeckId;
    }
    return decks[0]?.deckId ?? null;
  }, [decks, lastDeckId]);

  const handleOpenDeck = useCallback(
    async (deckId: string) => {
      try {
        setDeck(deckId);
        await loadQueueForToday(deckId);
        navigate(`/review?deck=${encodeURIComponent(deckId)}`);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_REVIEWED_DECK_KEY, deckId);
        }
        setLastDeckId(deckId);
      } catch (error) {
        console.error("Failed to open deck", error);
        alert(error instanceof Error ? error.message : "Unable to open deck right now.");
      }
    },
    [loadQueueForToday, navigate, setDeck],
  );

  const handleContinue = useCallback(async () => {
    const targetDeck = resolveDeckId();
    if (!targetDeck) {
      return;
    }
    await handleOpenDeck(targetDeck);
  }, [handleOpenDeck, resolveDeckId]);

  const handleRename = useCallback(
    async (deckId: string) => {
      const nextId = window.prompt("Rename deck", deckId);
      if (!nextId) {
        return;
      }
      const trimmed = nextId.trim();
      if (!trimmed || trimmed === deckId) {
        return;
      }

      try {
        await renameDeck(deckId, trimmed);
        const updated = await loadDeckSnapshot();
        if (lastDeckId === deckId) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LAST_REVIEWED_DECK_KEY, trimmed);
          }
          setLastDeckId(trimmed);
        }
        if (updated?.length === 0 && typeof window !== "undefined") {
          window.localStorage.removeItem(LAST_REVIEWED_DECK_KEY);
          setLastDeckId(null);
        }
      } catch (error) {
        console.error("Failed to rename deck", error);
        alert(error instanceof Error ? error.message : "Unable to rename deck.");
      }
    },
    [lastDeckId, loadDeckSnapshot],
  );

  const handleDelete = useCallback(
    async (deckId: string) => {
      const confirmed = window.confirm(
        `Delete deck ${deckId} and all its cards/progress? This cannot be undone.`,
      );

      if (!confirmed) {
        return;
      }

      try {
        await deleteDeck(deckId);
        const updated = (await loadDeckSnapshot()) ?? [];

        if (lastDeckId === deckId) {
          if (typeof window !== "undefined") {
            if (updated.length > 0) {
              window.localStorage.setItem(
                LAST_REVIEWED_DECK_KEY,
                updated[0].deckId,
              );
            } else {
              window.localStorage.removeItem(LAST_REVIEWED_DECK_KEY);
            }
          }
          setLastDeckId(updated[0]?.deckId ?? null);
        }
      } catch (error) {
        console.error("Failed to delete deck", error);
        alert(error instanceof Error ? error.message : "Unable to delete deck.");
      }
    },
    [lastDeckId, loadDeckSnapshot],
  );

  const handleBrowse = useCallback(
    (deckId: string) => {
      navigate(`/browser?deck=${encodeURIComponent(deckId)}`);
    },
    [navigate],
  );

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className="relative space-y-6 pb-28">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-white">Decks</h1>
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={!hasDecks || loadingDecks}
          className="cta-fab"
        >
          {continueLabel}
        </button>
      </header>
      {loadingDecks ? (
        <p className="text-xs-muted">Refreshing deck snapshot…</p>
      ) : null}
      {!hasDecks && !loadingDecks ? (
        <p className="text-xs-muted">Import or add decks to get started.</p>
      ) : null}

      <section className="card space-y-4 p-4">
        <header className="deck-tree-header">
          <button
            type="button"
            className="deck-tree-header-button"
            onClick={() => setDeckTreeOpen((value) => !value)}
            aria-expanded={deckTreeOpen}
          >
            <CaretIcon expanded={deckTreeOpen} />
            <span className="text-lg font-semibold text-white">Français</span>
          </button>
          <span className="deck-total text-xs-muted deck-header-summary">
            {formatCount(decks.length)} deck{decks.length === 1 ? "" : "s"}
          </span>
          <div className="deck-counts deck-header-counts">
            <span
              className={`deck-count deck-count-review ${totals.review > 0 ? "active" : ""}`}
              title={`${formatCount(totals.review)} cards to review`}
            >
              {formatCount(totals.review)}
            </span>
            <span
              className={`deck-count deck-count-fail ${totals.fail > 0 ? "active" : ""}`}
              title={`${formatCount(totals.fail)} cards marked as fail/hard`}
            >
              {formatCount(totals.fail)}
            </span>
            <span
              className={`deck-count deck-count-new ${totals.fresh > 0 ? "active" : ""}`}
              title={`${formatCount(totals.fresh)} new cards`}
            >
              {formatCount(totals.fresh)}
            </span>
          </div>
        </header>
        <div className="divider" />
        {deckError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <p className="font-semibold">Unable to load decks.</p>
            <p>{deckError}</p>
          </div>
        ) : null}
        {!hasDecks && !loadingDecks ? (
          <div className="space-y-2 text-sm text-muted">
            <p>No decks yet.</p>
            <p>Use the import screen or add cards manually to get started.</p>
          </div>
        ) : null}
        {hasDecks && deckTreeOpen ? (
          <DeckTreePanel
            nodes={deckTree}
            expanded={expandedPaths}
            activeDeckId={lastDeckId}
            onToggle={togglePath}
            onReview={(deckId) => void handleOpenDeck(deckId)}
            onBrowse={handleBrowse}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ) : null}
      </section>

      <AddCardFab
        onClick={() => {
          navigate("/import");
        }}
      />
    </div>
  );
}

interface DeckTreePanelProps {
  nodes: DeckTreeNode[];
  expanded: Set<string>;
  activeDeckId: string | null;
  onToggle: (path: string) => void;
  onReview: (deckId: string) => void;
  onBrowse: (deckId: string) => void;
  onRename: (deckId: string) => void;
  onDelete: (deckId: string) => void;
}

function DeckTreePanel({
  nodes,
  expanded,
  activeDeckId,
  onToggle,
  onReview,
  onBrowse,
  onRename,
  onDelete,
}: DeckTreePanelProps) {
  if (!nodes.length) {
    return null;
  }
  return (
    <div className="deck-tree">
      {nodes.map((node) => (
        <DeckTreeRow
          key={node.path}
          node={node}
          level={0}
          expanded={expanded}
          activeDeckId={activeDeckId}
          onToggle={onToggle}
          onReview={onReview}
          onBrowse={onBrowse}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface DeckTreeRowProps {
  node: DeckTreeNode;
  level: number;
  expanded: Set<string>;
  activeDeckId: string | null;
  onToggle: (path: string) => void;
  onReview: (deckId: string) => void;
  onBrowse: (deckId: string) => void;
  onRename: (deckId: string) => void;
  onDelete: (deckId: string) => void;
}

function DeckTreeRow({
  node,
  level,
  expanded,
  activeDeckId,
  onToggle,
  onReview,
  onBrowse,
  onRename,
  onDelete,
}: DeckTreeRowProps) {
  const isExpanded = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  const isActive = activeDeckId === node.path;
  const isClickable = Boolean(node.deck);

  const [touchActionsOpen, setTouchActionsOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const scheduleHideActions = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setTouchActionsOpen(false);
      hideTimerRef.current = null;
    }, 4000);
  }, []);

  const showActions = useCallback(() => {
    setTouchActionsOpen(true);
    scheduleHideActions();
  }, [scheduleHideActions]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (hideTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [clearLongPressTimer]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") {
        return;
      }
      if ((event.target as HTMLElement).closest(".deck-inline-actions")) {
        return;
      }
      clearLongPressTimer();
      if (typeof window !== "undefined") {
        longPressTimerRef.current = window.setTimeout(() => {
          showActions();
        }, 450);
      }
    },
    [clearLongPressTimer, showActions],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") {
        return;
      }
      clearLongPressTimer();
      if ((event.target as HTMLElement).closest(".deck-inline-actions")) {
        return;
      }
      if (touchActionsOpen) {
        scheduleHideActions();
      }
    },
    [clearLongPressTimer, scheduleHideActions, touchActionsOpen],
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") {
        return;
      }
      clearLongPressTimer();
    },
    [clearLongPressTimer],
  );

  const handleContextMenu = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      showActions();
    },
    [showActions],
  );

  const actionsVisible = touchActionsOpen;

  return (
    <div className="deck-node">
      <div
        className={`deck-row ${isActive ? "deck-row-active" : ""} ${actionsVisible ? "deck-row-actions-open" : ""}`}
        style={{ paddingLeft: `${0.75 + level * 1.25}rem` }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
      >
        <button
          type="button"
          className={`deck-toggle ${hasChildren ? "" : "deck-toggle-placeholder"}`}
          aria-label={hasChildren ? (isExpanded ? "Collapse deck" : "Expand deck") : "No subdecks"}
          onClick={() => (hasChildren ? onToggle(node.path) : undefined)}
          disabled={!hasChildren}
        >
          {hasChildren ? <CaretIcon expanded={isExpanded} /> : null}
        </button>
        <button
          type="button"
          className={`deck-main ${isClickable ? "" : "deck-main-disabled"}`}
          aria-disabled={!isClickable}
          onClick={() => {
            if (isClickable) {
              onReview(node.path);
            } else if (hasChildren) {
              onToggle(node.path);
            }
          }}
        >
          <div className="deck-main-grid">
            <div className="deck-title">
              <span className="deck-label">{node.label}</span>
              {node.counts.missingAudio > 0 ? (
                <span className="deck-warning" title={`${node.counts.missingAudio} audio files missing`}>
                  {formatCount(node.counts.missingAudio)} missing audio
                </span>
              ) : null}
            </div>
            <div className="deck-total text-xs-muted">
              {formatCount(node.counts.total)} cards
              {node.counts.suspended > 0 ? (
                <span className="deck-total-suspended">
                  &nbsp;&#8226;&nbsp;{formatCount(node.counts.suspended)} suspended
                </span>
              ) : null}
            </div>
            <div className="deck-counts">
              <span
                className={`deck-count deck-count-review ${node.counts.review > 0 ? "active" : ""}`}
                title={`${formatCount(node.counts.review)} cards to review`}
              >
                {formatCount(node.counts.review)}
              </span>
              <span
                className={`deck-count deck-count-fail ${node.counts.fail > 0 ? "active" : ""}`}
                title={`${formatCount(node.counts.fail)} cards marked as fail/hard`}
              >
                {formatCount(node.counts.fail)}
              </span>
              <span
                className={`deck-count deck-count-new ${node.counts.fresh > 0 ? "active" : ""}`}
                title={`${formatCount(node.counts.fresh)} new cards`}
              >
                {formatCount(node.counts.fresh)}
              </span>
            </div>
          </div>
        </button>
        <div className={`deck-inline-actions ${actionsVisible ? "visible" : ""}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBrowse(node.path);
            }}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRename(node.path);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="danger"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.path);
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {hasChildren && isExpanded ? (
        <div className="deck-children">
          {node.children.map((child) => (
            <DeckTreeRow
              key={child.path}
              node={child}
              level={level + 1}
              expanded={expanded}
              activeDeckId={activeDeckId}
              onToggle={onToggle}
              onReview={onReview}
              onBrowse={onBrowse}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AddCardFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="fab add-card-fab"
      aria-label="Add a new card"
      onClick={onClick}
    >
      <span className="fab-icon">+</span>
    </button>
  );
}

function CaretIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className={`caret ${expanded ? "caret-expanded" : ""}`}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default HomePage;

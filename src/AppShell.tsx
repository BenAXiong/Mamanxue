import { Outlet } from "react-router-dom";
import Footer from "./components/Footer";
import Header from "./components/Header";
import UpdateBanner from "./components/UpdateBanner";
import { useFirstRunBootstrap } from "./hooks/useFirstRunBootstrap";

export interface AppShellProps {
  hideFooter?: boolean;
}

export function AppShell({ hideFooter }: AppShellProps) {
  const { state: bootstrapState, result: bootstrapResult } =
    useFirstRunBootstrap();
  const bootstrapErrors = bootstrapResult?.errors ?? [];

  return (
    <div className="app-container">
      <Header />
      <main className="app-main">
        <UpdateBanner />
        {bootstrapState === "running" ? (
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
            Loading starter decks...
          </div>
        ) : null}

        {bootstrapErrors.length ? (
          <div className="mb-4 space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
            <p className="font-semibold uppercase tracking-wide">
              Some decks failed to import
            </p>
            <ul className="space-y-0.5">
              {bootstrapErrors.slice(0, 3).map(({ deckId, error }) => (
                <li key={deckId}>
                  {deckId}: {error}
                </li>
              ))}
            </ul>
            {bootstrapErrors.length > 3 ? (
              <p>…and {bootstrapErrors.length - 3} more.</p>
            ) : null}
          </div>
        ) : null}

        <Outlet />
      </main>
      {hideFooter ? null : <Footer />}
    </div>
  );
}

export default AppShell;

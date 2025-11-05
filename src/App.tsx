import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import ImportExportPage from "./routes/import";
import ReviewPage from "./routes/review";

const navLinkClasses =
  "inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold transition";

const activeClasses = "bg-blue-600 text-white shadow";
const inactiveClasses = "text-slate-300 hover:text-white hover:bg-slate-800/80";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-white">
                Mamanxue
              </span>
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Phase 1
              </span>
            </div>
            <nav className="flex items-center gap-2">
              <NavLink
                to="/review"
                end
                className={({ isActive }) =>
                  `${navLinkClasses} ${
                    isActive ? activeClasses : inactiveClasses
                  }`
                }
              >
                Review
              </NavLink>
              <NavLink
                to="/import"
                className={({ isActive }) =>
                  `${navLinkClasses} ${
                    isActive ? activeClasses : inactiveClasses
                  }`
                }
              >
                Import / Export
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-16">
          <Routes>
            <Route path="/" element={<Navigate to="/review" replace />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/import" element={<ImportExportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;

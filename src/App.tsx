import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./AppShell";
import CardBrowserPage from "./routes/browser";
import HomePage from "./routes/home";
import { ImportExportPage } from "./routes/import";
import ReviewPage from "./routes/review";
import SettingsPage from "./routes/settings";
import StatsPage from "./routes/stats";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<AppShell hideFooter />}>
          <Route path="review" element={<ReviewPage />} />
          <Route path="browser" element={<CardBrowserPage />} />
        </Route>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="import" element={<ImportExportPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

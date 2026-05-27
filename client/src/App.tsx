import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { CalendarView } from "./views/CalendarView";
import { WorldsView } from "./views/WorldsView";
import { FavoritesView } from "./views/FavoritesView";
import { RankingView } from "./views/RankingView";
import { SettingsView } from "./views/SettingsView";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/worlds" element={<WorldsView />} />
        <Route path="/favorites" element={<FavoritesView />} />
        <Route path="/ranking" element={<RankingView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Route>
    </Routes>
  );
}

export default App;

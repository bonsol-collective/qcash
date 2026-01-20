import { Loader2 } from "lucide-react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { useWallet } from "./context/WalletContext";
import Dashboard from "./pages/Dashboard";
import IdentityReveal from "./pages/IdentityReveal";
import SeedGeneration from "./pages/SeedGeneration";
import Welcome from "./pages/Welcome";

const AppRouter = () => {
  const { wallet, isLoading } = useWallet();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={wallet ? <Navigate to="/dashboard" /> : <Welcome />}
      />
      <Route path="/seed" element={<SeedGeneration />} />
      <Route path="/reveal" element={<IdentityReveal />} />
      <Route
        path="/dashboard"
        element={wallet ? <Dashboard /> : <Navigate to="/" />}
      />
    </Routes>
  );
};

function App() {
  return (
    <MemoryRouter>
      <div className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-cyan-500/30">
        <AppRouter />
      </div>
    </MemoryRouter>
  );
}

export default App;

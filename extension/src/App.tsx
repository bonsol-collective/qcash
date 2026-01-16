import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Welcome from './pages/Welcome';
import SeedGeneration from './pages/SeedGeneration';
import IdentityReveal from './pages/IdentityReveal';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <MemoryRouter>
      <div className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-cyan-500/30">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/seed" element={<SeedGeneration />} />
          <Route path="/reveal" element={<IdentityReveal />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </MemoryRouter>
  );
}

export default App;

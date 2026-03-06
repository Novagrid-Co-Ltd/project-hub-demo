import { Routes, Route, Navigate, Link } from "react-router-dom";
import ProjectList from "./pages/ProjectList";
import ProjectNew from "./pages/ProjectNew";
import ProjectDetail from "./pages/ProjectDetail";

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-corp text-white px-6 py-3">
        <Link
          to="/projects"
          className="text-xl font-bold text-white no-underline"
        >
          PJ Hub
        </Link>
      </header>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/projects/new" element={<ProjectNew />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  Outlet,
} from "react-router-dom";
import Sidebar from "./components/sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/dashboard.jsx";
import TimeTracking from "./pages/Timetracking.jsx";
import Employees from "./pages/Employees.jsx";
import Documents from "./pages/Documents.jsx";
import TaskManagement from "./pages/TaskManagement.jsx";
import Header from "./components/Header.jsx";
import AllTasks from "./pages/AllTasks.jsx";
import Workspace from "./pages/Workspace.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Boards from "./pages/Boards.jsx";
import NotFound from "./pages/NotFound.jsx";
import Board from "./pages/Board.jsx";

function AppLayout() {
  return (
    <div className="flex min-h-screen ">
      <Sidebar />
      <main className="relative flex-1 max-h-screen overflow-y-auto">
        <Header />

        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/time-tracking" element={<TimeTracking />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/tasks" element={<TaskManagement />} />
          <Route path="/tasks/all-tasks" element={<AllTasks />} />
          <Route path="/tasks/workspace" element={<Workspace />} />
          <Route path="/tasks/boards" element={<Boards />} />\
          <Route path="/tasks/boards/:boardId" element={<Board />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;

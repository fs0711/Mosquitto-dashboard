import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Listeners from "./pages/Listeners";
import Topics from "./pages/Topics";
import Logs from "./pages/Logs";
import Users from "./pages/Users";
import ACL from "./pages/ACL";
import TLS from "./pages/TLS";
import Config from "./pages/Config";
import UserManagement from "./pages/UserManagement";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="listeners" element={<Listeners />} />
            <Route path="topics" element={<Topics />} />
            <Route path="logs" element={<Logs />} />
            <Route path="users" element={<Users />} />
            <Route path="acl" element={<ACL />} />
            <Route path="tls" element={<TLS />} />
            <Route path="config" element={<Config />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Listeners from "./pages/Listeners";
import Topics from "./pages/Topics";
import Logs from "./pages/Logs";
import Users from "./pages/Users";
import ACL from "./pages/ACL";
import TLS from "./pages/TLS";
import Config from "./pages/Config";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="listeners" element={<Listeners />} />
          <Route path="topics" element={<Topics />} />
          <Route path="logs" element={<Logs />} />
          <Route path="users" element={<Users />} />
          <Route path="acl" element={<ACL />} />
          <Route path="tls" element={<TLS />} />
          <Route path="config" element={<Config />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

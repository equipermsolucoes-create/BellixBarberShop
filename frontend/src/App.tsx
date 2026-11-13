import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import ShopPage from "@/pages/ShopPage";
import Booking from "@/pages/Booking";
import ClientHub from "@/pages/ClientHub";
import Panel from "@/pages/Panel";
import Super from "@/pages/Super";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/b/:slug" element={<ShopPage />} />
        <Route path="/b/:slug/agendar" element={<Booking />} />
        <Route path="/b/:slug/cliente" element={<ClientHub />} />
        <Route path="/painel" element={<Panel />} />
        <Route path="/super" element={<Super />} />
        <Route path="*" element={<Landing />} />
      </Routes>
      <Toaster richColors theme="dark" position="top-center" />
    </>
  );
}

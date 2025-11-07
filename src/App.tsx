import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner"; // Mantendo os imports originais
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// --- NOSSAS MUDANÇAS ---
// 1. Corrigindo os caminhos, assumindo que App.tsx está na pasta raiz (e não em 'src')
import { Header } from "./components/Header"; 
import { Hero } from "./components/Hero"; 
import Kiosk from "./pages/Kiosk";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
// ------------------------

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Header /> {/* 2. Adiciona o Header aqui para que apareça em todas as páginas */}
        <Routes>
          {/* 3. Define o Hero como a rota principal */}
          <Route path="/" element={<Hero />} /> {/* 4. ADICIONADO: Rota principal para o Hero */}
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
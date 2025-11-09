import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// --- Importação dos Componentes e Páginas ---

// Páginas principais
import { Hero } from "@/components/Hero"; // A sua página Hero
import Kiosk from "@/pages/Kiosk";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";
import { Header } from "@/components/Header"; // O seu Header real

// Componentes de Autenticação
import { AuthProvider, ProtectedRoute } from "@/components/Auth";
import Login from "./pages/Login"; // Corrigido para o caminho relativo
import Register from "@/pages/Register"; // Importa a página de Registo

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* O AuthProvider "embrulha" a aplicação */}
        <AuthProvider>
          {/* O Header fica fora das Rotas para aparecer em todas as páginas */}
          <Header />
          <Routes>
            {/* --- Rotas Públicas --- */}
            <Route path="/" element={<Hero />} />
            <Route path="/kiosk" element={<Kiosk />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} /> {/* Adiciona a rota de Registo */}

            {/* --- Rota Protegida --- */}
            {/* A rota /dashboard está "trancada" pela ProtectedRoute */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* --- Rota Catch-All (Não Encontrado) --- */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
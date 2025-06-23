import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ProtectedRoute } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { setupAPIInterceptor } from "@/utils/apiInterceptor";
import AuthSystem from "@/components/AuthSystem";
import Home from "@/pages/Home"; // ✅ NOVA PÁGINA INICIAL
import DashboardsPage from "@/pages/Dashboards";
import NotFound from "./pages/NotFound";
import AdminUserControl from '@/pages/AdminUserControl';
import ConfigurarConta from '@/pages/ConfigurarConta';

const queryClient = new QueryClient();

// ✅ Componente wrapper para proteger página de dashboards
const DashboardsPageProtected = () => {
  const { user } = useAuth();
  
  // Verificar se é coordenador ou admin
  if (user?.tipo_usuario === 'usuario') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚫 Acesso Restrito</h1>
          <p className="text-gray-600 mb-4">
            A página de dashboards é exclusiva para coordenadores e administradores.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Voltar para Home
          </button>
        </div>
      </div>
    );
  }
  
  return <DashboardsPage />;
};

const AppContent = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthSystem />;
  }

  return (
    <DashboardProvider>
      <Routes>
        {/* ✅ PÁGINA INICIAL - Dashboard Principal */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        
        {/* ✅ PÁGINA DE DASHBOARDS - Controle manual por tipo de usuário */}
        <Route 
          path="/dashboards" 
          element={
            <ProtectedRoute>
              <DashboardsPageProtected />
            </ProtectedRoute>
          } 
        />
        
        {/* ROTAS ADMINISTRATIVAS - Só acessíveis para admins */}
        <Route 
          path="/admin/usuarios" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminUserControl />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/settings" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8">
                  <h1 className="text-2xl font-bold text-gray-800 mb-4">🚧 Em Desenvolvimento</h1>
                  <p className="text-gray-600">Configurações do Sistema em breve...</p>
                </div>
              </div>
            </ProtectedRoute>
          } 
        />

        {/* REDIRECIONAMENTOS */}
        <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        
        {/* 404 - NOT FOUND */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardProvider>
  );
};

const App = () => {
  // Configurar interceptor de API ao inicializar
  React.useEffect(() => {
    setupAPIInterceptor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* ROTA PÚBLICA - Configurar Conta (não precisa de autenticação) */}
              <Route path="/configurar-conta/:token" element={<ConfigurarConta />} />
              
              {/* TODAS AS OUTRAS ROTAS (autenticadas) */}
              <Route path="/*" element={<AppContent />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
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
import DashboardsPage from "@/pages/Dashboards";
import NotFound from "./pages/NotFound";
import AdminUserControl from '@/pages/AdminUserControl';

const queryClient = new QueryClient();

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
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <DashboardsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboards" 
          element={
            <ProtectedRoute>
              <DashboardsPage />
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
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
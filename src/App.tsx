import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth, ProtectedRoute } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { setupAPIInterceptor } from "@/utils/apiInterceptor";
import LoginForm from "@/components/LoginForm";
import DashboardsPage from "@/pages/Dashboards";
import NotFound from "./pages/NotFound";

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
    return <LoginForm />;
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
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, ProtectedRoute } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { PDFProvider } from "@/contexts/PDFContext";
import { setupAPIInterceptor } from "@/utils/apiInterceptor";
import AuthSystem from "@/components/AuthSystem";
import Home from "@/pages/Home";
import DashboardsPage from "@/pages/Dashboards";
import DocumentsPage from "@/pages/Documents";
import NotFound from "./pages/NotFound";
import AdminUserControl from '@/pages/AdminUserControl';
import EmailsProcessos from '@/pages/EmailsProcessos';
import ConfiguracoesPessoais from '@/pages/ConfiguracoesPessoais';
import Organograma from '@/pages/Organograma';
import { useDashboard } from "@/contexts/DashboardContext";

const queryClient = new QueryClient();

// Componente wrapper para proteger página de dashboards
const DashboardsPageProtected = () => {
  const { user } = useAuth();
  const { dashboards, getFilteredDashboards } = useDashboard();
  
  // Verificar quantos dashboards o usuário pode ver
  const dashboardsVisiveis = getFilteredDashboards({});
  
  if (dashboardsVisiveis.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚫 Acesso Restrito</h1>
          <p className="text-gray-600 mb-4">
            Você não tem permissão para visualizar nenhum dashboard.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            {user?.is_coordenador 
              ? 'Não há dashboards disponíveis para o seu setor.'
              : 'A página de dashboards é exclusiva para coordenadores e administradores.'}
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

// ✅ NOVO: Componente wrapper para proteger página de emails
const EmailsProcessosProtected = () => {
  const { user } = useAuth();
  
  // Verificar se é admin ou do setor de protocolo
  const temAcesso = user?.tipo_usuario === 'admin' || user?.setor?.toLowerCase().includes('protocolo');
  
  if (!temAcesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚫 Acesso Restrito</h1>
          <p className="text-gray-600 mb-4">
            Você não tem permissão para acessar a página de emails e processos.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Esta página é exclusiva para administradores e usuários do setor de Protocolo.
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
  
  return <EmailsProcessos />;
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
      <PDFProvider>
        <Routes>
          {/* PÁGINA INICIAL - Dashboard Principal */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          
          {/* PÁGINA DE DASHBOARDS - Controle manual por tipo de usuário */}
          <Route 
            path="/dashboards" 
            element={
              <ProtectedRoute>
                <DashboardsPageProtected />
              </ProtectedRoute>
            } 
          />
          
          {/* DOCUMENTOS - Todos podem ver */}
          <Route 
            path="/documentos" 
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            } 
          />
          
          {/* ✅ EMAILS - SÓ PROTOCOLO E ADMINS */}
          <Route 
            path="/emails-processos" 
            element={
              <ProtectedRoute>
                <EmailsProcessosProtected />
              </ProtectedRoute>
            } 
          />
          
          {/* ORGANOGRAMA - Todos podem ver - ADICIONAR QUANDO FOR MEXER COM ORGANOGRAMA*/}
          {/* <Route 
            path="/organograma" 
            element={
              <ProtectedRoute>
                <Organograma />
              </ProtectedRoute>
            } 
          /> */}
          
          {/* ROTAS ADMINISTRATIVAS - SÓ ADMINS */}
          <Route 
            path="/admin/usuarios" 
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminUserControl />
              </ProtectedRoute>
            } 
          />
          
          {/* CONFIGURAÇÕES DO SISTEMA */}
          <Route 
            path="/configuracoes" 
            element={
              <ProtectedRoute>
                <ConfiguracoesPessoais />
              </ProtectedRoute>
            } 
          />
          
          {/* REDIRECIONAMENTOS */}
          <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
          <Route path="/admin/emails" element={<Navigate to="/emails-processos" replace />} />
          <Route path="/admin/emails-processos" element={<Navigate to="/emails-processos" replace />} />
          <Route path="/controle-emails" element={<Navigate to="/emails-processos" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/pdfs" element={<Navigate to="/documentos" replace />} />
          <Route path="/arquivos" element={<Navigate to="/documentos" replace />} />
          <Route path="/documents" element={<Navigate to="/documentos" replace />} />
          
          {/* 404 - NOT FOUND */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PDFProvider>
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
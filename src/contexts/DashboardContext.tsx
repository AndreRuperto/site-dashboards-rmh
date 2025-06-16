/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

// Interface corrigida baseada no schema do banco
export interface Dashboard {
  id: string;
  titulo: string;
  descricao?: string;
  setor: string;  // no banco é 'setor', não 'category'/'department'
  url_iframe: string;
  ativo: boolean;
  largura?: number;
  altura?: number;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

interface DashboardContextType {
  dashboards: Dashboard[];
  setores: string[];  // mudei de 'categories' para 'setores'
  isLoading: boolean;
  error: string | null;
  addDashboard: (dashboard: Omit<Dashboard, 'id' | 'criado_em' | 'atualizado_em'>) => Promise<void>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  getFilteredDashboards: (setor?: string) => Dashboard[];
  refreshDashboards: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rmh.up.railway.app'
  : 'http://localhost:3001'

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar dashboards da API
  const fetchDashboards = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await fetch(`${API_BASE_URL}/api/dashboards`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar dashboards');
      }

      const data = await response.json();
      setDashboards(data.dashboards || []);
    } catch (err) {
      console.error('Erro ao buscar dashboards:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      // Fallback para dados mock em caso de erro
      setDashboards([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dashboards ao inicializar
  useEffect(() => {
    fetchDashboards();
  }, []);

  // Extrair setores únicos dos dashboards
  const setores = Array.from(new Set(dashboards.map(d => d.setor)));

  const addDashboard = async (newDashboard: Omit<Dashboard, 'id' | 'criado_em' | 'atualizado_em'>) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE_URL}/api/dashboards`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newDashboard)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar dashboard');
      }

      // Recarregar dashboards após criar
      await fetchDashboards();
    } catch (error) {
      console.error('Erro ao adicionar dashboard:', error);
      throw error;
    }
  };

  const updateDashboard = async (id: string, updates: Partial<Dashboard>) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE_URL}/api/dashboards/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao atualizar dashboard');
      }

      // Recarregar dashboards após atualizar
      await fetchDashboards();
    } catch (error) {
      console.error('Erro ao atualizar dashboard:', error);
      throw error;
    }
  };

  const deleteDashboard = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Token não encontrado');

      const response = await fetch(`${API_BASE_URL}/api/dashboards/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao deletar dashboard');
      }

      // Recarregar dashboards após deletar
      await fetchDashboards();
    } catch (error) {
      console.error('Erro ao deletar dashboard:', error);
      throw error;
    }
  };

  const getFilteredDashboards = (setor?: string) => {
    return dashboards.filter(dashboard => {
      if (!dashboard.ativo) return false;
      if (setor && dashboard.setor !== setor) return false;
      return true;
    });
  };

  const refreshDashboards = async () => {
    await fetchDashboards();
  };

  return (
    <DashboardContext.Provider value={{
      dashboards,
      setores,
      isLoading,
      error,
      addDashboard,
      updateDashboard,
      deleteDashboard,
      getFilteredDashboards,
      refreshDashboards
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboards = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboards must be used within a DashboardProvider');
  }
  return context;
};
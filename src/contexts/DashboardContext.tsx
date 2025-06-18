// src/contexts/DashboardContext.tsx - VERSÃO MELHORADA
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

// Interface corrigida baseada no schema do banco
export interface Dashboard {
  id: string;
  titulo: string;
  descricao?: string;
  setor: string;
  url_iframe: string;
  ativo: boolean;
  largura?: number;
  altura?: number;
  criado_por: string;
  criado_por_nome?: string; // Nome do criador
  criado_em: string;
  atualizado_em: string;
}

// Interface para filtros avançados
export interface DashboardFilters {
  setor?: string;
  periodo?: string;
  criador?: string;
  searchTerm?: string;
}

interface DashboardContextType {
  dashboards: Dashboard[];
  setores: string[];
  isLoading: boolean;
  error: string | null;
  addDashboard: (dashboard: Omit<Dashboard, 'id' | 'criado_em' | 'atualizado_em'>) => Promise<void>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  getFilteredDashboards: (filters: DashboardFilters) => Dashboard[];
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

  // Função de filtro avançada
  const getFilteredDashboards = (filters: DashboardFilters): Dashboard[] => {
    let filtered = [...dashboards];

    // Filtro por setor
    if (filters.setor && filters.setor !== 'all') {
      filtered = filtered.filter(d => d.setor === filters.setor);
    }

    // Filtro por termo de busca
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(d => 
        d.titulo.toLowerCase().includes(term) ||
        (d.descricao && d.descricao.toLowerCase().includes(term)) ||
        d.setor.toLowerCase().includes(term)
      );
    }

    // Filtro por período de criação
    if (filters.periodo && filters.periodo !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (filters.periodo) {
        case 'ultima_semana':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'ultimo_mes':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'ultimos_3_meses':
          filterDate.setMonth(now.getMonth() - 3);
          break;
        case 'ultimo_ano':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }

      if (filters.periodo !== 'all') {
        filtered = filtered.filter(d => new Date(d.criado_em) >= filterDate);
      }
    }

    // Filtro por criador
    if (filters.criador && filters.criador !== 'all') {
      filtered = filtered.filter(d => d.criado_por_nome === filters.criador);
    }

    return filtered;
  };

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

      await fetchDashboards();
    } catch (error) {
      console.error('Erro ao deletar dashboard:', error);
      throw error;
    }
  };

  const value: DashboardContextType = {
    dashboards,
    setores,
    isLoading,
    error,
    addDashboard,
    updateDashboard,
    deleteDashboard,
    getFilteredDashboards,
    refreshDashboards: fetchDashboards
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard deve ser usado dentro de um DashboardProvider');
  }
  return context;
};
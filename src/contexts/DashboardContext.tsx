// src/contexts/DashboardContext.tsx - VERSÃO SINCRONIZADA COM O BANCO
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

// ✅ Interface atualizada com o schema real do banco de dados
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
  criado_por_nome?: string;
  criado_em: string;
  atualizado_em: string;
  
  // ✅ Campos que existem no banco de dados
  tipo_visibilidade?: string; // 'geral', 'restrito', etc.
  powerbi_report_id?: string;
  powerbi_group_id?: string;
  powerbi_workspace_id?: string; // Se estiver sendo usado
  embed_type?: 'public' | 'secure';
}

// Interface para filtros avançados
export interface DashboardFilters {
  setor?: string;
  periodo?: string;
  criador?: string;
  searchTerm?: string;
  embedType?: 'all' | 'public' | 'secure';
  tipoVisibilidade?: string;
}

// ✅ Interface para status do Power BI
export interface PowerBIStatus {
  configured: boolean;
  serviceStatus: 'online' | 'error' | 'not_configured' | 'unknown';
  embedSupported: boolean;
  timestamp: string;
}

// ✅ Interface para token de embed
export interface PowerBIEmbedToken {
  accessToken: string;
  tokenType: string;
  expiration: string;
  reportId: string;
  groupId: string;
  embedUrl: string;
  generatedAt: string;
  validFor: number;
  user?: {
    id: string;
    nome: string;
    setor: string;
  };
  dashboard?: {
    id: string;
    titulo: string;
    setor: string;
  };
}

interface DashboardContextType {
  dashboards: Dashboard[];
  setores: string[];
  isLoading: boolean;
  error: string | null;
  powerbiStatus: PowerBIStatus | null;
  
  // CRUD Operations
  addDashboard: (dashboard: Omit<Dashboard, 'id' | 'criado_em' | 'atualizado_em'>) => Promise<void>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  
  // Filtering & Search
  getFilteredDashboards: (filters: DashboardFilters) => Dashboard[];
  refreshDashboards: () => Promise<void>;
  
  // ✅ Power BI específicas
  checkPowerBIStatus: () => Promise<void>;
  getEmbedToken: (dashboardId: string) => Promise<PowerBIEmbedToken>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Configuração da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [powerbiStatus, setPowerbiStatus] = useState<PowerBIStatus | null>(null);

  // ✅ Função para buscar dashboards da API
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
      
      console.log(`📊 ${data.dashboards?.length || 0} dashboards carregados`);
      
    } catch (err) {
      console.error('Erro ao buscar dashboards:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setDashboards([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Função para verificar status do Power BI
  const checkPowerBIStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/powerbi/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const status = await response.json();
        setPowerbiStatus(status);
        console.log('🔐 Status Power BI:', status.serviceStatus);
      }
    } catch (err) {
      console.warn('⚠️ Não foi possível verificar status do Power BI:', err);
      setPowerbiStatus({
        configured: false,
        serviceStatus: 'error',
        embedSupported: false,
        timestamp: new Date().toISOString()
      });
    }
  };

  // ✅ Função para obter token de embed
  const getEmbedToken = async (dashboardId: string): Promise<PowerBIEmbedToken> => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Token não encontrado');

      const dashboard = dashboards.find(d => d.id === dashboardId);
      if (!dashboard) throw new Error('Dashboard não encontrado');

      const response = await fetch(`${API_BASE_URL}/api/powerbi/embed-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dashboardId: dashboard.id,
          reportId: dashboard.powerbi_report_id,
          groupId: dashboard.powerbi_group_id,
          workspaceId: dashboard.powerbi_workspace_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao obter token de embed');
      }

      const tokenData = await response.json();
      console.log('✅ Token de embed obtido para dashboard:', dashboard.titulo);
      return tokenData;
      
    } catch (error) {
      console.error('❌ Erro ao obter token de embed:', error);
      throw error;
    }
  };

  // Carregar dados ao inicializar
  useEffect(() => {
    fetchDashboards();
    checkPowerBIStatus();
  }, []);

  // ✅ Extrair setores únicos dos dashboards
  const setores = Array.from(new Set(dashboards.map(d => d.setor))).sort();

  // ✅ Função de filtro avançada (atualizada com tipo_visibilidade)
  const getFilteredDashboards = (filters: DashboardFilters): Dashboard[] => {
    let filtered = [...dashboards];

    // Filtro por setor
    if (filters.setor && filters.setor !== 'all') {
      filtered = filtered.filter(d => d.setor === filters.setor);
    }

    // Filtro por tipo de embed
    if (filters.embedType && filters.embedType !== 'all') {
      if (filters.embedType === 'secure') {
        filtered = filtered.filter(d => d.powerbi_report_id && d.powerbi_group_id);
      } else if (filters.embedType === 'public') {
        filtered = filtered.filter(d => !d.powerbi_report_id);
      }
    }

    // ✅ Novo filtro por tipo de visibilidade
    if (filters.tipoVisibilidade && filters.tipoVisibilidade !== 'all') {
      filtered = filtered.filter(d => d.tipo_visibilidade === filters.tipoVisibilidade);
    }

    // Filtro por termo de busca
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(d => 
        d.titulo.toLowerCase().includes(term) ||
        (d.descricao && d.descricao.toLowerCase().includes(term)) ||
        d.setor.toLowerCase().includes(term) ||
        (d.criado_por_nome && d.criado_por_nome.toLowerCase().includes(term)) ||
        (d.tipo_visibilidade && d.tipo_visibilidade.toLowerCase().includes(term))
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

  // ✅ Função para adicionar dashboard
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

      const result = await response.json();
      console.log('✅ Dashboard criado:', result.dashboard?.titulo);
      
      await fetchDashboards();
    } catch (error) {
      console.error('❌ Erro ao adicionar dashboard:', error);
      throw error;
    }
  };

  // ✅ Função para atualizar dashboard
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

      const result = await response.json();
      console.log('✅ Dashboard atualizado:', result.dashboard?.titulo);
      
      await fetchDashboards();
    } catch (error) {
      console.error('❌ Erro ao atualizar dashboard:', error);
      throw error;
    }
  };

  // ✅ Função para deletar dashboard
  const deleteDashboard = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Token não encontrado');

      const dashboard = dashboards.find(d => d.id === id);
      const dashboardName = dashboard?.titulo || id;

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

      console.log('🗑️ Dashboard deletado:', dashboardName);
      await fetchDashboards();
    } catch (error) {
      console.error('❌ Erro ao deletar dashboard:', error);
      throw error;
    }
  };

  // ✅ Estatísticas dos dashboards (função auxiliar)
  const getDashboardStats = () => {
    const total = dashboards.length;
    const ativos = dashboards.filter(d => d.ativo).length;
    const comEmbedSeguro = dashboards.filter(d => d.powerbi_report_id).length;
    const porSetor = setores.reduce((acc, setor) => {
      acc[setor] = dashboards.filter(d => d.setor === setor).length;
      return acc;
    }, {} as Record<string, number>);

    // ✅ Estatísticas por tipo de visibilidade
    const tiposVisibilidade = Array.from(new Set(dashboards.map(d => d.tipo_visibilidade).filter(Boolean)));
    const porTipoVisibilidade = tiposVisibilidade.reduce((acc, tipo) => {
      acc[tipo] = dashboards.filter(d => d.tipo_visibilidade === tipo).length;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      ativos,
      inativos: total - ativos,
      comEmbedSeguro,
      publicos: total - comEmbedSeguro,
      porSetor,
      porTipoVisibilidade
    };
  };

  const value: DashboardContextType = {
    dashboards,
    setores,
    isLoading,
    error,
    powerbiStatus,
    addDashboard,
    updateDashboard,
    deleteDashboard,
    getFilteredDashboards,
    refreshDashboards: fetchDashboards,
    checkPowerBIStatus,
    getEmbedToken
  };

  // ✅ Log de estatísticas para debug
  useEffect(() => {
    if (dashboards.length > 0) {
      const stats = getDashboardStats();
      console.log('📈 Estatísticas dos dashboards:', stats);
    }
  }, [dashboards]);

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

// ✅ Hook personalizado para estatísticas (atualizado)
export const useDashboardStats = () => {
  const { dashboards, setores } = useDashboard();
  
  return React.useMemo(() => {
    const total = dashboards.length;
    const ativos = dashboards.filter(d => d.ativo).length;
    const comEmbedSeguro = dashboards.filter(d => d.powerbi_report_id).length;
    const porSetor = setores.reduce((acc, setor) => {
      acc[setor] = dashboards.filter(d => d.setor === setor).length;
      return acc;
    }, {} as Record<string, number>);

    // ✅ Estatísticas por tipo de visibilidade
    const tiposVisibilidade = Array.from(new Set(dashboards.map(d => d.tipo_visibilidade).filter(Boolean)));
    const porTipoVisibilidade = tiposVisibilidade.reduce((acc, tipo) => {
      acc[tipo] = dashboards.filter(d => d.tipo_visibilidade === tipo).length;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      ativos,
      inativos: total - ativos,
      comEmbedSeguro,
      publicos: total - comEmbedSeguro,
      porSetor,
      porTipoVisibilidade,
      percentualSeguro: total > 0 ? Math.round((comEmbedSeguro / total) * 100) : 0
    };
  }, [dashboards, setores]);
};
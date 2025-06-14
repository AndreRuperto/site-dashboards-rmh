// src/services/api.ts - Serviços de API separados

import type { User, Dashboard, RegisterRequest } from '@/types';

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://site-api-rmh-up.railway.app'
  : 'http://localhost:3001';

// Hook para requisições autenticadas
export const useAuthenticatedFetch = () => {
  const makeRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('authToken');
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_BASE_URL}${url}`, defaultOptions);
    
    // Se token expirou, fazer logout automático
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Sessão expirada');
    }

    return response;
  };

  return { makeRequest };
};

// Serviço de API para operações comuns
export const authAPI = {
  // Buscar perfil do usuário
  async getProfile(): Promise<User> {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Token não encontrado');

    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar perfil');
    }

    const data = await response.json();
    return data.user;
  },

  // Registrar novo usuário
  async register(userData: RegisterRequest): Promise<{ message: string; user: User }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro no registro');
    }

    return data;
  },

  // Verificar email
  async verifyEmail(token: string, email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro na verificação');
    }

    return data;
  }
};

// Serviço de API para dashboards
export const dashboardAPI = {
  // Buscar dashboards
  async getDashboards(): Promise<Dashboard[]> {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Token não encontrado');

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
    return data.dashboards;
  },

  // Criar dashboard
  async createDashboard(dashboardData: {
    titulo: string;
    descricao?: string;
    setor: string;
    url_iframe: string;
    largura?: number;
    altura?: number;
  }): Promise<Dashboard> {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('Token não encontrado');

    const response = await fetch(`${API_BASE_URL}/api/dashboards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dashboardData)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao criar dashboard');
    }

    const data = await response.json();
    return data.dashboard;
  },

  // Atualizar dashboard
  async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard> {
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

    const data = await response.json();
    return data.dashboard;
  },

  // Deletar dashboard
  async deleteDashboard(id: string): Promise<void> {
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
  }
};
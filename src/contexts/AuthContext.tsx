// contexts/AuthContext.tsx - Versão atualizada para API real
import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'usuario' | 'admin';

export interface User {
  id: string;
  nome: string;
  email: string;
  departamento: string;
  tipo_usuario: UserRole;
  criado_em?: string;
  ultimo_login?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://site-api-rmh-up.railway.app' // Trocar pela sua URL real do Railway
  : 'http://localhost:3001';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar se há token salvo ao inicializar
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        if (token) {
          // Verificar se o token ainda é válido buscando o perfil
          const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            // Token inválido, limpar storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        // Limpar dados em caso de erro
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          senha: password // API espera 'senha'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Tratar diferentes tipos de erro
        if (response.status === 401) {
          if (data.error.includes('não verificado')) {
            throw new Error('Email não verificado. Verifique sua caixa de entrada.');
          } else {
            throw new Error('Email ou senha incorretos.');
          }
        }
        throw new Error(data.error || 'Erro no login');
      }

      // Login bem-sucedido
      const { token, user: userData } = data;
      
      // Salvar token e dados do usuário
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Atualizar estado
      setUser(userData);
      
      return true;

    } catch (error) {
      console.error('Erro no login:', error);
      throw error; // Re-throw para o componente tratar
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Limpar tokens e dados
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

// Hook para requisições autenticadas
export const useAuthenticatedFetch = () => {
  const makeRequest = async (url: string, options: RequestInit = {}) => {
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
  async register(userData: {
    nome: string;
    email: string;
    senha: string;
    departamento: string;
  }): Promise<{ message: string; user: User }> {
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
  },

  // Buscar dashboards (exemplo de uso autenticado)
  async getDashboards(): Promise<any[]> {
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
  }
};

// Componente de rota protegida
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

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
    // Salvar a página que o usuário tentava acessar
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.tipo_usuario !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">🚫 Acesso Negado</h1>
          <p className="text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Interceptor para requisições (intercepta 401 e faz logout automático)
export const setupAPIInterceptor = () => {
  // Interceptar fetch global para tratar 401
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    
    // Se receber 401 em qualquer requisição, fazer logout
    if (response.status === 401 && response.url.includes(API_BASE_URL)) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      // Só redirecionar se não estiver já na página de login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    return response;
  };
};

// Hook para verificação de permissões
export const usePermissions = () => {
  const { user } = useAuth();
  
  const isAdmin = user?.tipo_usuario === 'admin';
  const canEditDashboard = (createdBy: string) => isAdmin || user?.id === createdBy;
  const canDeleteDashboard = (createdBy: string) => isAdmin || user?.id === createdBy;
  
  return {
    isAdmin,
    canEditDashboard,
    canDeleteDashboard,
    user
  };
};
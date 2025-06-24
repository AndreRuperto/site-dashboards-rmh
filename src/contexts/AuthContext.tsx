/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuração da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
            console.log('✅ AUTH: Dados do usuário carregados:', data.user);
            setUser(data.user);
          } else {
            // Token inválido, limpar storage
            console.log('❌ AUTH: Token inválido, limpando storage');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
          }
        }
      } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
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
      console.log('🔑 AUTH: Tentativa de login para:', email);
      
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
          if (data.error && data.error.includes('não verificado')) {
            throw new Error('Email não verificado. Verifique sua caixa de entrada.');
          } else {
            throw new Error('Email ou senha incorretos.');
          }
        }
        throw new Error(data.error || 'Erro no login');
      }

      // Login bem-sucedido
      const { token, user: userData } = data;
      
      console.log('✅ AUTH: Login bem-sucedido, dados do usuário:', userData);
      
      // Salvar token e dados do usuário
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Atualizar estado
      setUser(userData);
      
      return true;

    } catch (error) {
      console.error('❌ Erro no login:', error);
      throw error; // Re-throw para o componente tratar
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('👋 AUTH: Fazendo logout');
    
    // Limpar tokens e dados
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    
    // Redirecionar para login
    window.location.href = '/';
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

// Componente de rota protegida
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

// Hook para verificação de permissões
export const usePermissions = () => {
  const { user } = useAuth();
  
  const isAdmin = user?.tipo_usuario === 'admin';
  const isCoordenador = user?.is_coordenador || false;
  const canEditDashboard = (createdBy: string) => isAdmin || user?.id === createdBy;
  const canDeleteDashboard = (createdBy: string) => isAdmin || user?.id === createdBy;
  
  return {
    isAdmin,
    isCoordenador,
    canEditDashboard,
    canDeleteDashboard,
    user
  };
};
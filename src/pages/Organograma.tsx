import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OrganogramaTree from '@/components/organograma/OrganogramaTree';


// Configurações da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Usuario {
  id: string;
  nome: string;
  setor: string;
  cargo: string;
  sub_setor?: string;
  email: string;
  telefone?: string;
  status: string;
  tipo_usuario: 'usuario' | 'admin';
  tipo_colaborador: 'estagiario_ma' | 'clt_associado';
  is_coordenador: boolean;
  ativo: boolean;
  email_verificado: boolean;
}


const Organograma: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { toast } = useToast();

  // Função para obter token de autenticação
  const getAuthToken = () => localStorage.getItem("authToken");

  // Função para fazer requisições autenticadas
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) throw new Error("Token não encontrado no localStorage");

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.href = "/";
      throw new Error("Token inválido ou expirado");
    }

    return response;
  };

  // Carregar dados dos colaboradores
  const carregarUsuarios = async () => {
    try {
        setCarregando(true);
        console.log('📊 Carregando dados da view vw_colaboradores...');
        
        const response = await fetchWithAuth(`${API_BASE_URL}/api/organograma/colaboradores`);
        
        if (!response.ok) {
        throw new Error("Erro ao carregar dados dos colaboradores");
        }

        const data = await response.json();
        
        const colaboradores = data.colaboradores || [];
        setUsuarios(colaboradores);
        
        console.log(`✅ ${colaboradores.length} colaboradores carregados da view vw_colaboradores`);
        
        toast({
        title: "Organograma atualizado!",
        description: `${colaboradores.length} colaboradores carregados`,
        });
    } catch (error) {
        console.error("❌ Erro ao carregar colaboradores:", error);
        toast({
        title: "Erro ao carregar dados",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive"
        });
    } finally {
        setCarregando(false);
    }
    };

  useEffect(() => {
    carregarUsuarios();
  }, []);


  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-6 py-8 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-8 w-8 animate-spin text-rmh-primary" />
              <span className="text-lg font-medium text-gray-700">Carregando organograma...</span>
            </div>
            <div className="text-sm text-gray-500">Buscando dados dos colaboradores</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-6 py-8" style={{
        fontFamily: 'Raleway, Segoe UI, sans-serif',
        paddingTop: '20px',
        paddingBottom: '40px'
      }}>
        {/* Container do Organograma */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          padding: '30px 20px',
          overflowX: 'auto',
          position: 'relative',
          minHeight: 'calc(100vh - 180px)'
        }}>
          {usuarios.length > 0 ? (
            <OrganogramaTree usuarios={usuarios} />
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>Nenhum colaborador encontrado</h3>
              <p style={{ marginBottom: '20px' }}>Carregue os dados para visualizar o organograma</p>
              <Button
                onClick={carregarUsuarios}
                style={{ 
                  backgroundColor: '#165A5D',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Carregar Dados
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Organograma;
// src/pages/AdminUserControl.tsx - CORRIGIDO
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Shield, 
  Clock, 
  Mail, 
  CheckCircle, 
  RefreshCw,
  UserCheck,
  UserX,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://rmh.up.railway.app'
  : 'http://localhost:3001';

interface Usuario {
  id: string;
  nome: string;
  email?: string;
  email_pessoal?: string;
  setor: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
  email_verificado: boolean;
  aprovado_admin?: boolean;
  criado_em: string;
  email_login: string;
  status: string;
  codigo_ativo?: boolean;
}

interface UsuariosStats {
  total: number;
  pendentes_aprovacao: number;
  nao_verificados: number;
}

const AdminUserControl: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsuariosStats>({
    total: 0,
    pendentes_aprovacao: 0,
    nao_verificados: 0
  });
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'corporativos' | 'estagiarios'>('pendentes');
  const { toast } = useToast();

  // Função para obter token corretamente
  const getAuthToken = (): string | null => {
    const token = localStorage.getItem('authToken');
    console.log('🔑 ADMIN: Token obtido do localStorage:', token ? `${token.substring(0, 20)}...` : 'NULO');
    return token;
  };

  // Função para fazer requisições com token
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getAuthToken();
    
    if (!token) {
      throw new Error('Token não encontrado no localStorage');
    }

    console.log('🌐 ADMIN: Fazendo requisição para:', url);
    console.log('🔑 ADMIN: Usando token:', `${token.substring(0, 20)}...`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    console.log('📡 ADMIN: Response status:', response.status);
    
    if (response.status === 401) {
      // Token inválido, limpar e redirecionar
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Token inválido ou expirado');
    }

    return response;
  };

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios-pendentes`);

      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }

      const data = await response.json();
      console.log('✅ ADMIN: Dados recebidos:', data);
      
      setUsuarios(data.usuarios);
      setStats({
        total: data.total,
        pendentes_aprovacao: data.pendentes_aprovacao,
        nao_verificados: data.nao_verificados
      });

    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de usuários",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const aprovarUsuario = async (userId: string, enviarCodigo: boolean = true) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/aprovar-usuario/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ enviar_codigo: enviarCodigo })
      });

      if (!response.ok) {
        throw new Error('Erro ao aprovar usuário');
      }

      const data = await response.json();
      
      toast({
        title: "✅ Usuário aprovado!",
        description: data.message,
        variant: "default"
      });

      fetchUsuarios(); // Recarregar lista

    } catch (error) {
      console.error('❌ Erro ao aprovar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aprovar o usuário",
        variant: "destructive"
      });
    }
  };

  const rejeitarUsuario = async (userId: string, nomeUsuario: string) => {
    if (!confirm(`Tem certeza que deseja REJEITAR o cadastro de ${nomeUsuario}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/rejeitar-usuario/${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erro ao rejeitar usuário');
      }

      const data = await response.json();
      
      toast({
        title: "❌ Cadastro rejeitado",
        description: data.message,
        variant: "destructive"
      });

      fetchUsuarios(); // Recarregar lista

    } catch (error) {
      console.error('❌ Erro ao rejeitar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível rejeitar o usuário",
        variant: "destructive"
      });
    }
  };

  const reenviarCodigo = async (userId: string) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/reenviar-codigo/${userId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Erro ao reenviar código');
      }

      const data = await response.json();
      
      toast({
        title: "📧 Código reenviado!",
        description: data.message,
        variant: "default"
      });

    } catch (error) {
      console.error('❌ Erro ao reenviar código:', error);
      toast({
        title: "Erro",
        description: "Não foi possível reenviar o código",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (usuario: Usuario) => {
    if (usuario.tipo_colaborador === 'clt_associado') {
      return (
        <Badge variant="default" className="bg-blue-600">
          <Shield className="h-3 w-3 mr-1" />
          CLT/Associado
        </Badge>
      );
    }

    if (usuario.status === 'pendente_aprovacao') {
      return (
        <Badge variant="destructive">
          <Clock className="h-3 w-3 mr-1" />
          Pendente Aprovação
        </Badge>
      );
    }

    if (usuario.aprovado_admin && !usuario.email_verificado) {
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-white">
          <Mail className="h-3 w-3 mr-1" />
          Aguardando Verificação
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="bg-green-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verificado
      </Badge>
    );
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    switch (filter) {
      case 'pendentes':
        return usuario.status === 'pendente_aprovacao';
      case 'corporativos':
        return usuario.tipo_colaborador === 'clt_associado';
      case 'estagiarios':
        return usuario.tipo_colaborador === 'estagiario';
      default:
        return true;
    }
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Carregando usuários...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Controle de Usuários</h1>
          <p className="text-gray-600">Gerencie cadastros e aprovações de usuários</p>
        </div>
        <Button onClick={fetchUsuarios} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pendentes Aprovação</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendentes_aprovacao}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Não Verificados</p>
                <p className="text-2xl font-bold text-red-600">{stats.nao_verificados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex space-x-2">
        <Button
          variant={filter === 'pendentes' ? 'default' : 'outline'}
          onClick={() => setFilter('pendentes')}
        >
          Pendentes ({stats.pendentes_aprovacao})
        </Button>
        <Button
          variant={filter === 'corporativos' ? 'default' : 'outline'}
          onClick={() => setFilter('corporativos')}
        >
          CLT/Associados
        </Button>
        <Button
          variant={filter === 'estagiarios' ? 'default' : 'outline'}
          onClick={() => setFilter('estagiarios')}
        >
          Estagiários
        </Button>
        <Button
          variant={filter === 'todos' ? 'default' : 'outline'}
          onClick={() => setFilter('todos')}
        >
          Todos
        </Button>
      </div>

      {/* Lista de Usuários */}
      <div className="space-y-4">
        {usuariosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum usuário encontrado
              </h3>
              <p className="text-gray-500">
                Não há usuários que correspondam ao filtro selecionado.
              </p>
            </CardContent>
          </Card>
        ) : (
          usuariosFiltrados.map(usuario => (
            <Card key={usuario.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium">{usuario.nome}</h3>
                    {getStatusBadge(usuario)}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Setor:</strong> {usuario.setor}</p>
                    <p><strong>Email usado:</strong> {usuario.email_login}</p>
                    <p><strong>Cadastrado:</strong> {new Date(usuario.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex space-x-2">
                  {usuario.status === 'pendente_aprovacao' && (
                    <>
                      <Button
                        onClick={() => aprovarUsuario(usuario.id)}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => rejeitarUsuario(usuario.id, usuario.nome)}
                        variant="destructive"
                        size="sm"
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                  
                  {!usuario.email_verificado && usuario.codigo_ativo && (
                    <Button
                      onClick={() => reenviarCodigo(usuario.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Reenviar Código
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📋 Como funciona o controle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-600 mb-2">👔 Colaboradores CLT/Associados</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Email @resendemh.com.br obrigatório</li>
                <li>• Código enviado automaticamente</li>
                <li>• Aprovação automática</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-green-600 mb-2">🎓 Estagiários</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Qualquer email pessoal</li>
                <li>• Precisam de aprovação manual</li>
                <li>• Código enviado após aprovação</li>
              </ul>
            </div>
          </div>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Segurança:</strong> Sempre verifique a identidade dos estagiários antes de aprovar. 
              Pessoas não autorizadas podem tentar se cadastrar com emails externos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserControl;
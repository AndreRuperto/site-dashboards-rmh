// AdminUserControl.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Mail, 
  Clock, 
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  email_pessoal: string;
  setor: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
  email_verificado: boolean;
  aprovado_admin: boolean | null;
  criado_em: string;
  email_login: string;
  status: 'pendente_aprovacao' | 'aprovado' | 'corporativo';
  codigo_ativo: boolean;
}

interface UsuariosPendentes {
  usuarios: Usuario[];
  total: number;
  pendentes_aprovacao: number;
  nao_verificados: number;
}

const AdminUserControl: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pendentes_aprovacao: 0,
    nao_verificados: 0
  });
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'corporativos' | 'estagiarios'>('pendentes');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/usuarios-pendentes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }

      const data: UsuariosPendentes = await response.json();
      setUsuarios(data.usuarios);
      setStats({
        total: data.total,
        pendentes_aprovacao: data.pendentes_aprovacao,
        nao_verificados: data.nao_verificados
      });

    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
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
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/aprovar-usuario/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
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
      console.error('Erro ao aprovar usuário:', error);
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
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/rejeitar-usuario/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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
      console.error('Erro ao rejeitar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível rejeitar o usuário",
        variant: "destructive"
      });
    }
  };

  const reenviarCodigo = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/api/admin/reenviar-codigo/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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
      console.error('Erro ao reenviar código:', error);
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
              <AlertCircle className="h-5 w-5 text-red-600" />
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
          Corporativos
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

      {/* Alerta de segurança */}
      {stats.pendentes_aprovacao > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Existem {stats.pendentes_aprovacao} estagiário(s) aguardando aprovação. 
            Verifique se são pessoas autorizadas antes de aprovar.
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de Usuários */}
      <div className="space-y-4">
        {usuariosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum usuário encontrado para este filtro.</p>
            </CardContent>
          </Card>
        ) : (
          usuariosFiltrados.map((usuario) => (
            <Card key={usuario.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{usuario.nome}</h3>
                      {getStatusBadge(usuario)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <p><strong>Email Login:</strong> {usuario.email_login}</p>
                      <p><strong>Setor:</strong> {usuario.setor}</p>
                      {usuario.email_pessoal && usuario.email_pessoal !== usuario.email && (
                        <p><strong>Email Pessoal:</strong> {usuario.email_pessoal}</p>
                      )}
                      <p><strong>Cadastrado em:</strong> {new Date(usuario.criado_em).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex space-x-2 ml-4">
                    {usuario.status === 'pendente_aprovacao' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => aprovarUsuario(usuario.id, true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Aprovar & Enviar Código
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => aprovarUsuario(usuario.id, false)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar Sem Código
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejeitarUsuario(usuario.id, usuario.nome)}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </>
                    )}

                    {usuario.aprovado_admin && !usuario.email_verificado && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reenviarCodigo(usuario.id)}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Reenviar Código
                      </Button>
                    )}

                    {usuario.email_verificado && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ativo
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Informações adicionais para pendentes */}
                {usuario.status === 'pendente_aprovacao' && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800">Estagiário aguardando aprovação</p>
                        <p className="text-yellow-700">
                          Verifique se <strong>{usuario.nome}</strong> é realmente um estagiário autorizado 
                          da empresa antes de aprovar. Email usado: <strong>{usuario.email_login}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Rodapé com informações */}
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
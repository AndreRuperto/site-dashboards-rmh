// src/pages/AdminUserControl.tsx - ATUALIZADO COM GESTÃO POR SETOR
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  User, 
  Users,
  UserLock, 
  Shield, 
  Clock, 
  Mail, 
  CheckCircle, 
  RefreshCw,
  UserCheck,
  UserX,
  Send,
  Crown,
  ArrowLeft,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Tipos atualizados
export type UserRole = 'usuario' | 'coordenador' | 'admin';

interface Usuario {
  id: string;
  nome: string;
  email?: string;
  email_pessoal?: string;
  setor: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
  tipo_usuario: UserRole; // Atualizado
  email_verificado: boolean;
  aprovado_admin?: boolean;
  criado_em: string;
  email_login: string;
  status: string;
  codigo_ativo?: boolean;
  is_coordenador: boolean;
}

interface UsuariosStats {
  total: number;
  pendentes_aprovacao: number;
  nao_verificados: number;
  admins: number;
  coordenadores: number; // NOVO
}

interface UsuariosResponse {
  usuarios: Usuario[];
  setores: string[]; // NOVO
}

// Funções utilitárias
const isPendenteAprovacao = (usuario: Usuario): boolean => {
  return !usuario.aprovado_admin && usuario.tipo_colaborador === 'estagiario';
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://rmh.up.railway.app'
    : 'http://localhost:3001');

const AdminUserControl: React.FC = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsuariosStats>({
    total: 0,
    pendentes_aprovacao: 0,
    nao_verificados: 0,
    admins: 0,
    coordenadores: 0
  });
  
  // Estados para filtros
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'corporativos' | 'estagiarios' | 'admins' | 'coordenadores'>('pendentes');
  const [setorSelecionado, setSetorSelecionado] = useState<string>('todos');
  
  // Estados para modais
  const [usuarioParaRejeitar, setUsuarioParaRejeitar] = useState<{id: string, nome: string} | null>(null);
  const [usuarioParaAprovar, setUsuarioParaAprovar] = useState<{id: string, nome: string} | null>(null);
  const [usuarioParaPromover, setUsuarioParaPromover] = useState<{id: string, nome: string} | null>(null);
  const [usuarioParaRebaixar, setUsuarioParaRebaixar] = useState<{id: string, nome: string} | null>(null);
  
  const { toast } = useToast();

  // Função para obter token
  const getAuthToken = (): string | null => {
    return localStorage.getItem('authToken');
  };

  // Função para fazer requisições com token
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getAuthToken();
    
    if (!token) {
      throw new Error('Token não encontrado no localStorage');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/';
      throw new Error('Token inválido ou expirado');
    }

    return response;
  };

  // Buscar usuários
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios`);

      if (!response.ok) {
        throw new Error('Erro ao carregar usuários');
      }

      const data: UsuariosResponse = await response.json();
      console.log('✅ ADMIN: Dados recebidos:', data);
      
      setUsuarios(data.usuarios || []);
      setSetores(data.setores || []);
      
      const usuarios = data.usuarios || [];
      const pendentes = usuarios.filter((u: Usuario) => isPendenteAprovacao(u)).length;
      const naoVerificados = usuarios.filter((u: Usuario) => !u.email_verificado).length;
      const admins = usuarios.filter((u: Usuario) => u.tipo_usuario === 'admin').length;
      const coordenadores = usuarios.filter((u: Usuario) => u.is_coordenador === true).length;
      
      setStats({
        total: usuarios.length,
        pendentes_aprovacao: pendentes,
        nao_verificados: naoVerificados,
        admins: admins,
        coordenadores: coordenadores
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

  // Aprovar usuário
  const aprovarUsuario = async () => {
    if (!usuarioParaAprovar) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/aprovar-usuario/${usuarioParaAprovar.id}`, {
        method: 'POST',
        body: JSON.stringify({ enviar_codigo: true })
      });

      if (!response.ok) {
        throw new Error('Erro ao aprovar usuário');
      }

      toast({
        title: "✅ Usuário aprovado!",
        description: `${usuarioParaAprovar.nome} foi aprovado e receberá um código de verificação.`,
        variant: "default"
      });

      await fetchUsuarios();
      setUsuarioParaAprovar(null);

    } catch (error) {
      console.error('❌ Erro ao aprovar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aprovar o usuário",
        variant: "destructive"
      });
    }
  };

  // Rejeitar usuário
  const rejeitarUsuario = async () => {
    if (!usuarioParaRejeitar) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/rejeitar-usuario/${usuarioParaRejeitar.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erro ao rejeitar usuário');
      }

      toast({
        title: "🗑️ Usuário rejeitado",
        description: `${usuarioParaRejeitar.nome} foi removido do sistema.`,
        variant: "default"
      });

      await fetchUsuarios();
      setUsuarioParaRejeitar(null);

    } catch (error) {
      console.error('❌ Erro ao rejeitar usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível rejeitar o usuário",
        variant: "destructive"
      });
    }
  };

  // NOVA FUNÇÃO: Promover a coordenador
  const promoverACoordenador = async () => {
    if (!usuarioParaPromover) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios/${usuarioParaPromover.id}/promover`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error('Erro ao promover usuário');
      }

      toast({
        title: "👑 Usuário promovido!",
        description: `${usuarioParaPromover.nome} agora é coordenador do setor.`,
        variant: "default"
      });

      await fetchUsuarios();
      setUsuarioParaPromover(null);

    } catch (error) {
      console.error('❌ Erro ao promover usuário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível promover o usuário",
        variant: "destructive"
      });
    }
  };

  // NOVA FUNÇÃO: Rebaixar coordenador
  const rebaixarCoordenador = async () => {
    if (!usuarioParaRebaixar) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios/${usuarioParaRebaixar.id}/rebaixar`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error('Erro ao rebaixar coordenador');
      }

      toast({
        title: "👤 Coordenador rebaixado",
        description: `${usuarioParaRebaixar.nome} voltou a ser usuário comum.`,
        variant: "default"
      });

      await fetchUsuarios();
      setUsuarioParaRebaixar(null);

    } catch (error) {
      console.error('❌ Erro ao rebaixar coordenador:', error);
      toast({
        title: "Erro",
        description: "Não foi possível rebaixar o coordenador",
        variant: "destructive"
      });
    }
  };

  // Função para obter badge do status do usuário
  const getStatusBadge = (usuario: Usuario) => {
    if (usuario.tipo_usuario === 'admin') {
      return (
        <Badge variant="destructive" className="bg-rmh-primary hover:bg-rmh-primary">
          <Crown className="h-3 w-3 mr-1" />
          Administrador
        </Badge>
      );
    }

    if (usuario.is_coordenador) {
      return (
        <Badge variant="default" className="bg-yellow-600">
          <Crown className="h-3 w-3 mr-1" />
          Coordenador
        </Badge>
      );
    }

    if (isPendenteAprovacao(usuario)) {
      return (
        <Badge variant="secondary" className="bg-rmh-yellow hover:bg-rmh-yellow text-white">
          <Clock className="h-3 w-3 mr-1" />
          Aguardando Aprovação
        </Badge>
      );
    }

    if (!usuario.email_verificado) {
      if (usuario.tipo_colaborador === 'estagiario') {
        return (
          <Badge variant="secondary" className="bg-yellow-500 text-white">
            <Mail className="h-3 w-3 mr-1" />
            Verificação Pendente
          </Badge>
        );
      }

      if (usuario.tipo_colaborador === 'clt_associado') {
        return (
          <Badge variant="secondary" className="bg-rmh-lightGreen hover:bg-rmh-lightGreen text-white">
            <UserLock className="h-3 w-3 mr-1" />
            CLT Pendente
          </Badge>
        );
      }
    }

    if (usuario.aprovado_admin && usuario.email_verificado) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          {usuario.tipo_colaborador === 'estagiario'
            ? 'Estagiário Verificado'
            : 'Usuário Ativo'}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-gray-500 text-white">
        <User className="h-3 w-3 mr-1" />
        Status Indefinido
      </Badge>
    );
  };

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter(usuario => {
    // Filtro por tipo
    const passaFiltroTipo = (() => {
      switch (filter) {
        case 'pendentes':
          return isPendenteAprovacao(usuario);
        case 'corporativos':
          return usuario.tipo_colaborador === 'clt_associado';
        case 'estagiarios':
          return usuario.tipo_colaborador === 'estagiario';
        case 'admins':
          return usuario.tipo_usuario === 'admin';
        case 'coordenadores':
          return usuario.is_coordenador === true;
        default:
          return true;
      }
    })();

    // Filtro por setor
    const passaFiltroSetor = setorSelecionado === 'todos' || usuario.setor === setorSelecionado;

    return passaFiltroTipo && passaFiltroSetor;
  });

  // Agrupar usuários por setor
  const usuariosPorSetor = usuariosFiltrados.reduce((acc, usuario) => {
    if (!acc[usuario.setor]) {
      acc[usuario.setor] = [];
    }
    acc[usuario.setor].push(usuario);
    return acc;
  }, {} as Record<string, Usuario[]>);

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-4">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Início
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Controle de Usuários</h1>
            <p className="text-gray-600">Gerencie cadastros, aprovações e coordenações por setor</p>
          </div>
          <Button onClick={fetchUsuarios} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
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
                <p className="text-sm font-medium text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendentes_aprovacao}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Coordenadores</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.coordenadores}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-red-600">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Não Verificados</p>
                <p className="text-2xl font-bold text-orange-600">{stats.nao_verificados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para separar aprovações e gestão por setor */}
      <Tabs defaultValue="aprovacoes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aprovacoes">Aprovações e Geral</TabsTrigger>
          <TabsTrigger value="setores">Gestão por Setores</TabsTrigger>
        </TabsList>

        {/* Aba de Aprovações (conteúdo existente) */}
        <TabsContent value="aprovacoes" className="space-y-6">
          {/* Filtros existentes */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'pendentes' ? 'default' : 'outline'}
              onClick={() => setFilter('pendentes')}
              size="sm"
            >
              Pendentes ({stats.pendentes_aprovacao})
            </Button>
            <Button
              variant={filter === 'admins' ? 'default' : 'outline'}
              onClick={() => setFilter('admins')}
              size="sm"
            >
              <Shield className="h-4 w-4 mr-1" />
              Admins ({stats.admins})
            </Button>
            <Button
              variant={filter === 'corporativos' ? 'default' : 'outline'}
              onClick={() => setFilter('corporativos')}
              size="sm"
            >
              CLT/Associados
            </Button>
            <Button
              variant={filter === 'estagiarios' ? 'default' : 'outline'}
              onClick={() => setFilter('estagiarios')}
              size="sm"
            >
              Estagiários
            </Button>
            <Button
              variant={filter === 'todos' ? 'default' : 'outline'}
              onClick={() => setFilter('todos')}
              size="sm"
            >
              Todos
            </Button>
          </div>

          {/* Lista de usuários existente */}
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
              usuariosFiltrados.map((usuario) => (
                <Card key={usuario.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-lg">{usuario.nome}</h3>
                            {getStatusBadge(usuario)}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {usuario.email_login} • {usuario.setor} • {usuario.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isPendenteAprovacao(usuario) && (
                          <>
                            <Button
                              onClick={() => setUsuarioParaAprovar({ id: usuario.id, nome: usuario.nome })}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              onClick={() => setUsuarioParaRejeitar({ id: usuario.id, nome: usuario.nome })}
                              size="sm"
                              variant="destructive"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Nova Aba de Gestão por Setores */}
        <TabsContent value="setores" className="space-y-6">
          {/* Filtro por setor */}
          <div className="flex items-center gap-4">
            <Building2 className="h-5 w-5 text-gray-600" />
            <Select value={setorSelecionado} onValueChange={setSetorSelecionado}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setores.map(setor => (
                  <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              variant={filter === 'coordenadores' ? 'default' : 'outline'}
              onClick={() => setFilter('coordenadores')}
              size="sm"
            >
              <Crown className="h-4 w-4 mr-1" />
              Apenas Coordenadores ({stats.coordenadores})
            </Button>
            <Button
              variant={filter === 'todos' ? 'default' : 'outline'}
              onClick={() => setFilter('todos')}
              size="sm"
            >
              Todos
            </Button>
          </div>

          {/* Usuários agrupados por setor */}
          <div className="grid gap-6">
            {Object.entries(usuariosPorSetor).map(([setor, usersInSetor]) => (
              <Card key={setor}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Setor: {setor}
                    </span>
                    <Badge variant="outline">
                      {usersInSetor.length} usuário{usersInSetor.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {usersInSetor.map(usuario => (
                      <div key={usuario.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{usuario.nome}</p>
                            <p className="text-sm text-gray-500">{usuario.email_login}</p>
                          </div>
                          {getStatusBadge(usuario)}
                        </div>
                        
                        <div className="flex gap-2">
                          {usuario.tipo_usuario === 'usuario' && usuario.aprovado_admin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUsuarioParaPromover({ id: usuario.id, nome: usuario.nome })}
                              className="text-yellow-600 hover:text-yellow-700"
                            >
                              <Crown className="h-4 w-4 mr-1" />
                              Tornar Coordenador
                            </Button>
                          )}
                          
                          {usuario.tipo_usuario === 'coordenador' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setUsuarioParaRebaixar({ id: usuario.id, nome: usuario.nome })}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Remover Coordenação
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {Object.keys(usuariosPorSetor).length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum usuário encontrado
                  </h3>
                  <p className="text-gray-500">
                    Não há usuários que correspondam aos filtros selecionados.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modais existentes + novos modais */}
      
      {/* Modal de Aprovação */}
      <AlertDialog open={!!usuarioParaAprovar} onOpenChange={() => setUsuarioParaAprovar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <UserCheck className="h-5 w-5 mr-2 text-green-600" />
              Aprovar Usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja aprovar o cadastro de <strong>{usuarioParaAprovar?.nome}</strong>?
              <br /><br />
              O usuário receberá um código de verificação por email para ativar sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setUsuarioParaAprovar(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={aprovarUsuario}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4 mr-2" />
              Sim, Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Rejeição */}
      <AlertDialog open={!!usuarioParaRejeitar} onOpenChange={() => setUsuarioParaRejeitar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <UserX className="h-5 w-5 mr-2 text-red-600" />
              Rejeitar Usuário
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rejeitar o cadastro de <strong>{usuarioParaRejeitar?.nome}</strong>?
              <br /><br />
              <span className="text-red-600 font-medium">
                ⚠️ Esta ação não pode ser desfeita e o usuário será removido permanentemente do sistema.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setUsuarioParaRejeitar(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={rejeitarUsuario}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <UserX className="h-4 w-4 mr-2" />
              Sim, Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NOVO Modal de Promoção a Coordenador */}
      <AlertDialog open={!!usuarioParaPromover} onOpenChange={() => setUsuarioParaPromover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Crown className="h-5 w-5 mr-2 text-yellow-600" />
              Tornar Coordenador
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja promover <strong>{usuarioParaPromover?.nome}</strong> a coordenador do setor?
              <br />
              Isso permitirá que ele tenha acesso aos dashboards restritos do setor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setUsuarioParaPromover(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={promoverACoordenador}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Crown className="h-4 w-4 mr-2" />
              Sim, Promover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* NOVO Modal de Rebaixar Coordenador */}
      <AlertDialog open={!!usuarioParaRebaixar} onOpenChange={() => setUsuarioParaRebaixar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-gray-600" />
              Rebaixar Coordenador
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja rebaixar <strong>{usuarioParaRebaixar?.nome}</strong> para colaborador comum?
              <br />
              Ele perderá acesso aos dashboards exclusivos de coordenação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setUsuarioParaRebaixar(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={rebaixarCoordenador}
              className="bg-gray-600 hover:bg-gray-700 text-white"
            >
              <Users className="h-4 w-4 mr-2" />
              Sim, Rebaixar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserControl;
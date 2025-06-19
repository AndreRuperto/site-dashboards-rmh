// src/pages/AdminUserControl.tsx - VERSÃO MELHORADA E COMPLETA
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Building2,
  UserPlus,
  Settings,
  Ban,
  Briefcase,
  GraduationCap,
  Edit,
  Trash
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SETORES } from '@/types';

// Tipos atualizados
export type UserRole = 'usuario' | 'coordenador' | 'admin';

interface Usuario {
  id: string;
  nome: string;
  email?: string;
  email_pessoal?: string;
  setor: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
  tipo_usuario: UserRole;
  email_verificado: boolean;
  aprovado_admin?: boolean;
  criado_em: string;
  email_login: string;
  status: string;
  codigo_ativo?: boolean;
  is_coordenador: boolean;
  ativo?: boolean; // NOVO campo para revogação de acesso
}

interface UsuariosStats {
  total: number;
  pendentes_aprovacao: number;
  nao_verificados: number;
  admins: number;
  coordenadores: number;
  clt_associados: number; // NOVO
  estagiarios: number; // NOVO
  revogados: number; // NOVO
}

interface UsuariosResponse {
  usuarios: Usuario[];
  setores: string[];
}

// Modal states
interface NovoUsuarioData {
  nome: string;
  email: string;
  email_pessoal: string;
  setor: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
}

interface EditarUsuarioData {
  id: string;
  nome: string;
  setor: string;
  email_pessoal: string;
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
  const setores = SETORES;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsuariosStats>({
    total: 0,
    pendentes_aprovacao: 0,
    nao_verificados: 0,
    admins: 0,
    coordenadores: 0,
    clt_associados: 0,
    estagiarios: 0,
    revogados: 0
  });
  
  // Estados para filtros
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'corporativos' | 'estagiarios' | 'admins' | 'coordenadores' | 'revogados'>('pendentes');
  const [setorSelecionado, setSetorSelecionado] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Estados para modais de ação
  const [usuarioParaRejeitar, setUsuarioParaRejeitar] = useState<{id: string, nome: string} | null>(null);
  const [usuarioParaAprovar, setUsuarioParaAprovar] = useState<{id: string, nome: string} | null>(null);
  const [usuarioParaPromover, setUsuarioParaPromover] = useState<{id: string, nome: string, isCoordenador: boolean} | null>(null);
  const [usuarioParaRevogar, setUsuarioParaRevogar] = useState<{id: string, nome: string} | null>(null);
  
  // Estados para modais de edição
  const [modalNovoUsuario, setModalNovoUsuario] = useState(false);
  const [modalEditarUsuario, setModalEditarUsuario] = useState(false);
  const [novoUsuarioData, setNovoUsuarioData] = useState<NovoUsuarioData>({
    nome: '',
    email: '',
    email_pessoal: '',
    setor: '',
    tipo_colaborador: 'estagiario'
  });
  const [editarUsuarioData, setEditarUsuarioData] = useState<EditarUsuarioData>({
    id: '',
    nome: '',
    setor: '',
    email_pessoal: ''
  });
  
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
      
      const usuarios = data.usuarios || [];
      const pendentes = usuarios.filter((u: Usuario) => isPendenteAprovacao(u)).length;
      const naoVerificados = usuarios.filter((u: Usuario) => !u.email_verificado).length;
      const admins = usuarios.filter((u: Usuario) => u.tipo_usuario === 'admin').length;
      const coordenadores = usuarios.filter((u: Usuario) => u.is_coordenador === true).length;
      const cltAssociados = usuarios.filter((u: Usuario) => u.tipo_colaborador === 'clt_associado').length;
      const estagiarios = usuarios.filter((u: Usuario) => u.tipo_colaborador === 'estagiario').length;
      const revogados = usuarios.filter((u: Usuario) => u.ativo === false).length;
      
      setStats({
        total: usuarios.length,
        pendentes_aprovacao: pendentes,
        nao_verificados: naoVerificados,
        admins: admins,
        coordenadores: coordenadores,
        clt_associados: cltAssociados,
        estagiarios: estagiarios,
        revogados: revogados
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

  // NOVO: Adicionar usuário
  const adicionarUsuario = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/adicionar-usuario`, {
        method: 'POST',
        body: JSON.stringify(novoUsuarioData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar usuário');
      }

      const result = await response.json();
      
      toast({
        title: "✅ Usuário adicionado!",
        description: `${novoUsuarioData.nome} foi adicionado. ${result.email_enviado ? 'Email de configuração enviado.' : ''}`,
        variant: "default"
      });

      await fetchUsuarios();
      setModalNovoUsuario(false);
      setNovoUsuarioData({
        nome: '',
        email: '',
        email_pessoal: '',
        setor: '',
        tipo_colaborador: 'estagiario'
      });

    } catch (error) {
      console.error('❌ Erro ao adicionar usuário:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível adicionar o usuário",
        variant: "destructive"
      });
    }
  };

  // NOVO: Editar usuário
  const editarUsuario = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/editar-usuario/${editarUsuarioData.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nome: editarUsuarioData.nome,
          setor: editarUsuarioData.setor,
          email_pessoal: editarUsuarioData.email_pessoal
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao editar usuário');
      }

      toast({
        title: "✅ Usuário editado!",
        description: `Dados de ${editarUsuarioData.nome} foram atualizados.`,
        variant: "default"
      });

      await fetchUsuarios();
      setModalEditarUsuario(false);

    } catch (error) {
      console.error('❌ Erro ao editar usuário:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível editar o usuário",
        variant: "destructive"
      });
    }
  };

  // NOVO: Revogar acesso
  const revogarAcesso = async () => {
    if (!usuarioParaRevogar) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/revogar-acesso/${usuarioParaRevogar.id}`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error('Erro ao revogar acesso');
      }

      toast({
        title: "🚫 Acesso revogado",
        description: `Acesso de ${usuarioParaRevogar.nome} foi revogado.`,
        variant: "default"
      });

      await fetchUsuarios();
      setUsuarioParaRevogar(null);

    } catch (error) {
      console.error('❌ Erro ao revogar acesso:', error);
      toast({
        title: "Erro",
        description: "Não foi possível revogar o acesso",
        variant: "destructive"
      });
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
        description: `${usuarioParaAprovar.nome} foi aprovado e receberá um link de ativação.`,
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

  // MELHORADO: Função de coordenação
  const toggleCoordenacao = async () => {
    if (!usuarioParaPromover) return;

    try {
      const endpoint = usuarioParaPromover.isCoordenador ? 'rebaixar' : 'promover';
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios/${usuarioParaPromover.id}/${endpoint}`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error(`Erro ao ${usuarioParaPromover.isCoordenador ? 'rebaixar' : 'promover'} usuário`);
      }

      toast({
        title: usuarioParaPromover.isCoordenador ? "👤 Coordenador rebaixado" : "👑 Usuário promovido!",
        description: usuarioParaPromover.isCoordenador 
          ? `${usuarioParaPromover.nome} voltou a ser usuário comum.`
          : `${usuarioParaPromover.nome} agora é coordenador do setor.`,
        variant: "default"
      });

      await fetchUsuarios();
      setUsuarioParaPromover(null);

    } catch (error) {
      console.error('❌ Erro ao alterar coordenação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a coordenação",
        variant: "destructive"
      });
    }
  };

  // Função para obter badge do status do usuário
  const getStatusBadge = (usuario: Usuario) => {
    if (usuario.ativo === false) {
      return (
        <Badge variant="destructive" className="bg-red-700 hover:bg-red-700">
          <Ban className="h-3 w-3 mr-1" />
          Acesso Revogado
        </Badge>
      );
    }

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
            ? 'Estagiário Ativo'
            : 'CLT Ativo'}
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

  // Filtrar usuários com busca
  const usuariosFiltrados = usuarios.filter(usuario => {
    // Filtro por busca
    const passaBusca = searchTerm === '' || 
      usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email_login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.setor.toLowerCase().includes(searchTerm.toLowerCase());

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
        case 'revogados':
          return usuario.ativo === false;
        default:
          return true;
      }
    })();

    // Filtro por setor
    const passaFiltroSetor = setorSelecionado === 'todos' || usuario.setor === setorSelecionado;

    return passaBusca && passaFiltroTipo && passaFiltroSetor;
  });

  // Função para abrir modal de edição
  const abrirModalEdicao = (usuario: Usuario) => {
    setEditarUsuarioData({
      id: usuario.id,
      nome: usuario.nome,
      setor: usuario.setor,
      email_pessoal: usuario.email_pessoal || ''
    });
    setModalEditarUsuario(true);
  };

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
          <div className="flex gap-2">
            <Button onClick={() => setModalNovoUsuario(true)} className="bg-green-600 hover:bg-green-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
            <Button onClick={fetchUsuarios} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Estatísticas Melhoradas */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
              <Briefcase className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">CLT/Associados</p>
                <p className="text-2xl font-bold text-blue-500">{stats.clt_associados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-600">Estagiários</p>
                <p className="text-2xl font-bold text-green-500">{stats.estagiarios}</p>
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
              <Ban className="h-5 w-5 text-red-700" />
              <div>
                <p className="text-sm font-medium text-gray-600">Revogados</p>
                <p className="text-2xl font-bold text-red-700">{stats.revogados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <div className="space-y-4">
        {/* Busca */}
        <div className="flex gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Buscar por nome, email ou setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={setorSelecionado} onValueChange={setSetorSelecionado}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os setores</SelectItem>
              {setores.map(setor => (
                <SelectItem key={setor} value={setor}>{setor}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtros por tipo */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'pendentes' ? 'default' : 'outline'}
            onClick={() => setFilter('pendentes')}
            size="sm"
          >
            <Clock className="h-4 w-4 mr-1" />
            Pendentes ({stats.pendentes_aprovacao})
          </Button>
          <Button
            variant={filter === 'corporativos' ? 'default' : 'outline'}
            onClick={() => setFilter('corporativos')}
            size="sm"
          >
            <Briefcase className="h-4 w-4 mr-1" />
            CLT/Associados ({stats.clt_associados})
          </Button>
          <Button
            variant={filter === 'estagiarios' ? 'default' : 'outline'}
            onClick={() => setFilter('estagiarios')}
            size="sm"
          >
            <GraduationCap className="h-4 w-4 mr-1" />
            Estagiários ({stats.estagiarios})
          </Button>
          <Button
            variant={filter === 'coordenadores' ? 'default' : 'outline'}
            onClick={() => setFilter('coordenadores')}
            size="sm"
          >
            <Crown className="h-4 w-4 mr-1" />
            Coordenadores ({stats.coordenadores})
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
            variant={filter === 'revogados' ? 'default' : 'outline'}
            onClick={() => setFilter('revogados')}
            size="sm"
          >
            <Ban className="h-4 w-4 mr-1" />
            Revogados ({stats.revogados})
          </Button>
          <Button
            variant={filter === 'todos' ? 'default' : 'outline'}
            onClick={() => setFilter('todos')}
            size="sm"
          >
            Todos
          </Button>
        </div>
      </div>

      {/* Lista de usuários */}
      <div className="space-y-4">
        {usuariosFiltrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum usuário encontrado
              </h3>
              <p className="text-gray-500">
                Não há usuários que correspondam aos filtros selecionados.
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
                    {/* Botões para aprovação (apenas estagiários pendentes) */}
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

                    {/* Botões para usuários ativos */}
                    {usuario.aprovado_admin && usuario.email_verificado && usuario.ativo !== false && usuario.tipo_usuario !== 'admin' && (
                      <>
                        {/* Botão de coordenação */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUsuarioParaPromover({ 
                            id: usuario.id, 
                            nome: usuario.nome, 
                            isCoordenador: usuario.is_coordenador 
                          })}
                          className={usuario.is_coordenador 
                            ? "text-gray-600 hover:text-gray-700" 
                            : "text-yellow-600 hover:text-yellow-700"
                          }
                        >
                          <Crown className="h-4 w-4 mr-1" />
                          {usuario.is_coordenador ? 'Remover Coordenação' : 'Tornar Coordenador'}
                        </Button>

                        {/* Botão de editar */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => abrirModalEdicao(usuario)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>

                        {/* Botão de revogar */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUsuarioParaRevogar({ id: usuario.id, nome: usuario.nome })}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Revogar
                        </Button>
                      </>
                    )}

                    {/* Para usuários revogados, botão de reativar */}
                    {usuario.ativo === false && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {/* Implementar reativação */}}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Reativar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* MODAL: Adicionar Novo Usuário */}
      <Dialog open={modalNovoUsuario} onOpenChange={setModalNovoUsuario}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <UserPlus className="h-5 w-5 mr-2 text-green-600" />
              Adicionar Novo Usuário
            </DialogTitle>
            <DialogDescription>
              O usuário receberá um email para configurar sua senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                value={novoUsuarioData.nome}
                onChange={(e) => setNovoUsuarioData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_colaborador">Tipo de Colaborador</Label>
              <Select 
                value={novoUsuarioData.tipo_colaborador} 
                onValueChange={(value: 'estagiario' | 'clt_associado') => 
                  setNovoUsuarioData(prev => ({ ...prev, tipo_colaborador: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estagiario">
                    <div className="flex items-center">
                      <GraduationCap className="h-4 w-4 mr-2" />
                      Estagiário
                    </div>
                  </SelectItem>
                  <SelectItem value="clt_associado">
                    <div className="flex items-center">
                      <Briefcase className="h-4 w-4 mr-2" />
                      CLT/Associado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {novoUsuarioData.tipo_colaborador === 'clt_associado' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email Corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  value={novoUsuarioData.email}
                  onChange={(e) => setNovoUsuarioData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="usuario@resendemh.com.br"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email_pessoal">Email Pessoal</Label>
              <Input
                id="email_pessoal"
                type="email"
                value={novoUsuarioData.email_pessoal}
                onChange={(e) => setNovoUsuarioData(prev => ({ ...prev, email_pessoal: e.target.value }))}
                placeholder="usuario@gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Select 
                value={novoUsuarioData.setor} 
                onValueChange={(value) => setNovoUsuarioData(prev => ({ ...prev, setor: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {setores.map(setor => (
                    <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalNovoUsuario(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={adicionarUsuario}
              disabled={!novoUsuarioData.nome || !novoUsuarioData.email_pessoal || !novoUsuarioData.setor}
              className="bg-green-600 hover:bg-green-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar Usuário */}
      <Dialog open={modalEditarUsuario} onOpenChange={setModalEditarUsuario}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Edit className="h-5 w-5 mr-2 text-blue-600" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_nome">Nome Completo</Label>
              <Input
                id="edit_nome"
                value={editarUsuarioData.nome}
                onChange={(e) => setEditarUsuarioData(prev => ({ ...prev, nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_setor">Setor</Label>
              <Select 
                value={editarUsuarioData.setor} 
                onValueChange={(value) => setEditarUsuarioData(prev => ({ ...prev, setor: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {setores.map(setor => (
                    <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_email_pessoal">Email Pessoal</Label>
              <Input
                id="edit_email_pessoal"
                type="email"
                value={editarUsuarioData.email_pessoal}
                onChange={(e) => setEditarUsuarioData(prev => ({ ...prev, email_pessoal: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalEditarUsuario(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={editarUsuario}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Confirmação de Aprovação */}
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
              O usuário receberá um link de ativação por email.
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

      {/* MODAL: Confirmação de Rejeição */}
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

      {/* MODAL: Confirmação de Coordenação */}
      <AlertDialog open={!!usuarioParaPromover} onOpenChange={() => setUsuarioParaPromover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Crown className="h-5 w-5 mr-2 text-yellow-600" />
              {usuarioParaPromover?.isCoordenador ? 'Remover Coordenação' : 'Tornar Coordenador'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {usuarioParaPromover?.isCoordenador ? (
                <>
                  Deseja remover a coordenação de <strong>{usuarioParaPromover?.nome}</strong>?
                  <br />
                  Ele perderá acesso aos dashboards exclusivos de coordenação.
                </>
              ) : (
                <>
                  Deseja promover <strong>{usuarioParaPromover?.nome}</strong> a coordenador do setor?
                  <br />
                  Isso permitirá que ele tenha acesso aos dashboards restritos do setor.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setUsuarioParaPromover(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={toggleCoordenacao}
              className={usuarioParaPromover?.isCoordenador 
                ? "bg-gray-600 hover:bg-gray-700 text-white"
                : "bg-yellow-600 hover:bg-yellow-700"
              }
            >
              <Crown className="h-4 w-4 mr-2" />
              {usuarioParaPromover?.isCoordenador ? 'Sim, Remover' : 'Sim, Promover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* MODAL: Confirmação de Revogação */}
      <AlertDialog open={!!usuarioParaRevogar} onOpenChange={() => setUsuarioParaRevogar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Ban className="h-5 w-5 mr-2 text-red-600" />
              Revogar Acesso
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja revogar o acesso de <strong>{usuarioParaRevogar?.nome}</strong>?
              <br /><br />
              O usuário não conseguirá mais fazer login na plataforma, mas seus dados serão mantidos.
              <br />
              <span className="text-blue-600 text-sm">Esta ação pode ser revertida posteriormente.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setUsuarioParaRevogar(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={revogarAcesso}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Ban className="h-4 w-4 mr-2" />
              Sim, Revogar Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserControl;
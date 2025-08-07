// src/pages/AdminUserControl.tsx - VERSÃO MELHORADA E COMPLETA
import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TokensExpiradosTab } from './TokensExpiradosTab';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Header from '@/components/Header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import EmailsProcessos from './EmailsProcessos';
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
  MailSearch, 
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
  ativo?: boolean;
  criado_por_admin?: string | null;
  criado_por_admin_em?: string | null;
  criado_por_admin_nome?: string | null;
}

interface UsuariosStats {
  total: number;
  pendentes_aprovacao: number;
  nao_verificados: number;
  admins: number;
  coordenadores: number;
  clt_associados: number;
  estagiarios: number;
  revogados: number;
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
  nova_senha?: string;
}

interface EditarUsuarioData {
  id: string;
  nome: string;
  setor: string;
  email_pessoal: string;
  nova_senha?: string;
}

// Funções utilitárias
const isPendenteAprovacao = (usuario: Usuario): boolean => {
  return usuario.tipo_colaborador === 'estagiario' && 
         !usuario.aprovado_admin && 
         !usuario.criado_por_admin;
};

const isPendenteVerificacao = (usuario: Usuario): boolean => {
  return !usuario.email_verificado;
};

// No topo do arquivo
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// 🆕 COMPONENTE PARA TOKENS EXPIRADOS (definido FORA do componente principal)
const TokensExpiradosSection: React.FC<{
  activeTab: string;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  toast: ReturnType<typeof useToast>['toast'];
}> = ({ activeTab, fetchWithAuth, toast }) => {
  const [categoriasTokens, setCategoriaTokens] = useState({
    tokens_expirados: [],
    sem_codigo: [],
    aguardando_verificacao: []
  });
  const [reenviarLoading, setReenviarLoading] = useState<string | null>(null);

  // Função para carregar usuários com problemas de token
  const fetchUsuariosTokens = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios-pendentes`);
      if (!response.ok) throw new Error('Erro ao carregar tokens');
      
      const data = await response.json();
      setCategoriaTokens(data.usuarios_por_categoria || {
        tokens_expirados: [],
        sem_codigo: [],
        aguardando_verificacao: []
      });
    } catch (error) {
      console.error('❌ Erro ao carregar tokens:', error);
    }
  };

  // Função de reenvio
  const reenviarCodigo = async (userId: string, nome: string, tipoColaborador: string) => {
    try {
      setReenviarLoading(userId);
      
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/reenviar-codigo/${userId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao reenviar código');
      }

      toast({
        title: "✅ Código reenviado!",
        description: `${tipoColaborador === 'estagiario' ? 'Link' : 'Código'} enviado para ${nome}`,
        variant: "default"
      });

      await fetchUsuariosTokens();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao reenviar código",
        variant: "destructive"
      });
    } finally {
      setReenviarLoading(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'verificacoes') {
      fetchUsuariosTokens();
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Seção de Tokens Expirados */}
      {categoriasTokens.tokens_expirados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <Clock className="h-5 w-5" />
              <span>Usuários com Tokens Expirados ({categoriasTokens.tokens_expirados.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoriasTokens.tokens_expirados.map((usuario: Usuario) => (
                <div key={usuario.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                  <div className="flex items-center space-x-3">
                    <User className="h-8 w-8 text-gray-400" />
                    <div>
                      <h4 className="font-medium">{usuario.nome}</h4>
                      <p className="text-sm text-gray-600">{usuario.email_login} • {usuario.setor}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={usuario.tipo_colaborador === 'estagiario' ? 'default' : 'secondary'}>
                      {usuario.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
                    </Badge>
                    
                    <Button
                      size="sm"
                      onClick={() => reenviarCodigo(usuario.id, usuario.nome, usuario.tipo_colaborador)}
                      disabled={reenviarLoading === usuario.id}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {reenviarLoading === usuario.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-1" />
                          Reenviar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem se não houver problemas */}
      {categoriasTokens.tokens_expirados.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum token expirado!
            </h3>
            <p className="text-gray-600">
              Todos os usuários estão com tokens válidos ou já verificados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const AdminUserControl: React.FC = () => {
  // No topo do arquivo
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
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

  const [visualizacaoPorSetores, setVisualizacaoPorSetores] = useState(false);
  
  // Estados para filtros
  const [activeTab, setActiveTab] = useState('geral');
  const [filter, setFilter] = useState<'todos' | 'pendentes_aprovacao' | 'pendentes_verificacao' | 'corporativos' | 'estagiarios' | 'admins' | 'coordenadores' | 'revogados'>('pendentes_aprovacao'); 
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
    tipo_colaborador: 'estagiario',
    nova_senha: ''
  });
  const [editarUsuarioData, setEditarUsuarioData] = useState<EditarUsuarioData>({
    id: '',
    nome: '',
    setor: '',
    email_pessoal: '',
    nova_senha: ''
  });
  
  const { toast } = useToast();

  const usuariosAgrupadosPorSetor = usuarios.reduce((acc: Record<string, Usuario[]>, usuario) => {
    if (!acc[usuario.setor]) {
      acc[usuario.setor] = [];
    }
    acc[usuario.setor].push(usuario);
    return acc;
  }, {});

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
      
      // 1️⃣ Buscar usuários
      const usuariosResponse = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios`);
      if (!usuariosResponse.ok) {
        throw new Error('Erro ao carregar usuários');
      }
      const usuariosData = await usuariosResponse.json();
      setUsuarios(usuariosData.usuarios || []);

      // 2️⃣ Buscar estatísticas do backend (CORRIGIDAS)
      const statsResponse = await fetchWithAuth(`${API_BASE_URL}/api/admin/estatisticas`);
      if (!statsResponse.ok) {
        throw new Error('Erro ao carregar estatísticas');
      }
      const statsData = await statsResponse.json();
      
      // ✅ USAR STATS DO BACKEND (não calcular no frontend)
      setStats({
        total: parseInt(statsData.geral.total_usuarios) || 0,
        pendentes_aprovacao: parseInt(statsData.geral.pendentes_aprovacao) || 0,
        nao_verificados: parseInt(statsData.geral.nao_verificados) || 0,
        admins: parseInt(statsData.geral.total_admins) || 0,
        coordenadores: parseInt(statsData.geral.total_coordenadores) || 0,
        clt_associados: parseInt(statsData.geral.total_clt_associados) || 0,
        estagiarios: parseInt(statsData.geral.total_estagiarios) || 0,
        revogados: parseInt(statsData.geral.revogados) || 0
      });

      console.log('✅ ADMIN: Usuários e estatísticas carregados:', {
        usuarios: usuariosData.usuarios?.length || 0,
        stats: statsData.geral
      });

    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const setoresFiltrados = Object.keys(usuariosAgrupadosPorSetor).filter(setor => {
    if (setorSelecionado !== 'todos' && setor !== setorSelecionado) {
      return false;
    }
    
    const usuariosDoSetor = usuariosAgrupadosPorSetor[setor].filter(usuario => {
      const passaBusca = searchTerm === '' || 
        usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.email_login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.setor.toLowerCase().includes(searchTerm.toLowerCase());

      // ✅ CORREÇÃO: Mesmo filtro com exclusão de revogados
      const passaFiltroTipo = (() => {
        switch (filter) {
          case 'pendentes_aprovacao':
            return isPendenteAprovacao(usuario) && usuario.ativo !== false;
          case 'pendentes_verificacao':
            return isPendenteVerificacao(usuario) && !isPendenteAprovacao(usuario) && usuario.ativo !== false;
          case 'corporativos':
            return usuario.tipo_colaborador === 'clt_associado' && !isPendenteVerificacao(usuario) && usuario.ativo !== false;
          case 'estagiarios':
            return usuario.tipo_colaborador === 'estagiario' && !isPendenteAprovacao(usuario) && !isPendenteVerificacao(usuario) && usuario.ativo !== false;
          case 'admins':
            return usuario.tipo_usuario === 'admin' && usuario.ativo !== false;
          case 'coordenadores':
            return usuario.is_coordenador === true && usuario.ativo !== false;
          case 'revogados':
            return usuario.ativo === false;
          case 'todos':
            return usuario.ativo !== false;
          default:
            return usuario.ativo !== false;
        }
      })();

      return passaBusca && passaFiltroTipo;
    });

    return usuariosDoSetor.length > 0;
  });

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
        tipo_colaborador: 'estagiario',
        nova_senha: ''
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
          email_pessoal: editarUsuarioData.email_pessoal,
          nova_senha: editarUsuarioData.nova_senha || undefined
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

    // ✅ MUDANÇA: Renderizar AMBAS as tags quando for admin E coordenador
    const badges = [];

    // Tag de Administrador
    if (usuario.tipo_usuario === 'admin') {
      badges.push(
        <Badge key="admin" variant="destructive" className="bg-rmh-primary hover:bg-rmh-primary">
          <Crown className="h-3 w-3 mr-1" />
          Administrador
        </Badge>
      );
    }

    // Tag de Coordenador (independente de ser admin ou não)
    if (usuario.is_coordenador) {
      badges.push(
        <Badge key="coordenador" variant="default" className="bg-yellow-500">
          <Crown className="h-3 w-3 mr-1" />
          Coordenador
        </Badge>
      );
    }

    // Se já temos badges de admin/coordenador, retornar elas
    if (badges.length > 0) {
      return (
        <div className="flex items-center space-x-1">
          {badges}
        </div>
      );
    }

    // Continuar com a lógica original para outros casos
    if (isPendenteAprovacao(usuario)) {
      return (
        <Badge variant="secondary" className="bg-rmh-yellow hover:bg-rmh-yellow text-white">
          <Clock className="h-3 w-3 mr-1" />
          Aguardando Aprovação
        </Badge>
      );
    }

    if (!usuario.email_verificado) {
      return (
        <Badge variant="secondary" className="bg-rmh-yellow hover:bg-rmh-yellow text-white">
          <Mail className="h-3 w-3 mr-1" />
          Verificação Pendente
        </Badge>
      );
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

  // ✅ CORREÇÃO: Filtro por tipo (excluindo revogados dos outros filtros)
  const passaFiltroTipo = (() => {
    switch (filter) {
      case 'pendentes_aprovacao':
        return isPendenteAprovacao(usuario) && usuario.ativo !== false; // ✅ Excluir revogados
      case 'pendentes_verificacao':
        return isPendenteVerificacao(usuario) && !isPendenteAprovacao(usuario) && usuario.ativo !== false; // ✅ Excluir revogados
      case 'corporativos':
        return usuario.tipo_colaborador === 'clt_associado' && !isPendenteVerificacao(usuario) && usuario.ativo !== false; // ✅ Excluir revogados
      case 'estagiarios':
        return usuario.tipo_colaborador === 'estagiario' && !isPendenteAprovacao(usuario) && !isPendenteVerificacao(usuario) && usuario.ativo !== false; // ✅ Excluir revogados
      case 'admins':
        return usuario.tipo_usuario === 'admin' && usuario.ativo !== false; // ✅ Excluir revogados
      case 'coordenadores':
        return usuario.is_coordenador === true && usuario.ativo !== false; // ✅ Excluir revogados
      case 'revogados':
        return usuario.ativo === false; // ✅ Apenas revogados
      case 'todos':
        return usuario.ativo !== false; // ✅ Todos exceto revogados
      default:
        return usuario.ativo !== false; // ✅ Por padrão, excluir revogados
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
      email_pessoal: usuario.email_pessoal || '',
      nova_senha: ''
    });
    setModalEditarUsuario(true);
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-8 w-8 animate-spin text-black-600" />
            <span className="text-lg font-medium text-gray-700">Carregando usuários...</span>
          </div>
          <div className="text-sm text-gray-500">Por favor, aguarde um momento</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <h1 className="text-3xl font-heading font-bold text-rmh-primary">
                Controle de Usuários
              </h1>
              <p className="text-corporate-gray mt-1">
                Gerencie cadastros, aprovações e coordenações por setor
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={() => setModalNovoUsuario(true)} className="bg-rmh-lightGreen hover:bg-rmh-primary">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Usuário
              </Button>
              <Button onClick={fetchUsuarios} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Resto do conteúdo */}
          <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Estatísticas Melhoradas */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pendentes</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.pendentes_aprovacao + stats.nao_verificados}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Briefcase className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">CLT/Associados</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.clt_associados}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estagiários</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.estagiarios}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Crown className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Coordenadores</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.coordenadores}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Administradores</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.admins}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Ban className="h-5 w-5 text-gray-700" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Revogados</p>
                      <p className="text-2xl font-bold text-gray-700">{stats.revogados}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sistema de Abas */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 gap-2">
                <TabsTrigger 
                  value="geral"
                  className="data-[state=active]:border data-[state=active]:border-black-300 data-[state=active]:shadow-sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Usuários Gerais
                </TabsTrigger>
                <TabsTrigger 
                  value="verificacoes" 
                  className="relative data-[state=active]:border data-[state=active]:border-black-300 data-[state=active]:shadow-sm"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Verificações & Tokens
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: USUÁRIOS GERAIS */}
              <TabsContent value="geral" className="space-y-4">
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
                    
                    {/* Toggle para Agrupar por Setores */}
                    <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg border">
                      <Building2 className="h-4 w-4 text-gray-600" />
                      <Label htmlFor="toggle-setores" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                        Agrupar por Setores
                      </Label>
                      <Switch
                        id="toggle-setores"
                        checked={visualizacaoPorSetores}
                        onCheckedChange={setVisualizacaoPorSetores}
                      />
                    </div>
                  </div>
                  
                  {/* Filtros por tipo */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                    <Button
                      variant={filter === 'pendentes_aprovacao' ? 'default' : 'outline'}
                      onClick={() => setFilter('pendentes_aprovacao')}
                      size="sm"
                      className="w-full"
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Aguard. Aprovação ({stats.pendentes_aprovacao})
                    </Button>
                    <Button
                      variant={filter === 'pendentes_verificacao' ? 'default' : 'outline'}
                      onClick={() => setFilter('pendentes_verificacao')}
                      size="sm"
                      className="w-full"
                    >
                      <MailSearch className="h-4 w-4 mr-1" />
                      Aguard. Verificação ({stats.nao_verificados})
                    </Button>
                    <Button
                      variant={filter === 'corporativos' ? 'default' : 'outline'}
                      onClick={() => setFilter('corporativos')}
                      size="sm"
                      className="w-full"
                    >
                      <Briefcase className="h-4 w-4 mr-1" />
                      CLT/Associados ({stats.clt_associados})
                    </Button>
                    <Button
                      variant={filter === 'estagiarios' ? 'default' : 'outline'}
                      onClick={() => setFilter('estagiarios')}
                      size="sm"
                      className="w-full"
                    >
                      <GraduationCap className="h-4 w-4 mr-1" />
                      Estagiários ({stats.estagiarios})
                    </Button>
                    <Button
                      variant={filter === 'coordenadores' ? 'default' : 'outline'}
                      onClick={() => setFilter('coordenadores')}
                      size="sm"
                      className="w-full"
                    >
                      <Crown className="h-4 w-4 mr-1" />
                      Coordenadores ({stats.coordenadores})
                    </Button>
                    <Button
                      variant={filter === 'admins' ? 'default' : 'outline'}
                      onClick={() => setFilter('admins')}
                      size="sm"
                      className="w-full"
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Administradores ({stats.admins})
                    </Button>
                    <Button
                      variant={filter === 'revogados' ? 'default' : 'outline'}
                      onClick={() => setFilter('revogados')}
                      size="sm"
                      className="w-full"
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Revogados ({stats.revogados})
                    </Button>
                    <Button
                      variant={filter === 'todos' ? 'default' : 'outline'}
                      onClick={() => setFilter('todos')}
                      size="sm"
                      className="w-full"
                    >
                      Todos ({stats.total})
                    </Button>
                  </div>
                </div>

                {/* Lista de usuários */}
                <div className="space-y-4">
                  {!visualizacaoPorSetores ? (
                    // VISUALIZAÇÃO NORMAL (Lista única)
                    <>
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
                                  {usuario.aprovado_admin && usuario.email_verificado && usuario.ativo !== false && usuario.tipo_colaborador !== 'estagiario' && (
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
                    </>
                  ) : (
                    // VISUALIZAÇÃO POR SETORES (Agrupado)
                    <>
                      {setoresFiltrados.length === 0 ? (
                        <Card>
                          <CardContent className="p-8 text-center">
                            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                              Nenhum setor encontrado
                            </h3>
                            <p className="text-gray-500">
                              Não há setores que correspondam aos filtros selecionados.
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        setoresFiltrados.map((setor) => {
                          const usuariosDoSetor = usuariosAgrupadosPorSetor[setor].filter(usuario => {
                            const passaBusca = searchTerm === '' || 
                              usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              usuario.email_login.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              usuario.setor.toLowerCase().includes(searchTerm.toLowerCase());

                            const passaFiltroTipo = (() => {
                              switch (filter) {
                                case 'pendentes_aprovacao':
                                  return isPendenteAprovacao(usuario);
                                case 'pendentes_verificacao':
                                  return isPendenteVerificacao(usuario) && !isPendenteAprovacao(usuario);
                                case 'corporativos':
                                  return usuario.tipo_colaborador === 'clt_associado' && !isPendenteVerificacao(usuario);
                                case 'estagiarios':
                                  return usuario.tipo_colaborador === 'estagiario' && !isPendenteAprovacao(usuario) && !isPendenteVerificacao(usuario);
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

                            return passaBusca && passaFiltroTipo;
                          });

                          return (
                            <Card key={setor} className="mb-6">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div>
                                      <CardTitle className="text-xl text-primary">{setor}</CardTitle>
                                      <p className="text-sm text-gray-600 mt-1">
                                        {usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'usuário' : 'usuários'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Estatísticas rápidas do setor */}
                                  <div className="flex space-x-4 text-sm">
                                    <div className="text-center">
                                      <p className="text-2xl font-bold text-rmh-primary">
                                        {usuariosDoSetor.filter(u => u.tipo_colaborador === 'estagiario' && !isPendenteAprovacao(u) && !isPendenteVerificacao(u)).length}
                                      </p>
                                      <p className="text-gray-500">Estagiários</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-2xl font-bold text-rmh-primary">
                                        {usuariosDoSetor.filter(u => u.tipo_colaborador === 'clt_associado' && !isPendenteVerificacao(u)).length}
                                      </p>
                                      <p className="text-gray-500">CLT</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-2xl font-bold text-rmh-primary">
                                        {usuariosDoSetor.filter(u => u.is_coordenador).length}
                                      </p>
                                      <p className="text-gray-500">Coordenador</p>
                                    </div>
                                  </div>
                                </div>
                              </CardHeader>
                              
                              <CardContent className="space-y-3">
                                {usuariosDoSetor.map((usuario) => (
                                  <div key={usuario.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2">
                                            <h4 className="font-medium">{usuario.nome}</h4>
                                            {getStatusBadge(usuario)}
                                          </div>
                                          <p className="text-sm text-gray-600 mt-1">
                                            {usuario.email_login} • {usuario.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-2">
                                        {/* Botões iguais aos da visualização normal */}
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

                                        {usuario.aprovado_admin && usuario.email_verificado && usuario.ativo !== false && usuario.tipo_colaborador !== 'estagiario' && (
                                          <>
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
                                              {usuario.is_coordenador ? 'Remover' : 'Coordenador'}
                                            </Button>

                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => abrirModalEdicao(usuario)}
                                              className="text-blue-600 hover:text-blue-700"
                                            >
                                              <Edit className="h-4 w-4 mr-1" />
                                              Editar
                                            </Button>

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
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ABA 2: VERIFICAÇÕES & TOKENS */}
              <TabsContent value="verificacoes" className="space-y-6">
                <TokensExpiradosSection 
                  activeTab={activeTab}
                  fetchWithAuth={fetchWithAuth}
                  toast={toast}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

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
            <div className="space-y-2">
              <Label htmlFor="nova_senha">Senha Inicial</Label>
              <Input
                id="nova_senha"
                type="password"
                value={novoUsuarioData.nova_senha || ''}
                onChange={(e) => setNovoUsuarioData(prev => ({ ...prev, nova_senha: e.target.value }))}
                placeholder="Deixe vazio para gerar automaticamente"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalNovoUsuario(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={adicionarUsuario}
              disabled={!novoUsuarioData.nome || !novoUsuarioData.email_pessoal || !novoUsuarioData.setor}
              className="bg-rmh-lightGreen hover:bg-rmh-primary"
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
            <div className="space-y-2">
              <Label htmlFor="edit_nova_senha">Nova Senha</Label>
              <Input
                id="edit_nova_senha"
                type="password"
                value={editarUsuarioData.nova_senha || ''}
                onChange={(e) => setEditarUsuarioData(prev => ({ ...prev, nova_senha: e.target.value }))}
                placeholder="Deixe vazio para manter a atual"
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
                  {(() => {
                    const usuarioAtual = usuarios.find(u => u.id === usuarioParaPromover?.id);
                    const coordenadorExistente = usuarios.find(u => 
                      u.setor === usuarioAtual?.setor && 
                      u.is_coordenador === true && 
                      u.id !== usuarioParaPromover?.id
                    );
                    
                    return coordenadorExistente ? (
                      <span className="text-orange-600 font-medium">
                        ⚠️ Isso removerá automaticamente a coordenação de {coordenadorExistente.nome}.
                      </span>
                    ) : (
                      "Isso permitirá que ele tenha acesso aos dashboards restritos do setor."
                    );
                  })()}
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
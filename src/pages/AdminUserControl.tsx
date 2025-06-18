// src/pages/AdminUserControl.tsx - COM MODAIS PERSONALIZADOS E BOTÃO VOLTAR
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // IMPORTAÇÃO ADICIONADA
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  ArrowLeft // ÍCONE ADICIONADO
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// 🔧 IMPORTANDO TIPOS CENTRALIZADOS
import { 
  Usuario, 
  UsuariosStats, 
  isPendenteAprovacao,
  getUserStatus,
  UsuariosResponse 
} from '@/types';

// Configuração da API
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://rmh.up.railway.app'
    : 'http://localhost:3001');

const AdminUserControl: React.FC = () => {
  const navigate = useNavigate(); // HOOK ADICIONADO
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsuariosStats>({
    total: 0,
    pendentes_aprovacao: 0,
    nao_verificados: 0,
    admins: 0
  });
  const [filter, setFilter] = useState<'todos' | 'pendentes' | 'corporativos' | 'estagiarios' | 'admins'>('pendentes');
  
  // 🆕 ESTADOS PARA MODAIS
  const [usuarioParaRejeitar, setUsuarioParaRejeitar] = useState<{id: string, nome: string} | null>(null);
  const [usuarioParaAprovar, setUsuarioParaAprovar] = useState<{id: string, nome: string} | null>(null);
  
  const { toast } = useToast();

  // Função para obter token corretamente
  const getAuthToken = (): string | null => {
    const token = localStorage.getItem('authToken');
    return token;
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
      
      setStats({
        total: usuarios.length,
        pendentes_aprovacao: pendentes,
        nao_verificados: naoVerificados,
        admins: admins
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

  // 🆕 FUNÇÕES PARA ABRIR MODAIS
  const abrirModalAprovacao = (userId: string, nomeUsuario: string) => {
    setUsuarioParaAprovar({ id: userId, nome: nomeUsuario });
  };

  const abrirModalRejeicao = (userId: string, nomeUsuario: string) => {
    setUsuarioParaRejeitar({ id: userId, nome: nomeUsuario });
  };

  // 🆕 FUNÇÃO DE APROVAÇÃO COM MODAL
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

      const data = await response.json();
      
      toast({
        title: "✅ Usuário aprovado!",
        description: data.message,
        variant: "default"
      });

      fetchUsuarios();
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

  // 🆕 FUNÇÃO DE REJEIÇÃO COM MODAL
  const rejeitarUsuario = async () => {
    if (!usuarioParaRejeitar) return;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/rejeitar-usuario/${usuarioParaRejeitar.id}`, {
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

      fetchUsuarios();
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

  const capitalizeText = (text: string): string => {
    if (!text) return '';
    
    const exceptions = ['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'del', 'della', 'von', 'van', 'du'];
    
    return text
      .trim()
      .split(' ')
      .filter(word => word.length > 0)
      .map((word, index) => {
        const lowerWord = word.toLowerCase();
        
        if (index === 0) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }
        
        if (exceptions.includes(lowerWord)) {
          return lowerWord;
        }
        
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const getStatusBadge = (usuario: Usuario) => {
    if (usuario.tipo_usuario === 'admin') {
      return (
        <Badge variant="default" className="bg-purple-600">
          <Crown className="h-3 w-3 mr-1" />
          Administrador
        </Badge>
      );
    }

    if (usuario.tipo_colaborador === 'clt_associado') {
      if (usuario.email_verificado) {
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            CLT Verificado
          </Badge>
        );
      } else {
        return (
          <Badge variant="secondary" className="bg-rmh-primary text-white">
            <UserLock className="h-3 w-3 mr-1" />
            CLT Pendente
          </Badge>
        );
      }
    }

    if (usuario.tipo_colaborador === 'estagiario') {
      if (usuario.status === 'pendente_aprovacao' || !usuario.aprovado_admin) {
        return (
          <Badge className="bg-rmh-yellow text-white hover:bg-rmh-yellow">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando Aprovação
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
      
      if (usuario.aprovado_admin && usuario.email_verificado) {
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Estagiário Verificado
          </Badge>
        );
      }
    }

    return (
      <Badge variant="secondary" className="bg-gray-500 text-white">
        <Clock className="h-3 w-3 mr-1" />
        Status Indefinido
      </Badge>
    );
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    switch (filter) {
      case 'pendentes':
        return isPendenteAprovacao(usuario);
      case 'corporativos':
        return usuario.tipo_colaborador === 'clt_associado';
      case 'estagiarios':
        return usuario.tipo_colaborador === 'estagiario';
      case 'admins':
        return usuario.tipo_usuario === 'admin';
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header COM BOTÃO VOLTAR */}
      <div className="space-y-4">
        {/* BOTÃO VOLTAR ADICIONADO */}
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
            <p className="text-gray-600">Gerencie cadastros e aprovações de usuários</p>
          </div>
          <Button onClick={fetchUsuarios} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Administradores</p>
                <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
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
          <Crown className="h-4 w-4 mr-1" />
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
                    <h3 className="text-lg font-medium">{capitalizeText(usuario.nome)}</h3>
                    {getStatusBadge(usuario)}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Setor:</strong> {usuario.setor}</p>
                    <p><strong>Email:</strong> {usuario.email_login}</p>
                    <p><strong>Cadastrado:</strong> {new Date(usuario.criado_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                {/* 🆕 AÇÕES COM MODAIS */}
                <div className="flex space-x-2">
                  {isPendenteAprovacao(usuario) && (
                    <>
                      <Button
                        onClick={() => abrirModalAprovacao(usuario.id, usuario.nome)}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => abrirModalRejeicao(usuario.id, usuario.nome)}
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

      {/* 🆕 MODAL DE CONFIRMAÇÃO DE APROVAÇÃO */}
      <AlertDialog open={!!usuarioParaAprovar} onOpenChange={() => setUsuarioParaAprovar(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-600">
              <UserCheck className="h-5 w-5" />
              Confirmar Aprovação
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Confirma a <strong>APROVAÇÃO</strong> do cadastro de{' '}
              <span className="font-semibold text-gray-900">
                {usuarioParaAprovar?.nome}
              </span>?
              <br /><br />
              <span className="text-green-600 font-medium">
                📧 Um código de verificação será enviado por email para o usuário.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => setUsuarioParaAprovar(null)}
              className="bg-gray-100 hover:bg-gray-200"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={aprovarUsuario}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Sim, Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 MODAL DE CONFIRMAÇÃO DE REJEIÇÃO */}
      <AlertDialog open={!!usuarioParaRejeitar} onOpenChange={() => setUsuarioParaRejeitar(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <UserX className="h-5 w-5" />
              Confirmar Rejeição
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Tem certeza que deseja <strong>REJEITAR</strong> o cadastro de{' '}
              <span className="font-semibold text-gray-900">
                {usuarioParaRejeitar?.nome}
              </span>?
              <br /><br />
              <span className="text-red-600 font-medium">
                ⚠️ Esta ação não pode ser desfeita e o usuário será removido permanentemente do sistema.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => setUsuarioParaRejeitar(null)}
              className="bg-gray-100 hover:bg-gray-200"
            >
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
    </div>
  );
};

export default AdminUserControl;
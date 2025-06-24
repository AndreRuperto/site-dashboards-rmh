// TokensExpiradosTab.tsx - Versão Simplificada
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  RefreshCw, 
  Trash2, 
  Mail, 
  CheckSquare,
  Square,
  Calendar,
  Send
} from 'lucide-react';

// ✅ TIPOS SIMPLIFICADOS
interface UsuarioComProblema {
  id: string;
  nome: string;
  email_login: string;
  setor: string;
  tipo_colaborador: 'estagiario' | 'clt_associado';
  criado_em: string;
  status_token: 'sem_codigo' | 'codigo_expirado' | 'codigo_ativo' | 'token_expirado_limpo';
  dias_desde_criacao: number;
  dias_expirado: number;
  pode_reenviar: boolean;
  observacoes?: string;
  explicacao_estado?: string;
}

interface TokensExpiradosProps {
  API_BASE_URL: string;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

export const TokensExpiradosTab: React.FC<TokensExpiradosProps> = ({ 
  API_BASE_URL, 
  fetchWithAuth 
}) => {
  const [usuarios, setUsuarios] = useState<UsuarioComProblema[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();

  const fetchUsuariosComProblemas = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/usuarios-tokens-expirados`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários com problemas');
      }

      const data = await response.json();
      setUsuarios(data.usuarios || []);
      
    } catch (error) {
      console.error('❌ Erro ao carregar usuários com problemas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar usuários com problemas de token",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuariosComProblemas();
  }, []);

  const reenviarCodigo = async (userId: string): Promise<void> => {
    setActionLoading(prev => new Set(prev).add(userId));
    
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/reenviar-codigo-problema/${userId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error: { error: string } = await response.json();
        throw new Error(error.error || 'Erro ao reenviar código');
      }

      const data = await response.json();
      
      toast({
        title: "✅ Código reenviado!",
        description: `${data.tipo_envio === 'link' ? 'Link' : 'Código'} enviado para ${data.email_enviado_para}`,
        variant: "default"
      });

      await fetchUsuariosComProblemas();
      
    } catch (error) {
      console.error('❌ Erro ao reenviar código:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível reenviar o código",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const excluirUsuario = async (userId: string): Promise<void> => {
    if (!confirm('Tem certeza que deseja excluir este usuário definitivamente?')) return;
    
    setActionLoading(prev => new Set(prev).add(userId));
    
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/excluir-usuario-problema/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: 'Exclusão manual via painel admin' })
      });

      if (!response.ok) {
        const error: { error: string } = await response.json();
        throw new Error(error.error || 'Erro ao excluir usuário');
      }

      toast({
        title: "✅ Usuário excluído!",
        description: "Usuário removido definitivamente do sistema",
        variant: "default"
      });

      await fetchUsuariosComProblemas();
      
    } catch (error) {
      console.error('❌ Erro ao excluir usuário:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir o usuário",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const excluirSelecionados = async (): Promise<void> => {
    if (selecionados.size === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${selecionados.size} usuários definitivamente?`)) return;
    
    setLoading(true);
    
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/admin/excluir-lote-problemas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userIds: Array.from(selecionados),
          motivo: 'Exclusão em lote via painel admin'
        })
      });

      if (!response.ok) {
        const error: { error: string } = await response.json();
        throw new Error(error.error || 'Erro na exclusão em lote');
      }

      const data = await response.json();
      
      toast({
        title: "✅ Exclusão em lote concluída!",
        description: `${data.usuarios_excluidos} usuários removidos definitivamente`,
        variant: "default"
      });

      setSelecionados(new Set());
      await fetchUsuariosComProblemas();
      
    } catch (error) {
      console.error('❌ Erro na exclusão em lote:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro na exclusão em lote",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelecionado = (userId: string): void => {
    setSelecionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selecionarTodos = (): void => {
    if (selecionados.size === usuarios.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(usuarios.map(u => u.id)));
    }
  };

  const getStatusBadge = (status: string): JSX.Element => {
    switch (status) {
      case 'token_expirado_limpo':
        return <Badge variant="destructive">Token Removido</Badge>;
      case 'codigo_expirado':
        return <Badge variant="secondary" className="bg-orange-600">Token Expirado</Badge>;
      case 'sem_codigo':
        return <Badge variant="outline">Sem Token</Badge>;
      case 'codigo_ativo':
        return <Badge variant="default" className="bg-green-600">Token Ativo</Badge>;
      default:
        return <Badge variant="outline">❓ Indefinido</Badge>;
    }
  };

  // Loading state
  if (loading && usuarios.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando usuários com problemas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ações em lote */}
      {usuarios.length > 0 && (
        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={selecionarTodos}
              className="flex items-center gap-2"
            >
              {selecionados.size === usuarios.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selecionados.size === usuarios.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </Button>
            
            {selecionados.size > 0 && (
              <span className="text-sm text-gray-600">
                {selecionados.size} selecionado(s)
              </span>
            )}
          </div>

          {selecionados.size > 0 && (
            <Button
              onClick={excluirSelecionados}
              variant="destructive"
              size="sm"
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Selecionados ({selecionados.size})
            </Button>
          )}
        </div>
      )}

      {/* Lista de usuários */}
      {usuarios.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-green-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              🎉 Nenhum problema encontrado!
            </h3>
            <p className="text-gray-600">
              Todos os usuários têm tokens válidos ou já foram verificados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {usuarios.map((usuario) => (
            <Card key={usuario.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelecionado(usuario.id)}
                      className="mt-1"
                    >
                      {selecionados.has(usuario.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {/* Informações do usuário */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{usuario.nome}</h4>
                        {getStatusBadge(usuario.status_token)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          usuario.tipo_colaborador === 'estagiario' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {usuario.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{usuario.email_login}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Criado há {Math.floor(usuario.dias_desde_criacao)} dia(s)</span>
                          </div>
                          <span>{usuario.setor}</span>
                        </div>
                        
                        {usuario.dias_expirado > 0 && (
                          <div className="text-red-600 text-xs">
                            Token expirou há {usuario.dias_expirado} dia(s)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2">
                    {usuario.pode_reenviar && (
                      <Button
                        onClick={() => reenviarCodigo(usuario.id)}
                        disabled={actionLoading.has(usuario.id)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        {actionLoading.has(usuario.id) ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Reenviar
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => excluirUsuario(usuario.id)}
                      disabled={actionLoading.has(usuario.id)}
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {actionLoading.has(usuario.id) ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
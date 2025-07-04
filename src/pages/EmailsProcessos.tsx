import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Header from '@/components/Header'; // ✅ ADICIONADO O IMPORT DO HEADER
import { 
  Mail, 
  Send, 
  CheckSquare, 
  Square, 
  Filter, 
  Search,
  Calendar,
  FileText,
  User,
  Clock,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Eye,
  Phone,
  Building,
  Scale,
  ArrowLeft,
  Users,
  TrendingUp,
  BarChart3,
  Plus,
  Settings
} from 'lucide-react';

// Configurações da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Interface para os dados dos processos
interface ProcessoData {
  id: number;
  idProcessoPlanilha: string;
  numeroProcesso: string;
  cpfAssistido: string;
  cliente: string;
  emailCliente: string;
  telefones: string;
  idAtendimento: string;
  tipoProcesso: string;
  dataAjuizamento: string;
  exAdverso: string;
  instancia: string;
  objetoAtendimento: string;
  valorCausa: string;
  observacoes: string;
  emailEnviado: boolean;
  dataUltimoEmail: string | null;
  status: string;
  ultimoAndamento: string;
  responsavel: string;
  origem: string;
}

const EmailsProcessos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [processos, setProcessos] = useState<ProcessoData[]>([]);
  const [processosSelecionados, setProcessosSelecionados] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroEmail, setFiltroEmail] = useState('todos');
  const [filtroPessoa, setFiltroPessoa] = useState('todos');
  const [termoBusca, setTermoBusca] = useState('');
  const [processoDetalhado, setProcessoDetalhado] = useState<ProcessoData | null>(null);
  const { toast } = useToast();

  // ✅ VERIFICAR PERMISSÕES - Só protocolo pode enviar emails
  const podeEnviarEmails = user?.setor?.toLowerCase().includes('protocolo') || user?.tipo_usuario === 'admin';

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

  // Carregar dados da planilha
  const carregarProcessos = async () => {
    try {
      setCarregandoInicial(true);
      console.log('📊 Carregando dados dos processos da planilha...');
      
      const response = await fetchWithAuth(`${API_BASE_URL}/api/processos/planilha`);
      
      if (!response.ok) {
        throw new Error("Erro ao carregar dados dos processos");
      }

      const data = await response.json();
      setProcessos(data.processos || []);
      
      console.log(`✅ ${data.processos?.length || 0} processos carregados`);
      
      toast({
        title: "Dados atualizados!",
        description: `${data.processos?.length || 0} processos carregados da planilha`,
      });
    } catch (error) {
      console.error("❌ Erro ao carregar processos:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Verifique a conexão com a planilha.",
        variant: "destructive"
      });
    } finally {
      setCarregandoInicial(false);
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    carregarProcessos();
  }, []);

  // Estatísticas
  const stats = {
    total: processos.length,
    comEmail: processos.filter(p => p.emailEnviado).length,
    semEmail: processos.filter(p => !p.emailEnviado).length,
    emAndamento: processos.filter(p => p.status === 'Em Andamento').length,
    deferidos: processos.filter(p => p.status === 'Deferido').length,
    indeferidos: processos.filter(p => p.status === 'Indeferido').length,
    emailsHoje: processos.filter(p => 
      p.dataUltimoEmail && 
      new Date(p.dataUltimoEmail).toDateString() === new Date().toDateString()
    ).length
  };

  // Obter setores únicos dos processos
  const setoresUnicos = [...new Set(processos.map(p => p.tipoProcesso).filter(Boolean))];
  
  // Obter responsáveis únicos
  const responsaveisUnicos = [...new Set(processos.map(p => p.responsavel).filter(Boolean))];

  // Filtrar processos
  const processosFiltrados = processos.filter(processo => {
    const matchSetor = filtroSetor === 'todos' || processo.tipoProcesso === filtroSetor;
    const matchStatus = filtroStatus === 'todos' || processo.status === filtroStatus;
    const matchEmail = filtroEmail === 'todos' || 
      (filtroEmail === 'enviado' && processo.emailEnviado) ||
      (filtroEmail === 'nao_enviado' && !processo.emailEnviado);
    const matchPessoa = filtroPessoa === 'todos' || processo.responsavel === filtroPessoa;
    const matchBusca = termoBusca === '' || 
      processo.cliente.toLowerCase().includes(termoBusca.toLowerCase()) ||
      processo.numeroProcesso.toLowerCase().includes(termoBusca.toLowerCase()) ||
      processo.tipoProcesso.toLowerCase().includes(termoBusca.toLowerCase());
    
    return matchSetor && matchStatus && matchEmail && matchPessoa && matchBusca;
  });

  // Funções de seleção (só para protocolo)
  const toggleSelecionarTodos = () => {
    if (!podeEnviarEmails) return;
    
    if (processosSelecionados.length === processosFiltrados.length) {
      setProcessosSelecionados([]);
    } else {
      setProcessosSelecionados(processosFiltrados.map(p => p.id));
    }
  };

  const toggleSelecionarProcesso = (id: number) => {
    if (!podeEnviarEmails) return;
    
    setProcessosSelecionados(prev => 
      prev.includes(id) 
        ? prev.filter(pid => pid !== id)
        : [...prev, id]
    );
  };

  // Validar email
  const validarEmail = (email: string): boolean => {
    if (!email || !email.includes('@')) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Enviar email individual (só protocolo)
  const enviarEmailIndividual = async (processo: ProcessoData) => {
    if (!podeEnviarEmails) {
      toast({
        title: "Acesso negado",
        description: "Apenas o setor de protocolo pode enviar emails",
        variant: "destructive"
      });
      return;
    }

    setCarregando(true);
    try {
      const dadosEmail = {
        idProcessoPlanilha: processo.idProcessoPlanilha,
        numeroProcesso: processo.numeroProcesso,
        cliente: processo.cliente,
        emailCliente: processo.emailCliente,
        tipoProcesso: processo.tipoProcesso,
        status: processo.status,
        ultimoAndamento: processo.ultimoAndamento,
        responsavel: processo.responsavel || processo.exAdverso,
        observacoes: processo.observacoes,
        cpfAssistido: processo.cpfAssistido,
        instancia: processo.instancia,
        exAdverso: processo.exAdverso,
        objetoAtendimento: processo.objetoAtendimento
      };
      
      const response = await fetchWithAuth(`${API_BASE_URL}/api/emails/processo/${processo.id}`, {
        method: 'POST',
        body: JSON.stringify(dadosEmail)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao enviar email");
      }

      // Recarregar dados após enviar
      await carregarProcessos();

      toast({
        title: "Email enviado com sucesso!",
        description: `Email sobre o processo ${processo.numeroProcesso} foi enviado para ${processo.cliente}`,
      });
    } catch (error) {
      console.error("❌ Erro ao enviar email:", error);
      toast({
        title: "Erro ao enviar email",
        description: error instanceof Error ? error.message : "Não foi possível enviar o email. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setCarregando(false);
    }
  };

  // Enviar emails em massa (só protocolo)
  const enviarEmailsEmMassa = async () => {
    if (!podeEnviarEmails) {
      toast({
        title: "Acesso negado",
        description: "Apenas o setor de protocolo pode enviar emails",
        variant: "destructive"
      });
      return;
    }

    if (processosSelecionados.length === 0) {
      toast({
        title: "Nenhum processo selecionado",
        description: "Selecione pelo menos um processo para enviar emails",
        variant: "destructive"
      });
      return;
    }

    const processosParaEnviar = processos.filter(p => processosSelecionados.includes(p.id));
    const processosComEmailValido = processosParaEnviar.filter(p => validarEmail(p.emailCliente));

    if (processosComEmailValido.length === 0) {
      toast({
        title: "Nenhum email válido encontrado",
        description: "Os processos selecionados não possuem emails válidos",
        variant: "destructive"
      });
      return;
    }

    setCarregando(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/emails/massa`, {
        method: 'POST',
        body: JSON.stringify({
          processos: processosComEmailValido.map(p => ({
            id: p.id,
            idProcessoPlanilha: p.idProcessoPlanilha,
            numeroProcesso: p.numeroProcesso,
            cliente: p.cliente,
            emailCliente: p.emailCliente,
            tipoProcesso: p.tipoProcesso,
            status: p.status,
            ultimoAndamento: p.ultimoAndamento,
            responsavel: p.responsavel,
            observacoes: p.observacoes,
            cpfAssistido: p.cpfAssistido,
            instancia: p.instancia,
            exAdverso: p.exAdverso,
            objetoAtendimento: p.objetoAtendimento,
            valorCausa: p.valorCausa || ''
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao enviar emails");
      }

      const result = await response.json();
      
      // Recarregar dados após enviar
      await carregarProcessos();
      setProcessosSelecionados([]);

      toast({
        title: "Emails enviados com sucesso!",
        description: `${result.enviados || processosComEmailValido.length} email(s) enviados. ${result.movimentacoes || 0} processo(s) movidos para aba enviados.`,
      });
    } catch (error) {
      console.error("❌ Erro ao enviar emails em massa:", error);
      toast({
        title: "Erro ao enviar emails",
        description: error instanceof Error ? error.message : "Não foi possível enviar os emails. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setCarregando(false);
    }
  };

  // Renderizar loading inicial
  if (carregandoInicial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-600" />
            <span className="text-lg font-medium text-gray-700">Carregando processos...</span>
          </div>
          <div className="text-sm text-gray-500">Por favor, aguarde um momento</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ HEADER ADICIONADO IGUAL AO DA PÁGINA DE DASHBOARDS */}
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* ✅ HEADER SECTION NO MESMO ESTILO DA PÁGINA DE DASHBOARDS */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <h1 className="text-3xl font-heading font-bold text-rmh-primary">
                Controle de Emails - Processos
              </h1>
              <p className="text-corporate-gray mt-1">
                Visualize e gerencie o envio de emails sobre processos ajuizados
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={carregarProcessos}
                variant="outline"
                disabled={carregandoInicial}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${carregandoInicial ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtrar Processos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome do processo</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cliente, processo ou tipo..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Setor</label>
                  <select
                    value={filtroSetor}
                    onChange={(e) => setFiltroSetor(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="todos">Todos os setores</option>
                    {setoresUnicos.map(setor => (
                      <option key={setor} value={setor}>{setor}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    value={filtroEmail}
                    onChange={(e) => setFiltroEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="todos">Todos</option>
                    <option value="enviado">Email Enviado</option>
                    <option value="nao_enviado">Email Não Enviado</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total de processos</p>
                    <p className="text-xl font-bold text-gray">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Emails Enviados</p>
                    <p className="text-xl font-bold text-gray-600">{stats.comEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Emails Pendentes</p>
                    <p className="text-xl font-bold text-gray-600">{stats.semEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ações em massa - só para protocolo */}
          {podeEnviarEmails && processosSelecionados.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{processosSelecionados.length} processo(s) selecionado(s)</span>
                <Button
                  onClick={enviarEmailsEmMassa}
                  disabled={carregando}
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Emails em Massa
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Aviso para não-protocolo */}
          {!podeEnviarEmails && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Visualização:</strong> Você pode consultar o status dos emails, mas apenas o setor de protocolo pode enviar emails.
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de Processos Resumida */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Processos ({processosFiltrados.length})
                </CardTitle>
                {podeEnviarEmails && (
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={toggleSelecionarTodos}
                      variant="outline"
                      size="sm"
                    >
                      {processosSelecionados.length === processosFiltrados.length ? (
                        <>
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Desmarcar Todos
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Selecionar Todos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processosFiltrados.map((processo) => (
                  <div
                    key={processo.id}
                    className={`border rounded-lg p-4 transition-all ${
                      processosSelecionados.includes(processo.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {podeEnviarEmails && (
                          <input
                            type="checkbox"
                            checked={processosSelecionados.includes(processo.id)}
                            onChange={() => toggleSelecionarProcesso(processo.id)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{processo.cliente}</h3>
                            {processo.emailEnviado ? (
                              <Badge className="bg-green-100 hover:bg-green-100 text-green-800">
                                <Mail className="h-3 w-3 mr-1" />
                                Email Enviado
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 hover:bg-red-100 text-red-800">
                                <Clock className="h-3 w-3 mr-1" />
                                Email Pendente
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                            <div>
                              <strong>Número:</strong> {processo.numeroProcesso}
                            </div>
                            <div>
                              <strong>Email:</strong> {processo.emailCliente}
                            </div>
                            <div>
                              <strong>Natureza:</strong> {processo.tipoProcesso}
                            </div>
                            <div>
                              <strong>Ajuizamento:</strong> {processo.dataAjuizamento}
                            </div>
                          </div>
                          
                          {processo.dataUltimoEmail && (
                            <div className="mt-2 text-xs text-green-600">
                              Último email enviado em: {processo.dataUltimoEmail}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => setProcessoDetalhado(processo)}
                          size="sm"
                          variant="outline"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        {podeEnviarEmails && (
                          <Button
                            onClick={() => enviarEmailIndividual(processo)}
                            disabled={carregando}
                            size="sm"
                            variant={processo.emailEnviado ? "outline" : "default"}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {processo.emailEnviado ? 'Reenviar' : 'Enviar'} Email
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {processosFiltrados.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum processo encontrado com os filtros aplicados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modal de Detalhes */}
      <Dialog open={!!processoDetalhado} onOpenChange={() => setProcessoDetalhado(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Processo - {processoDetalhado?.cliente}
            </DialogTitle>
          </DialogHeader>
          
          {processoDetalhado && (
            <div className="space-y-6">
              {/* Informações principais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="h-5 w-5" />
                      Dados do Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Telefones</label>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {processoDetalhado.telefones}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Mail className="h-5 w-5" />
                      Controle de Email
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status do Email</label>
                      <div className="flex items-center gap-2">
                        {processoDetalhado.emailEnviado ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Email Enviado
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Email Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                    {processoDetalhado.dataUltimoEmail && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Data do Último Envio</label>
                        <p className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {processoDetalhado.dataUltimoEmail}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Origem</label>
                      <p>{processoDetalhado.origem === 'enviados' ? 'Aba Enviados' : 'Aba Pendentes'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dados do Processo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Scale className="h-5 w-5" />
                    Dados do Processo
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID do Processo</label>
                    <p className="font-mono text-sm">{processoDetalhado.idProcessoPlanilha}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Número Único</label>
                    <p className="font-mono text-sm">{processoDetalhado.numeroProcesso}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID Atendimento</label>
                    <p className="font-mono text-sm">{processoDetalhado.idAtendimento}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Natureza</label>
                    <p>{processoDetalhado.tipoProcesso}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data de Autuação</label>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {processoDetalhado.dataAjuizamento}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Instância</label>
                    <p>{processoDetalhado.instancia}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Objeto do Atendimento */}
              {processoDetalhado.objetoAtendimento && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      Objeto do Atendimento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed">
                      {processoDetalhado.objetoAtendimento}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Informações Adicionais */}
              {(processoDetalhado.exAdverso || processoDetalhado.responsavel || processoDetalhado.observacoes) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building className="h-5 w-5" />
                      Informações Adicionais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {processoDetalhado.exAdverso && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Ex-adverso</label>
                        <p>{processoDetalhado.exAdverso}</p>
                      </div>
                    )}
                    {processoDetalhado.responsavel && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Responsável</label>
                        <p>{processoDetalhado.responsavel}</p>
                      </div>
                    )}
                    {processoDetalhado.observacoes && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Observações</label>
                        <p className="text-gray-700 leading-relaxed">{processoDetalhado.observacoes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Ações */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  onClick={() => setProcessoDetalhado(null)}
                  variant="outline"
                >
                  Fechar
                </Button>
                {podeEnviarEmails && (
                  <Button
                    onClick={() => {
                      enviarEmailIndividual(processoDetalhado);
                      setProcessoDetalhado(null);
                    }}
                    disabled={carregando}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {processoDetalhado.emailEnviado ? 'Reenviar Email' : 'Enviar Email'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailsProcessos
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Download,
  RefreshCw
} from 'lucide-react';

// Configurações da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? "https://sistema.resendemh.com.br" 
  : "http://localhost:3001"
const PLANILHA_ID = "1Og951U-NWhx_Hmi3CcKa8hu5sh3RJuCAR37HespiEe0";

// Interface para os dados dos processos
interface ProcessoData {
  // Campos principais da planilha
  id: number;
  idProcessoPlanilha: string;        // A: ID original da planilha
  numeroProcesso: string;            // B: Número único do processo
  cpfAssistido: string;              // C: CPF do assistido
  cliente: string;                   // D: Nome do assistido (cliente)
  emailCliente: string;              // E: Email
  telefones: string;                 // F: Telefones
  idAtendimento: string;             // G: ID do atendimento vinculado
  tipoProcesso: string;              // H: Natureza do processo (tipo)
  dataAjuizamento: string;           // I: Data de autuação
  exAdverso: string;                 // J: Ex-adverso (responsável/réu)
  instancia: string;                 // K: Instância
  objetoAtendimento: string;         // L: Objeto do atendimento
  observacoes: string;               // M: Observações
  
  // Campos de controle de email
  emailEnviado: boolean;
  dataUltimoEmail: string | null;
  
  // Campos derivados para compatibilidade
  status: string;                    // Derivado do tipo e data
  ultimoAndamento: string;           // Usa data de autuação
  responsavel: string;               // Processado do exAdverso
}

const ControleEmailsProcessos = () => {
  const [processos, setProcessos] = useState<ProcessoData[]>([]);
  const [processosSelecionados, setProcessosSelecionados] = useState<number[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroEmail, setFiltroEmail] = useState('todos');
  const [termoBusca, setTermoBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
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
      
      // Fallback para dados de demonstração em caso de erro
      const processosDemonstracao: ProcessoData[] = [
        {
            // ✅ Campos básicos
            id: 1,
            idProcessoPlanilha: "235217", // ✅ ADICIONAR
            numeroProcesso: "5001234-12.2024.4.03.6109",
            cpfAssistido: "001.141.666-17", // ✅ ADICIONAR
            cliente: "Maria Silva Santos",
            emailCliente: "maria.silva@email.com",
            telefones: "61 9956-4645", // ✅ ADICIONAR
            idAtendimento: "340765", // ✅ ADICIONAR
            tipoProcesso: "Aposentadoria por Invalidez",
            dataAjuizamento: "2024-03-15",
            exAdverso: "INSS - Instituto Nacional do Seguro Social", // ✅ ADICIONAR
            instancia: "1ª Instância", // ✅ ADICIONAR
            objetoAtendimento: "Aposentadoria por Invalidez", // ✅ ADICIONAR
            observacoes: "Aguardando perícia médica",
            
            // ✅ Campos de controle de email
            emailEnviado: false,
            dataUltimoEmail: null,
            
            // ✅ Campos derivados
            status: "Em Andamento",
            ultimoAndamento: "2024-06-20",
            responsavel: "INSS - Instituto Nacional do Seguro Social"
        },
        {
            // ✅ Campos básicos
            id: 2,
            idProcessoPlanilha: "235218", // ✅ ADICIONAR
            numeroProcesso: "5001235-43.2024.4.03.6109",
            cpfAssistido: "538.878.321-91", // ✅ ADICIONAR
            cliente: "José Carlos Oliveira",
            emailCliente: "jose.carlos@empresa.com",
            telefones: "61 981123123", // ✅ ADICIONAR
            idAtendimento: "196839", // ✅ ADICIONAR
            tipoProcesso: "Auxílio-Doença",
            dataAjuizamento: "2024-02-10",
            exAdverso: "INSS - Instituto Nacional do Seguro Social", // ✅ ADICIONAR
            instancia: "2ª Instância", // ✅ ADICIONAR
            objetoAtendimento: "Auxílio-Doença", // ✅ ADICIONAR
            observacoes: "Benefício concedido",
            
            // ✅ Campos de controle de email
            emailEnviado: true,
            dataUltimoEmail: "2024-06-25",
            
            // ✅ Campos derivados
            status: "Deferido",
            ultimoAndamento: "2024-06-25",
            responsavel: "INSS - Instituto Nacional do Seguro Social"
        }
      ];
      
      setProcessos(processosDemonstracao);
      
      toast({
        title: "Erro ao carregar dados",
        description: "Usando dados de demonstração. Verifique a conexão com a planilha.",
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
    indeferidos: processos.filter(p => p.status === 'Indeferido').length
  };

  // Filtrar processos
  const processosFiltrados = processos.filter(processo => {
    const matchStatus = filtroStatus === 'todos' || processo.status === filtroStatus;
    const matchEmail = filtroEmail === 'todos' || 
      (filtroEmail === 'enviado' && processo.emailEnviado) ||
      (filtroEmail === 'nao_enviado' && !processo.emailEnviado);
    const matchBusca = termoBusca === '' || 
      processo.cliente.toLowerCase().includes(termoBusca.toLowerCase()) ||
      processo.numeroProcesso.toLowerCase().includes(termoBusca.toLowerCase()) ||
      processo.tipoProcesso.toLowerCase().includes(termoBusca.toLowerCase());
    
    return matchStatus && matchEmail && matchBusca;
  });

  // Funções de seleção
  const toggleSelecionarTodos = () => {
    if (processosSelecionados.length === processosFiltrados.length) {
      setProcessosSelecionados([]);
    } else {
      setProcessosSelecionados(processosFiltrados.map(p => p.id));
    }
  };

  const toggleSelecionarProcesso = (id) => {
    setProcessosSelecionados(prev => 
      prev.includes(id) 
        ? prev.filter(pid => pid !== id)
        : [...prev, id]
    );
  };

  // Enviar email individual
    const enviarEmailIndividual = async (processo: ProcessoData) => {
        setCarregando(true);
        try {
            console.log(`📧 Enviando email para processo ${processo.numeroProcesso}`);
            
            const response = await fetchWithAuth(`${API_BASE_URL}/api/emails/processo/${processo.id}`, {
            method: 'POST',
            body: JSON.stringify({
                // ✅ Campos corretos conforme backend atualizado
                numeroProcesso: processo.numeroProcesso,
                cliente: processo.cliente,
                emailCliente: processo.emailCliente,
                tipoProcesso: processo.tipoProcesso,
                status: processo.status,
                ultimoAndamento: processo.ultimoAndamento,
                responsavel: processo.responsavel,
                observacoes: processo.observacoes,
                // ✅ Campos adicionais do backend
                cpfAssistido: processo.cpfAssistido,
                instancia: processo.instancia,
                exAdverso: processo.exAdverso,
                objetoAtendimento: processo.objetoAtendimento
            })
            });

            if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro ao enviar email");
            }

            const result = await response.json();
            
            // Atualizar processo localmente
            setProcessos(prev => prev.map(p => 
            p.id === processo.id 
                ? { ...p, emailEnviado: true, dataUltimoEmail: new Date().toISOString().split('T')[0] }
                : p
            ));

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

  // Enviar emails em massa
    const validarEmail = (email: string): boolean => {
        if (!email || !email.includes('@')) return false;
        
        // Regex mais rigorosa para emails
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Usar na função de envio em massa
    const enviarEmailsEmMassa = async () => {
        if (processosSelecionados.length === 0) {
            toast({
            title: "Nenhum processo selecionado",
            description: "Selecione pelo menos um processo para enviar emails",
            variant: "destructive"
            });
            return;
        }

        // ✅ Validar emails antes de enviar
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

        if (processosComEmailValido.length < processosParaEnviar.length) {
            toast({
            title: "Alguns emails são inválidos",
            description: `${processosComEmailValido.length} de ${processosParaEnviar.length} processos têm emails válidos`,
            variant: "destructive"
            });
        }

        setCarregando(true);
        try {
            console.log(`📧 Enviando emails em massa para ${processosComEmailValido.length} processos`);
            
            const response = await fetchWithAuth(`${API_BASE_URL}/api/emails/massa`, {
            method: 'POST',
            body: JSON.stringify({
                processos: processosComEmailValido.map(p => ({
                id: p.id,
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
                objetoAtendimento: p.objetoAtendimento
                }))
            })
            });

            if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro ao enviar emails");
            }

            const result = await response.json();
            
            // Atualizar processos selecionados localmente
            const dataAtual = new Date().toISOString().split('T')[0];
            setProcessos(prev => prev.map(p => 
            processosSelecionados.includes(p.id) && processosComEmailValido.find(pv => pv.id === p.id)
                ? { ...p, emailEnviado: true, dataUltimoEmail: dataAtual }
                : p
            ));

            setProcessosSelecionados([]);

            toast({
            title: "Emails enviados com sucesso!",
            description: `${result.enviados || processosComEmailValido.length} email(s) foram enviados. ${result.erros ? `${result.erros} falharam.` : ''}`,
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

  // Atualizar status do email na planilha
  const atualizarStatusEmailNaPlanilha = async (processoId: number, emailEnviado: boolean) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/processos/atualizar-email`, {
        method: 'PATCH',
        body: JSON.stringify({
          processoId,
          emailEnviado,
          dataEnvio: emailEnviado ? new Date().toISOString() : null
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ Erro ao atualizar planilha para processo ${processoId}`);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao atualizar planilha:`, error);
    }
  };

  // Atualizar dados da planilha
  const atualizarDados = async () => {
    setCarregando(true);
    await carregarProcessos();
    setCarregando(false);
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Em Andamento': 'bg-blue-100 text-blue-800',
      'Deferido': 'bg-green-100 text-green-800',
      'Indeferido': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Renderizar loading inicial
  if (carregandoInicial) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Carregando dados dos processos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de Emails - Processos</h1>
          <p className="text-gray-600">Gerencie o envio de emails sobre processos ajuizados</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={atualizarDados}
            variant="outline"
            disabled={carregando}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            variant="outline"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Com Email</p>
                <p className="text-xl font-bold text-green-600">{stats.comEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <X className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Sem Email</p>
                <p className="text-xl font-bold text-red-600">{stats.semEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Em Andamento</p>
                <p className="text-xl font-bold text-blue-600">{stats.emAndamento}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Check className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Deferidos</p>
                <p className="text-xl font-bold text-green-600">{stats.deferidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <X className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Indeferidos</p>
                <p className="text-xl font-bold text-red-600">{stats.indeferidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      {mostrarFiltros && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Buscar</label>
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
                <label className="block text-sm font-medium mb-2">Status do Processo</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="Em Andamento">Em Andamento</option>
                  <option value="Deferido">Deferido</option>
                  <option value="Indeferido">Indeferido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status do Email</label>
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
      )}

      {/* Ações em massa */}
      {processosSelecionados.length > 0 && (
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

      {/* Lista de processos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Processos ({processosFiltrados.length})
            </CardTitle>
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
                    <input
                      type="checkbox"
                      checked={processosSelecionados.includes(processo.id)}
                      onChange={() => toggleSelecionarProcesso(processo.id)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{processo.cliente}</h3>
                        <Badge className={getStatusBadge(processo.status)}>
                          {processo.status}
                        </Badge>
                        {processo.emailEnviado && (
                          <Badge className="bg-green-100 text-green-800">
                            <Mail className="h-3 w-3 mr-1" />
                            Email Enviado
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                        <div>
                            <strong>Processo:</strong> {processo.numeroProcesso}
                        </div>
                        <div>
                            <strong>Tipo:</strong> {processo.tipoProcesso}
                        </div>
                        <div>
                            <strong>Email:</strong> {processo.emailCliente}
                        </div>
                        <div>
                            <strong>CPF:</strong> {processo.cpfAssistido}
                        </div>
                        <div>
                            <strong>Telefone:</strong> {processo.telefones}
                        </div>
                        <div>
                            <strong>Instância:</strong> {processo.instancia}
                        </div>
                        <div>
                            <strong>Ajuizamento:</strong> {formatarData(processo.dataAjuizamento)}
                        </div>
                        <div>
                            <strong>Último Andamento:</strong> {formatarData(processo.ultimoAndamento)}
                        </div>
                        <div>
                            <strong>Parte Contrária:</strong> {processo.exAdverso?.substring(0, 30)}...
                        </div>
                      </div>
                      
                      {processo.observacoes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <strong>Observações:</strong> {processo.observacoes}
                        </div>
                      )}
                      
                      {processo.dataUltimoEmail && (
                        <div className="mt-2 text-xs text-green-600">
                          Último email enviado em: {formatarData(processo.dataUltimoEmail)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => enviarEmailIndividual(processo)}
                      disabled={carregando}
                      size="sm"
                      variant={processo.emailEnviado ? "outline" : "default"}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {processo.emailEnviado ? 'Reenviar' : 'Enviar'} Email
                    </Button>
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
  );
};

export default ControleEmailsProcessos;
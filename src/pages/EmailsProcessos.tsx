import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import Header from '@/components/Header';
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
  Settings,
  Hash
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
  statusEmail?: 'Pendente' | 'Enviado';
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
  const [filtroObjetoAtendimento, setFiltroObjetoAtendimento] = useState('todos');
  const [termoBusca, setTermoBusca] = useState('');
  const [processoDetalhado, setProcessoDetalhado] = useState<ProcessoData | null>(null);
  const [buscaIdAtendimento, setBuscaIdAtendimento] = useState('');
  const [objetoBusca, setObjetoBusca] = useState('');
  const [objetoSelectorAberto, setObjetoSelectorAberto] = useState(false);
  
  // Estados para paginação
  const [dataInicioFiltro, setDataInicioFiltro] = useState('');
  const [dataFimFiltro, setDataFimFiltro] = useState('');
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState<ProcessoData | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  
  const { toast } = useToast();

  const iniciarEdicao = () => {
    setDadosEdicao({ ...processoDetalhado });
    setModoEdicao(true);
  };

  // Função para cancelar edição
  const cancelarEdicao = () => {
    setModoEdicao(false);
    setDadosEdicao(null);
  };

  const salvarEdicao = async () => {
    if (!dadosEdicao) return;

    setSalvandoEdicao(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/processos/${dadosEdicao.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          cliente: dadosEdicao.cliente,
          emailCliente: dadosEdicao.emailCliente,
          telefones: dadosEdicao.telefones,
          idAtendimento: dadosEdicao.idAtendimento,
          tipoProcesso: dadosEdicao.tipoProcesso,
          exAdverso: dadosEdicao.exAdverso,
          instancia: dadosEdicao.instancia,
          objetoAtendimento: dadosEdicao.objetoAtendimento,
          valorCausa: dadosEdicao.valorCausa,
          observacoes: dadosEdicao.observacoes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao salvar alterações");
      }

      // Atualizar processo detalhado e lista
      setProcessoDetalhado(dadosEdicao);
      await carregarProcessos();
      setModoEdicao(false);
      setDadosEdicao(null);

      toast({
        title: "Processo atualizado!",
        description: "As alterações foram salvas com sucesso",
      });

    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar as alterações",
        variant: "destructive"
      });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Função para atualizar dados de edição
  const atualizarDadosEdicao = (campo: string, valor: string) => {
    if (!dadosEdicao) return;
    setDadosEdicao({ ...dadosEdicao, [campo]: valor });
  };

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

  // Função para formatar data para dd/MM/yyyy
  const formatarData = (data: string): string => {
    if (!data) return '';
    
    // Pegar tudo antes do T
    const dataLimpa = data.split('T')[0];
    
    // Se não está no formato YYYY-MM-DD, retornar original
    if (!dataLimpa.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return data;
    }
    
    // Separar ano, mês, dia
    const [ano, mes, dia] = dataLimpa.split('-');
    
    // Retornar no formato dd/MM/yyyy
    return `${dia}/${mes}/${ano}`;
  };

  function extrairEmailValido(emailString) {
    if (!emailString) return null;

    const emails = emailString.split(/[, ]+/).map(e => e.trim());
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emails.find(email => regex.test(email)) || null;
  }

  // Carregar dados da planilha
  const carregarProcessos = async () => {
    try {
      setCarregandoInicial(true);
      console.log('📊 Carregando dados dos processos (única rota)...');

      const url = `${API_BASE_URL}/api/processos`;
      const response = await fetchWithAuth(url);

      if (!response.ok) {
        throw new Error('A API não retornou dados válidos');
      }

      const data = await response.json();
      const todosProcessos = (data.processos || [])
        .map(processo => ({
          ...processo,
          emailCliente: extrairEmailValido(processo.emailCliente)
        }))
        .filter(processo => !!processo.emailCliente);

      // ✅ REMOVER DUPLICATAS por idProcessoPlanilha (mantém o mais recente)
      const processosUnicos = todosProcessos.reduce((acc, processo) => {
        const existing = acc.find(p => p.idProcessoPlanilha === processo.idProcessoPlanilha);
        if (!existing) {
          acc.push(processo);
        } else {
          // Se já existe, manter o que tem email enviado (prioridade)
          if (processo.emailEnviado && !existing.emailEnviado) {
            const index = acc.findIndex(p => p.idProcessoPlanilha === processo.idProcessoPlanilha);
            acc[index] = processo;
          }
        }
        return acc;
      }, []);

      setProcessos(processosUnicos);

      console.log(`✅ ${processosUnicos.length} processos únicos com email válido carregados`);

      toast({
        title: "Dados atualizados!",
        description: `${processosUnicos.length} processos únicos carregados`,
      });

    } catch (error) {
      console.error("❌ Erro ao carregar processos:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message || "Erro desconhecido",
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

  // Obter setores únicos dos processos
  const setoresUnicos = [...new Set(processos.map(p => p.tipoProcesso).filter(Boolean))];
  const objetosAtendimentoUnicos = [...new Set(processos.map(p => p.objetoAtendimento).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  // Obter responsáveis únicos
  const responsaveisUnicos = [...new Set(processos.map(p => p.responsavel).filter(Boolean))];
  const objetosFiltrados = objetosAtendimentoUnicos.filter(objeto =>
    objeto.toLowerCase().includes(objetoBusca.toLowerCase())
  );
  const selecionarObjeto = (objeto: string) => {
    setFiltroObjetoAtendimento(objeto);
    setObjetoSelectorAberto(false);
    setObjetoBusca('');
  };

  // ✅ 5. FUNÇÃO para obter texto exibido no select
  const getObjetoSelecionadoTexto = () => {
    if (filtroObjetoAtendimento === 'todos') return 'Todos os objetos';
    const objeto = filtroObjetoAtendimento;
    return objeto.length > 50 ? `${objeto.substring(0, 50)}...` : objeto;
  };
  const verificarDataNoIntervalo = (dataProcesso: string, dataInicio: string, dataFim: string): boolean => {
  if (!dataInicio && !dataFim) return true;
  
  try {
    // Converter data do processo para Date
    let dataProc: Date;
    if (dataProcesso.includes('/')) {
      // Formato dd/MM/yyyy
      const [dia, mes, ano] = dataProcesso.split('/');
      dataProc = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    } else {
      // Formato ISO ou outro
      dataProc = new Date(dataProcesso);
    }
    
    // Se não conseguiu converter, ignorar filtro de data
    if (isNaN(dataProc.getTime())) {
      console.log('Data inválida:', dataProcesso);
      return true;
    }
    
    // Verificar intervalo
    if (dataInicio) {
      const inicio = new Date(dataInicio + 'T00:00:00'); // Força início do dia
      if (dataProc < inicio) return false;
    }
    
    if (dataFim) {
      const fim = new Date(dataFim + 'T23:59:59'); // Força final do dia
      if (dataProc > fim) return false;
    }
    
    console.log('Verificando:', {
      dataProcesso,
      dataProc: dataProc.toISOString().split('T')[0],
      dataInicio,
      dataFim,
      resultado: true
    });
    
    return true;
  } catch (error) {
    console.log('Erro ao verificar data:', error, 'Data processo:', dataProcesso);
    return true;
  }
  };

  // Filtrar processos
  const processosFiltrados = processos.filter(processo => {
    const matchSetor = filtroSetor === 'todos' || processo.tipoProcesso === filtroSetor;
    const matchStatus = filtroStatus === 'todos' || processo.status === filtroStatus;
    const matchEmail = filtroEmail === 'todos' || processo.statusEmail === filtroEmail;
    const matchPessoa = filtroPessoa === 'todos' || processo.responsavel === filtroPessoa;
    const matchIdAtendimento = buscaIdAtendimento === '' || 
    (processo.idAtendimento && 
     processo.idAtendimento.toLowerCase().includes(buscaIdAtendimento.toLowerCase()));
    const palavrasBusca = termoBusca.toLowerCase().split(' ');
    const matchBusca = termoBusca === '' || 
      palavrasBusca.every(palavra => 
        processo.cliente?.toLowerCase().includes(palavra)
      ) ||
      processo.numeroProcesso?.toLowerCase().includes(termoBusca.toLowerCase());
    const matchData = verificarDataNoIntervalo(processo.dataAjuizamento, dataInicioFiltro, dataFimFiltro);
    const matchObjetoAtendimento = filtroObjetoAtendimento === 'todos' || 
      processo.objetoAtendimento === filtroObjetoAtendimento ||  // Seleção exata
      (objetoBusca !== '' && processo.objetoAtendimento?.toLowerCase().includes(objetoBusca.toLowerCase()));
    return matchSetor && matchStatus && matchEmail && matchPessoa && matchBusca && matchData && matchIdAtendimento && matchObjetoAtendimento;
  });

  const stats = {
    total: processosFiltrados.length,
    comEmail: processosFiltrados.filter(p => p.emailEnviado).length,
    semEmail: processosFiltrados.filter(p => !p.emailEnviado).length,
    emailsHoje: processosFiltrados.filter(p => 
      p.dataUltimoEmail && 
      new Date(p.dataUltimoEmail).toDateString() === new Date().toDateString()
    ).length
  };

  // Calcular dados da paginação
  const totalItens = processosFiltrados.length;
  const totalPaginas = Math.ceil(totalItens / itensPorPagina);
  const indiceInicial = (paginaAtual - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;

  // Processos da página atual
  const processosPaginaAtual = useMemo(() => {
    return processosFiltrados.slice(indiceInicial, indiceFinal);
  }, [processosFiltrados, indiceInicial, indiceFinal]);

  const handleItensPorPaginaChange = (novoValor: number) => {
    setItensPorPagina(novoValor);
    setPaginaAtual(1); // Volta para primeira página
  };
  // Função para ir para uma página específica
  const irParaPagina = (pagina: number) => {
    if (pagina >= 1 && pagina <= totalPaginas) {
      setPaginaAtual(pagina);
    }
  };

  // Resetar página quando os filtros mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroSetor, filtroStatus, filtroEmail, filtroPessoa, termoBusca, buscaIdAtendimento, filtroObjetoAtendimento]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-objeto-selector]')) {
        setObjetoSelectorAberto(false);
        setObjetoBusca('');
      }
    };

    if (objetoSelectorAberto) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [objetoSelectorAberto]);

  // Função para gerar números das páginas a serem exibidas
  const gerarPaginasExibicao = () => {
    const paginas = [];
    const maxPaginasVisiveis = 5;
    
    if (totalPaginas <= maxPaginasVisiveis) {
      // Se tem poucas páginas, mostra todas
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      // Lógica para mostrar páginas com ellipsis
      const metade = Math.floor(maxPaginasVisiveis / 2);
      let inicio = Math.max(1, paginaAtual - metade);
      let fim = Math.min(totalPaginas, inicio + maxPaginasVisiveis - 1);
      
      // Ajustar se estamos perto do final
      if (fim - inicio < maxPaginasVisiveis - 1) {
        inicio = Math.max(1, fim - maxPaginasVisiveis + 1);
      }
      
      for (let i = inicio; i <= fim; i++) {
        paginas.push(i);
      }
    }
    
    return paginas;
  };

  // Funções de seleção (só para protocolo)
  const toggleSelecionarTodos = () => {
    if (!podeEnviarEmails) return;
    
    // ✅ Usar processosPaginaAtual em vez de processosFiltrados para selecionar apenas a página atual
    const processosVisiveisPagina = processosPaginaAtual.map(p => p.id);
    
    // Verificar se todos os processos da página atual estão selecionados
    const todosSelecionados = processosVisiveisPagina.every(id => processosSelecionados.includes(id));
    
    if (todosSelecionados) {
      // Desmarcar todos da página atual
      setProcessosSelecionados(prev => prev.filter(id => !processosVisiveisPagina.includes(id)));
    } else {
      // Marcar todos da página atual
      setProcessosSelecionados(prev => [...new Set([...prev, ...processosVisiveisPagina])]);
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
        objetoAtendimento: processo.objetoAtendimento,
        valorCausa: processo.valorCausa || '',  // ✅ ADICIONADO
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
            valorCausa: p.valorCausa || '',
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
  //teste

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
      <Header />
      <main className="max-w-[1600px]  mx-auto px-6 py-8">
        <div className="space-y-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Header Section */}
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
                {/* Primeira linha */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Cliente ou número do processo</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>
                  </div>
                                    <div>
                    <label className="block text-sm font-medium mb-2">ID do Atendimento</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={buscaIdAtendimento}
                        onChange={(e) => setBuscaIdAtendimento(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de processo</label>
                    <select
                      value={filtroSetor}
                      onChange={(e) => setFiltroSetor(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="todos">Todos os tipos</option>
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="todos">Todos</option>
                      <option value="Enviado">Email Enviado</option>
                      <option value="Pendente">Email Pendente</option>
                    </select>
                  </div>
                </div>

                {/* Segunda linha */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* OBJETO DE ATENDIMENTO */}
                  <div className="relative" data-objeto-selector>
                    <label className="block text-sm font-medium mb-2">Objeto de Atendimento</label>
                    
                    {/* Botão principal do select */}
                    <button
                      type="button"
                      onClick={() => setObjetoSelectorAberto(!objetoSelectorAberto)}
                      className="w-full px-3 py-2 text-left border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white flex items-center justify-between hover:bg-gray-50"
                    >
                      <span className="truncate">{getObjetoSelecionadoTexto()}</span>
                      <svg className={`w-4 h-4 transition-transform ${objetoSelectorAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown com busca */}
                    {objetoSelectorAberto && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        {/* Campo de busca */}
                        <div className="p-2 border-b">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar objeto..."
                              value={objetoBusca}
                              onChange={(e) => setObjetoBusca(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Lista de opções */}
                        <div className="max-h-48 overflow-y-auto">
                          {/* Opção "Todos" */}
                          <button
                            type="button"
                            onClick={() => selecionarObjeto('todos')}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center ${
                              filtroObjetoAtendimento === 'todos' ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                            }`}
                          >
                            <span className="truncate">Todos os objetos</span>
                            {filtroObjetoAtendimento === 'todos' && (
                              <Check className="ml-auto h-4 w-4 text-blue-600" />
                            )}
                          </button>

                          {/* Opções filtradas */}
                          {objetosFiltrados.length > 0 ? (
                            objetosFiltrados.map((objeto, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selecionarObjeto(objeto)}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center ${
                                  filtroObjetoAtendimento === objeto ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                                }`}
                                title={objeto} // Tooltip com texto completo
                              >
                                <span className="truncate">{objeto}</span>
                                {filtroObjetoAtendimento === objeto && (
                                  <Check className="ml-auto h-4 w-4 text-blue-600 flex-shrink-0" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhum objeto encontrado
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Autuação do processo de</label>
                    <input
                      type="date"
                      value={dataInicioFiltro}
                      onChange={(e) => setDataInicioFiltro(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">até</label>
                    <input
                      type="date"
                      value={dataFimFiltro}
                      onChange={(e) => setDataFimFiltro(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
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

            {/* Lista de Processos com Paginação */}
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Processos ({totalItens})
                  </CardTitle>
                  <div className="flex items-center space-x-4">
                    {/* ✅ NOVO: Seletor de itens por página */}
                    <div className="flex items-center space-x-2">
                      <select
                        value={itensPorPagina}
                        onChange={(e) => handleItensPorPaginaChange(Number(e.target.value))}
                        className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-gray-600">por página</span>
                    </div>
                    
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
                </div>
              </CardHeader>
              
              {/* Conteúdo Scrollável */}
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                  {processosPaginaAtual.map((processo) => (
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
                                <Badge className="bg-yellow-100 hover:bg-yellow-100 text-yellow-800">
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
                                <strong>Tipo:</strong> {processo.tipoProcesso}
                              </div>
                              <div>
                                <strong>ID do atendimento:</strong> {processo.idAtendimento}
                              </div>
                              <div>
                                <strong>Ajuizamento:</strong> {formatarData(processo.dataAjuizamento)}
                              </div>
                            </div>
                            
                            {processo.dataUltimoEmail && (
                              <div className="mt-2 text-xs text-green-600">
                                Email enviado em: {formatarData(processo.dataUltimoEmail)}
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
                
                {processosPaginaAtual.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum processo encontrado com os filtros aplicados</p>
                  </div>
                )}
              </CardContent>

              {/* Footer com Paginação */}
              {totalPaginas > 1 && (
                <div className="flex-shrink-0 p-4 border-t bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm text-gray-600 flex-shrink-0">
                      {indiceInicial + 1} a {Math.min(indiceFinal, totalItens)} de {totalItens}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`px-3 py-1 text-xs ${paginaAtual === 1 ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => irParaPagina(paginaAtual - 1)}
                      >
                        Anterior
                      </Button>
                      
                      {gerarPaginasExibicao().map((pagina) => (
                        <Button
                          key={pagina}
                          variant={pagina === paginaAtual ? "default" : "outline"}
                          size="sm"
                          className="px-2 py-1 text-xs min-w-[32px] cursor-pointer"
                          onClick={() => irParaPagina(pagina)}
                        >
                          {pagina}
                        </Button>
                      ))}
                      
                      {totalPaginas > 5 && paginaAtual < totalPaginas - 2 && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className={`px-3 py-1 text-xs ${paginaAtual === totalPaginas ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => irParaPagina(paginaAtual + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Modal de Detalhes */}
      <Dialog open={!!processoDetalhado} onOpenChange={() => {
        setProcessoDetalhado(null);
        setModoEdicao(false);
        setDadosEdicao(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes do Processo - {modoEdicao ? dadosEdicao?.cliente : processoDetalhado?.cliente}
              </div>
              {!modoEdicao && (
                <Button
                  onClick={iniciarEdicao}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {processoDetalhado && (
            <div className="space-y-3">
              {/* Objeto do Atendimento - PRIMEIRO */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Objeto do Atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {modoEdicao ? (
                    <textarea
                      value={dadosEdicao?.objetoAtendimento || ''}
                      onChange={(e) => atualizarDadosEdicao('objetoAtendimento', e.target.value)}
                      className="w-full p-3 border rounded-lg resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Descreva o objeto do atendimento..."
                    />
                  ) : (
                    <p className="text-gray-700 leading-relaxed">
                      {processoDetalhado.objetoAtendimento || 'Não informado'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Informações principais */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nome do Cliente */}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Nome do Cliente</label>
                      {modoEdicao ? (
                        <Input
                          value={dadosEdicao?.cliente || ''}
                          onChange={(e) => atualizarDadosEdicao('cliente', e.target.value)}
                          className="mt-1"
                        />
                      ) : (
                        <p className="mt-1">{processoDetalhado.cliente}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      {modoEdicao ? (
                        <Input
                          type="email"
                          value={dadosEdicao?.emailCliente || ''}
                          onChange={(e) => atualizarDadosEdicao('emailCliente', e.target.value)}
                          className="mt-1"
                        />
                      ) : (
                        <p className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4" />
                          {processoDetalhado.emailCliente}
                        </p>
                      )}
                    </div>

                    {/* Telefones */}
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-600">Telefones</label>
                      {modoEdicao ? (
                        <Input
                          value={dadosEdicao?.telefones || ''}
                          onChange={(e) => atualizarDadosEdicao('telefones', e.target.value)}
                          className="mt-1"
                          placeholder="(11) 99999-9999, (11) 3333-3333"
                        />
                      ) : (
                        <p className="flex items-center gap-2 mt-1">
                          <Phone className="h-4 w-4" />
                          {processoDetalhado.telefones || 'Não informado'}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Processo */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Scale className="h-5 w-5" />
                    Dados do Processo
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ID do Processo - NÃO EDITÁVEL */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID do Processo</label>
                    <p className="font-mono text-sm mt-1 text-gray-500">{processoDetalhado.idProcessoPlanilha}</p>
                  </div>

                  {/* Número Único - NÃO EDITÁVEL */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Número Único</label>
                    <p className="font-mono text-sm mt-1 text-gray-500">{processoDetalhado.numeroProcesso}</p>
                  </div>

                  {/* ID Atendimento */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID Atendimento</label>
                    {modoEdicao ? (
                      <Input
                        value={dadosEdicao?.idAtendimento || ''}
                        onChange={(e) => atualizarDadosEdicao('idAtendimento', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-mono text-sm mt-1">{processoDetalhado.idAtendimento}</p>
                    )}
                  </div>

                  {/* Natureza */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Natureza</label>
                    {modoEdicao ? (
                      <select
                        value={dadosEdicao?.tipoProcesso || ''}
                        onChange={(e) => atualizarDadosEdicao('tipoProcesso', e.target.value)}
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="">Selecione...</option>
                        {setoresUnicos.map(setor => (
                          <option key={setor} value={setor}>{setor}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1">{processoDetalhado.tipoProcesso}</p>
                    )}
                  </div>

                  {/* Data de Autuação - NÃO EDITÁVEL */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data de Autuação</label>
                    <p className="flex items-center gap-2 mt-1 text-gray-500">
                      <Calendar className="h-4 w-4" />
                      {formatarData(processoDetalhado.dataAjuizamento)}
                    </p>
                  </div>

                  {/* Instância */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Instância</label>
                    {modoEdicao ? (
                      <Input
                        value={dadosEdicao?.instancia || ''}
                        onChange={(e) => atualizarDadosEdicao('instancia', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="mt-1">{processoDetalhado.instancia}</p>
                    )}
                  </div>

                  {/* Ex-adverso */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Ex-adverso</label>
                    {modoEdicao ? (
                      <Input
                        value={dadosEdicao?.exAdverso || ''}
                        onChange={(e) => atualizarDadosEdicao('exAdverso', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="mt-1">{processoDetalhado.exAdverso || 'Não informado'}</p>
                    )}
                  </div>

                  {/* Valor da Causa - só mostra se já tem valor */}
                  {(processoDetalhado.valorCausa || dadosEdicao?.valorCausa) && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Valor da Causa</label>
                      {modoEdicao ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={dadosEdicao?.valorCausa || ''}
                          onChange={(e) => atualizarDadosEdicao('valorCausa', e.target.value)}
                          className="mt-1"
                          placeholder="0.00"
                        />
                      ) : (
                        <p className="mt-1">
                          {processoDetalhado.valorCausa ? 
                            new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(Number(processoDetalhado.valorCausa)) : 
                            'Não informado'
                          }
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ações */}
              <div className="flex justify-end gap-2">
                {modoEdicao ? (
                  <>
                    <Button
                      onClick={cancelarEdicao}
                      variant="outline"
                      disabled={salvandoEdicao}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      onClick={salvarEdicao}
                      disabled={salvandoEdicao}
                    >
                      {salvandoEdicao ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Salvar Alterações
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailsProcessos;
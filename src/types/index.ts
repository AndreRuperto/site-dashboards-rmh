// src/types/index.ts - ATUALIZADO com interface User unificada
export type UserRole = 'usuario' | 'coordenador' | 'admin';
export type TipoColaborador = 'estagiario' | 'clt_associado';
export type TipoVisibilidade = 'geral' | 'coordenadores' | 'admin';

export interface User {
  id: string;
  nome: string;
  email?: string; // Email corporativo - opcional para estagiários
  email_pessoal?: string; // Email pessoal - obrigatório para estagiários
  setor: string;
  tipo_usuario: UserRole;
  tipo_colaborador: TipoColaborador;
  email_verificado: boolean;
  aprovado_admin?: boolean; // Para controle de aprovação de estagiários
  criado_em: string;
  atualizado_em: string;
  ultimo_login?: string;
  email_login: string; // Email usado para login (calculado)
  status: string; // Status do usuário (pendente_aprovacao, ativo, etc)
  codigo_ativo?: boolean; // Se há código de verificação ativo
  is_coordenador?: boolean; // 🆕 ADICIONADO: Campo para indicar se é coordenador
  ativo?: boolean; // 🆕 ADICIONADO: Status ativo/inativo
  criado_por_admin?: string | null; // 🆕 ADICIONADO: ID do admin que criou
  criado_por_admin_em?: string | null; // 🆕 ADICIONADO: Data de criação pelo admin
  criado_por_admin_nome?: string | null; // 🆕 ADICIONADO: Nome do admin que criou
}

// 🆕 ALIAS para compatibilidade (pode ser removido gradualmente)
export type Usuario = User;

export interface Dashboard {
  id: string;
  titulo: string;
  descricao?: string;
  setor: string;
  url_iframe: string;
  ativo: boolean;
  largura?: number;
  altura?: number;
  criado_por: string;
  criado_por_nome?: string; // Nome do criador (JOIN com usuarios)
  criado_em: string;
  atualizado_em: string;
  tipo_visibilidade: TipoVisibilidade;
}

export interface VerificacaoEmail {
  id: string;
  usuario_id: string;
  token: string;
  tipo_token: 'verificacao_email' | 'reset_senha';
  expira_em: string;
  usado_em?: string;
  criado_em: string;
}

export const podeVisualizarDashboard = (
  usuario: User,
  dashboard: Dashboard
): boolean => {
  if (!usuario.tipo_usuario) return false;
  if (usuario.setor !== dashboard.setor) return false;

  switch (dashboard.tipo_visibilidade) {
    case 'geral':
      return true;
    case 'coordenadores':
      return usuario.is_coordenador || false;
    case 'admin':
      return usuario.tipo_usuario === 'admin';
    default:
      return false;
  }
};

export interface LogEmail {
  id: string;
  usuario_id?: string;
  email_para: string;
  tipo_email: string;
  status: 'enviado' | 'entregue' | 'falha' | 'rejeitado';
  id_provedor?: string;
  mensagem_erro?: string;
  enviado_em: string;
}

// 🆕 INTERFACES PARA ADMIN
export interface UsuariosStats {
  total: number;
  pendentes_aprovacao: number;
  nao_verificados: number;
  admins: number;
  coordenadores?: number;
  clt_associados?: number;
  estagiarios?: number;
  revogados?: number;
}

export interface RegistrationResult {
  success?: boolean;
  message?: string;
  error?: string;
  verification_required?: boolean;
  awaiting_admin_approval?: boolean;
  email_enviado_para?: string;
  email_login?: string;
  email?: string;
  nome?: string;
  tipo_colaborador?: TipoColaborador;
  email_enviado?: boolean;
  info?: string;
  user_id?: string;
}

// Tipos para requisições da API
export interface LoginRequest {
  email: string;
  senha: string;
}

export interface RegisterRequest {
  nome: string;
  email?: string; // Opcional para estagiários
  email_pessoal?: string; // Obrigatório para estagiários
  senha: string;
  setor: string;
  tipo_colaborador: TipoColaborador;
}

export interface CreateDashboardRequest {
  titulo: string;
  descricao?: string;
  setor: string;
  url_iframe: string;
  largura?: number;
  altura?: number;
}

export interface UpdateDashboardRequest extends Partial<CreateDashboardRequest> {
  ativo?: boolean;
}

// Tipos para respostas da API
export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface DashboardsResponse {
  dashboards: Dashboard[];
}

export interface ApiError {
  error: string;
  details?: string;
}

// 🆕 TIPOS PARA ADMIN
export interface UsuariosResponse {
  usuarios: User[];
  total?: number;
  pendentes_aprovacao?: number;
  nao_verificados?: number;
  admins?: number;
  setores?: string[];
}

export interface AprovarUsuarioRequest {
  enviar_codigo?: boolean;
}

export interface AprovarUsuarioResponse {
  message: string;
  success: boolean;
  usuarios?: never; // Para evitar confusão - esta interface NÃO tem usuarios
}

// Utilitários para validação
export const getLoginEmail = (user: User): string => {
  if (user.tipo_colaborador === 'estagiario') {
    return user.email_pessoal || '';
  }
  return user.email || '';
};

export const getDisplayEmail = (user: User): string => {
  return getLoginEmail(user);
};

export const isEstagiario = (user: User): boolean => {
  return user.tipo_colaborador === 'estagiario';
};

export const isCltAssociado = (user: User): boolean => {
  return user.tipo_colaborador === 'clt_associado';
};

export const isAdmin = (user: User): boolean => {
  return user.tipo_usuario === 'admin';
};

export const isCoordenador = (user: User): boolean => {
  return user.is_coordenador || false;
};

// 🆕 UTILITÁRIOS PARA STATUS
export const getUserStatus = (usuario: User): string => {
  if (usuario.tipo_usuario === 'admin') return 'admin';
  
  if (usuario.tipo_colaborador === 'estagiario') {
    if (usuario.status === 'pendente_aprovacao' || !usuario.aprovado_admin) {
      return 'pendente_aprovacao';
    }
    if (usuario.aprovado_admin && !usuario.email_verificado) {
      return 'aguardando_verificacao';
    }
    if (usuario.aprovado_admin && usuario.email_verificado) {
      return 'ativo';
    }
  }
  
  if (usuario.tipo_colaborador === 'clt_associado') {
    if (usuario.email_verificado) {
      return 'ativo';
    } else {
      return 'aguardando_verificacao';
    }
  }
  
  return 'indefinido';
};

export const isPendenteAprovacao = (usuario: User): boolean => {
  return usuario.tipo_colaborador === 'estagiario' && 
         (usuario.status === 'pendente_aprovacao' || !usuario.aprovado_admin);
};

export const isAguardandoVerificacao = (usuario: User): boolean => {
  return !usuario.email_verificado && 
         (usuario.tipo_colaborador === 'clt_associado' || 
          (usuario.tipo_colaborador === 'estagiario' && usuario.aprovado_admin));
};

// 🆕 SETORES DISPONÍVEIS
export const SETORES = [
  'Administrativo',
  'Atendimento',
  'Carteira',
  'Comercial/Marketing',
  'Criminal',
  'Diretores',
  'Família e Sucessões',
  'Financeiro',
  'Inicial',
  'Projetos',
  'Protocolo',
  'Prazos',
  'Saúde',
  'Trabalhista'
] as const;

export type Setor = typeof SETORES[number];
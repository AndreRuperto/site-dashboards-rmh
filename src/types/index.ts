// src/types/index.ts - Tipos atualizados para incluir tipos de colaborador

export type UserRole = 'usuario' | 'admin';
export type TipoColaborador = 'estagiario' | 'clt_associado';

export interface User {
  id: string;
  nome: string;
  email?: string; // Email corporativo - opcional para estagiários
  email_pessoal?: string; // Email pessoal - obrigatório para estagiários
  departamento: string;
  tipo_usuario: UserRole;
  tipo_colaborador: TipoColaborador;
  email_verificado: boolean;
  criado_em: string;
  atualizado_em: string;
  ultimo_login?: string;
}

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
  criado_em: string;
  atualizado_em: string;
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
  departamento: string;
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
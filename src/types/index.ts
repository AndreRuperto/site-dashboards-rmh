// src/types/index.ts - Tipos centralizados baseados no schema do banco

export type UserRole = 'usuario' | 'admin';

export interface User {
  id: string;
  nome: string;
  email: string;
  departamento: string;
  tipo_usuario: UserRole;
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
  email: string;
  senha: string;
  departamento: string;
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
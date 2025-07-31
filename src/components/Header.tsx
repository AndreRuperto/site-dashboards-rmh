import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Shield, Users, Settings, Mail, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import RMHLogo from './RMHLogo';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const goToAdminUsers = () => {
    navigate('/admin/usuarios');
  };

  const goToEmails = () => {
    navigate('/emails-processos');
  };

  const goToOrganograma = () => {
    navigate('/organograma');
  };

  const goToDocuments = () => {
    navigate('/documentos');
  };

  const goToHome = () => {
    navigate('/');
  };

  const goToDashboards = () => {
    navigate('/dashboards');
  };

  // Função para obter email de exibição baseado no tipo de colaborador
  const getDisplayEmail = () => {
    if (!user) return '';
    return user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;
  };

  // Verificar se o usuário pode ver dashboards (coordenador ou admin)
  const canViewDashboards = user?.tipo_usuario === 'admin' || user?.is_coordenador;

  return (
    <header className="bg-primary border-b border-rmh-lightGray shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <RMHLogo />

            {/* ✅ NAVEGAÇÃO ATUALIZADA - Incluindo Documentos */}
            <nav className="hidden lg:flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={goToHome}
                className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20"
              >
                Início
              </Button>
              
              {canViewDashboards && (
                <Button
                  variant="ghost"
                  onClick={goToDashboards}
                  className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20"
                >
                  Dashboards
                </Button>
              )}
              
              {/* ✅ NOVO: Documentos no menu principal */}
              <Button
                variant="ghost"
                onClick={goToDocuments}
                className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20 flex items-center space-x-2"
              >
                <span>Documentos</span>
              </Button>
              
              <Button
                variant="ghost"
                onClick={goToEmails}
                className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20 flex items-center space-x-2"
              >
                <span>Emails</span>
              </Button>
              {/* ADICIONAR QUANDO FOR MEXER COM ORGANOGRAMA */}
              {/* <Button
                variant="ghost"
                onClick={goToOrganograma}
                className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20 flex items-center space-x-2"
              >
                <span>Organograma</span>
              </Button> */}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm text-rmh-white">
              <span>Bem-vindo,</span>
              <span className="font-medium text-white">{user?.nome}</span>
              {user?.tipo_usuario === 'admin' && (
                <Shield className="h-4 w-4 text-amber-400" />
              )}
            </div>

            {/* ✅ MENU DO USUÁRIO */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-rmh-lightGreen text-white font-medium">
                      {user ? getInitials(user.nome) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.nome}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {getDisplayEmail()}
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className="text-xs leading-none text-muted-foreground">
                        {user?.setor} • {user?.tipo_colaborador === 'estagiario' ? 'Estagiário' : 'CLT/Associado'}
                      </span>
                      {user?.tipo_usuario === 'admin' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {user?.is_coordenador && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                          Coordenador
                        </span>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* ✅ NAVEGAÇÃO RÁPIDA NO MENU MOBILE */}
                <div className="lg:hidden">
                  <DropdownMenuLabel>Navegação</DropdownMenuLabel>
                  {canViewDashboards && (
                    <DropdownMenuItem onClick={goToDashboards} className="cursor-pointer">
                      <span className="mr-2">📊</span>
                      Dashboards
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={goToDocuments} className="cursor-pointer">
                    <FileText className="h-4 w-4 mr-2" />
                    Documentos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={goToEmails} className="cursor-pointer">
                    <Mail className="h-4 w-4 mr-2" />
                    Emails
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={goToOrganograma} className="cursor-pointer">
                    <span className="mr-2">👥</span>
                    Organograma
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </div>

                {/* ✅ ADMINISTRAÇÃO */}
                {user?.tipo_usuario === 'admin' && (
                  <>
                    <DropdownMenuLabel>Administração</DropdownMenuLabel>
                    <DropdownMenuItem onClick={goToAdminUsers} className="cursor-pointer">
                      <Users className="h-4 w-4 mr-2" />
                      Controle de Usuários
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin/settings')} className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
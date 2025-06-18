import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User as UserIcon, Shield, Users, Settings, ChevronDown } from 'lucide-react';
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

  const goToDashboards = () => {
    navigate('/dashboards');
  };

  // Função para obter email de exibição baseado no tipo de colaborador
  const getDisplayEmail = () => {
    if (!user) return '';
    return user.tipo_colaborador === 'estagiario' ? user.email_pessoal : user.email;
  };

  return (
    <header className="bg-primary border-b border-rmh-lightGray shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Logo mantido */}
            <RMHLogo />
            
            {/* Menu de navegação para desktop */}
            <nav className="hidden lg:flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={goToDashboards}
                className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20"
              >
                📊 Dashboards
              </Button>

              {/* Menu Admin (só para admins) */}
              {user?.tipo_usuario === 'admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="text-rmh-white hover:text-white hover:bg-rmh-lightGreen/20"
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Admin
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Administração</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={goToAdminUsers}
                      className="cursor-pointer"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Controle de Usuários
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/admin/settings')}
                      className="cursor-pointer"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Informações do usuário na barra superior */}
            <div className="hidden md:flex items-center space-x-2 text-sm text-rmh-white">
              <span>Bem-vindo,</span>
              <span className="font-medium text-white">{user?.nome}</span>
              {user?.tipo_usuario === 'admin' && (
                <Shield className="h-4 w-4 text-amber-400" />
              )}
            </div>

            {/* Menu do usuário */}
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
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Links rápidos para admins em mobile */}
                {user?.tipo_usuario === 'admin' && (
                  <>
                    <DropdownMenuItem 
                      onClick={goToDashboards}
                      className="cursor-pointer lg:hidden"
                    >
                      📊 Dashboards
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={goToAdminUsers}
                      className="cursor-pointer lg:hidden"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Controle de Usuários
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => navigate('/admin/settings')}
                      className="cursor-pointer lg:hidden"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="lg:hidden" />
                  </>
                )}
                
                <DropdownMenuItem 
                  onClick={logout} 
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Menu mobile para admins - versão compacta */}
        {user?.tipo_usuario === 'admin' && (
          <div className="lg:hidden mt-3 pt-3 border-t border-rmh-lightGray/20">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToDashboards}
                className="flex-1 bg-transparent border-rmh-lightGreen/30 text-rmh-white hover:bg-rmh-lightGreen/20"
              >
                📊 Dashboards
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToAdminUsers}
                className="flex-1 bg-transparent border-rmh-lightGreen/30 text-rmh-white hover:bg-rmh-lightGreen/20"
              >
                <Users className="h-4 w-4 mr-1" />
                Usuários
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
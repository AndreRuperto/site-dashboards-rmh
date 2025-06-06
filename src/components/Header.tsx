
import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, Shield } from 'lucide-react';
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <header className="bg-primary border-b border-rmh-lightGray shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <RMHLogo size="md" showText={true} />
            <div className="hidden md:block">
              <h1 className="text-xl font-heading font-bold text-rmh-white">
                Dashboards Corporativos
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm text-rmh-white">
              <span>Bem-vindo,</span>
              <span className="font-medium text-white">{user?.name}</span>
              {user?.role === 'admin' && (
                <Shield className="h-4 w-4 text-amber-500" />
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-rmh-lightGreen text-white font-medium">
                      {user ? getInitials(user.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.department} • {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
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

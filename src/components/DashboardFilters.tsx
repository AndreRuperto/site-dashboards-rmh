// src/components/DashboardFilters.tsx - VERSÃO CORRIGIDA

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, Search, Calendar, User, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedSetor: string;
  onSetorChange: (setor: string) => void;
  selectedPeriodo: string;
  onPeriodoChange: (periodo: string) => void;
  selectedCriador: string;
  onCriadorChange: (criador: string) => void;
  onClearFilters: () => void;
  setores: string[];
  criadores: Array<{ id: string; nome: string }>;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  searchTerm,
  onSearchChange,
  selectedSetor,
  onSetorChange,
  selectedPeriodo,
  onPeriodoChange,
  selectedCriador,
  onCriadorChange,
  onClearFilters,
  setores,
  criadores
}) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Determinar quais filtros mostrar baseado no tipo de usuário
  const isAdmin = user?.tipo_usuario === 'admin';
  const isCoordenador = user?.tipo_usuario === 'coordenador';

  // Verificar se há filtros ativos (além da busca)
  const hasActiveFilters = selectedSetor !== 'all' || selectedPeriodo !== 'all' || selectedCriador !== 'all';

  // Se não for admin, não renderiza nada
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {/* Header do filtro */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Filtrar Dashboards</h3>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
              Filtros ativos
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Campo de busca por nome */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <Search className="h-4 w-4 mr-1" />
              Nome do Dashboard
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Nome do dashboard"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filtro por Setor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <User className="h-4 w-4 mr-1" />
              Setor
            </label>
            <Select value={selectedSetor} onValueChange={onSetorChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os setores</SelectItem>
                {setores.map((setor) => (
                  <SelectItem key={setor} value={setor}>
                    {setor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;
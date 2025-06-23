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

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      {/* Header do filtro */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">
            {isAdmin ? 'Filtrar Dashboards' : 'Buscar Dashboards'}
          </h3>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
              Filtros ativos
            </span>
          )}
        </div>
        
        {/* Botão para expandir filtros (só para coordenadores) */}
        {isCoordenador && !isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? 'Menos filtros' : 'Mais filtros'}
          </Button>
        )}
      </div>

      {/* Campo de busca - SEMPRE VISÍVEL para todos */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Nome do dashboard..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtros avançados - CONDICIONAIS baseados no tipo de usuário */}
        {(isAdmin || (isCoordenador && isExpanded)) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro por Setor - ADMINS e COORDENADORES */}
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

            {/* Filtro por Período - ADMINS e COORDENADORES */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Criado
              </label>
              <Select value={selectedPeriodo} onValueChange={onPeriodoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer período</SelectItem>
                  <SelectItem value="ultima_semana">Última semana</SelectItem>
                  <SelectItem value="ultimo_mes">Último mês</SelectItem>
                  <SelectItem value="ultimo_trimestre">Último trimestre</SelectItem>
                  <SelectItem value="ultimo_ano">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Criador - APENAS ADMINS */}
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  Criado por
                </label>
                <Select value={selectedCriador} onValueChange={onCriadorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer pessoa</SelectItem>
                    {criadores.map((criador) => (
                      <SelectItem key={criador.id} value={criador.id}>
                        {criador.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Botão limpar filtros - SÓ APARECE SE HOUVER FILTROS ATIVOS */}
        {(hasActiveFilters || searchTerm) && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardFilters;
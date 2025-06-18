// src/components/DashboardFilters.tsx - VERSÃO MELHORADA
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X, Search, Calendar, User } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';

interface DashboardFiltersProps {
  selectedSetor: string;
  selectedPeriodo: string;
  selectedCriador: string;
  searchTerm: string;
  onSetorChange: (setor: string) => void;
  onPeriodoChange: (periodo: string) => void;
  onCriadorChange: (criador: string) => void;
  onSearchChange: (search: string) => void;
  onClearFilters: () => void;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  selectedSetor,
  selectedPeriodo,
  selectedCriador,
  searchTerm,
  onSetorChange,
  onPeriodoChange,
  onCriadorChange,
  onSearchChange,
  onClearFilters
}) => {
  const { setores, dashboards } = useDashboard();

  // Extrair criadores únicos dos dashboards
  const criadores = Array.from(
    new Set(
      dashboards
        .map(d => d.criado_por_nome)
        .filter(Boolean)
    )
  ).sort();

  const hasActiveFilters = 
    selectedSetor !== 'all' || 
    selectedPeriodo !== 'all' || 
    selectedCriador !== 'all' ||
    searchTerm.trim() !== '';

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-corporate-blue" />
          <h3 className="font-medium text-corporate-blue">Filtrar Dashboards</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-corporate-gray hover:text-corporate-blue"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Busca por Nome */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-corporate-gray flex items-center">
            <Search className="h-4 w-4 mr-1" />
            Buscar
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Nome do dashboard..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-rmh-primary focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filtro por Setor */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-corporate-gray">
            Setor
          </label>
          <Select value={selectedSetor} onValueChange={onSetorChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {setores.map(setor => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Período de Criação */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-corporate-gray flex items-center">
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
              <SelectItem value="ultimos_3_meses">Últimos 3 meses</SelectItem>
              <SelectItem value="ultimo_ano">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Criador */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-corporate-gray flex items-center">
            <User className="h-4 w-4 mr-1" />
            Criado por
          </label>
          <Select value={selectedCriador} onValueChange={onCriadorChange}>
            <SelectTrigger>
              <SelectValue placeholder="Qualquer pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer pessoa</SelectItem>
              {criadores.map(criador => (
                <SelectItem key={criador} value={criador}>
                  {criador}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo dos filtros aplicados */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {selectedSetor !== 'all' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Setor: {selectedSetor}
                <button
                  onClick={() => onSetorChange('all')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedPeriodo !== 'all' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Período: {selectedPeriodo.replace('_', ' ')}
                <button
                  onClick={() => onPeriodoChange('all')}
                  className="ml-1 text-green-600 hover:text-green-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedCriador !== 'all' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Criador: {selectedCriador}
                <button
                  onClick={() => onCriadorChange('all')}
                  className="ml-1 text-purple-600 hover:text-purple-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Busca: "{searchTerm}"
                <button
                  onClick={() => onSearchChange('')}
                  className="ml-1 text-yellow-600 hover:text-yellow-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;
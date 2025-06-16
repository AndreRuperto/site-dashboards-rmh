import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';

interface DashboardFiltersProps {
  selectedCategory: string;
  selectedDepartment: string;
  onCategoryChange: (category: string) => void;
  onDepartmentChange: (department: string) => void;
  onClearFilters: () => void;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  selectedCategory,
  selectedDepartment,
  onCategoryChange,
  onDepartmentChange,
  onClearFilters
}) => {
  // 🔧 CORREÇÃO: useDashboard em vez de useDashboards
  const { setores } = useDashboard();

  const hasActiveFilters = selectedCategory !== 'all' || selectedDepartment !== 'all';

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-corporate-blue" />
          <h3 className="font-medium text-corporate-blue">Filtros</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-corporate-gray hover:text-corporate-blue"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {/* 🔧 CORREÇÃO: Usar "Setor" em vez de "Categoria" */}
          <label className="text-sm font-medium text-corporate-gray">Setor</label>
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {/* 🔧 CORREÇÃO: Usar setores do contexto */}
              {setores.map(setor => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {/* 🔧 NOTA: Este campo pode ser removido já que temos apenas "setor" na interface */}
          <label className="text-sm font-medium text-corporate-gray">Departamento</label>
          <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os departamentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {/* 🔧 CORREÇÃO: Usar setores também aqui ou remover este campo */}
              {setores.map(setor => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 🔧 SUGESTÃO: Mostrar quantos dashboards foram encontrados */}
      <div className="mt-3 text-xs text-corporate-gray">
        Use os filtros acima para encontrar dashboards específicos
      </div>
    </div>
  );
};

export default DashboardFilters;
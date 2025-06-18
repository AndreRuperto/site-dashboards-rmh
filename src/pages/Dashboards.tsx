// src/pages/Dashboards.tsx - VERSÃO MELHORADA
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard } from 'lucide-react';
import Header from '@/components/Header';
import DashboardCard from '@/components/DashboardCard';
import DashboardFilters from '@/components/DashboardFilters';
import DashboardForm from '@/components/DashboardForm';
import { useDashboard, type Dashboard, type DashboardFilters as FilterType } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Dashboards: React.FC = () => {
  // Estados para filtros
  const [selectedSetor, setSelectedSetor] = useState('all');
  const [selectedPeriodo, setSelectedPeriodo] = useState('all');
  const [selectedCriador, setSelectedCriador] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

  const { user } = useAuth();
  const { getFilteredDashboards, deleteDashboard } = useDashboard();
  const { toast } = useToast();

  // Aplicar filtros
  const filteredDashboards = getFilteredDashboards({
    setor: selectedSetor === 'all' ? undefined : selectedSetor,
    periodo: selectedPeriodo === 'all' ? undefined : selectedPeriodo,
    criador: selectedCriador === 'all' ? undefined : selectedCriador,
    searchTerm: searchTerm
  });

  const handleClearFilters = () => {
    setSelectedSetor('all');
    setSelectedPeriodo('all');
    setSelectedCriador('all');
    setSearchTerm('');
  };

  const handleEditDashboard = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setIsFormOpen(true);
  };

  const handleDeleteDashboard = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este dashboard?')) {
      deleteDashboard(id);
      toast({
        title: "Sucesso",
        description: "Dashboard excluído com sucesso"
      });
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingDashboard(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <h1 className="text-3xl font-heading font-bold text-rmh-primary">
                Dashboards Corporativos
              </h1>
              <p className="text-corporate-gray mt-1">
                Visualize e analise os dados da sua empresa em tempo real
              </p>
            </div>
            
            {user?.tipo_usuario === 'admin' && (
              <Button
                onClick={() => setIsFormOpen(true)}
                className="bg-[#165A5D] hover:bg-[#0d3638] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Dashboard
              </Button>
            )}
          </div>

          {/* Filtros Melhorados */}
          <DashboardFilters
            selectedSetor={selectedSetor}
            selectedPeriodo={selectedPeriodo}
            selectedCriador={selectedCriador}
            searchTerm={searchTerm}
            onSetorChange={setSelectedSetor}
            onPeriodoChange={setSelectedPeriodo}
            onCriadorChange={setSelectedCriador}
            onSearchChange={setSearchTerm}
            onClearFilters={handleClearFilters}
          />

          {/* Dashboards Grid */}
          <div className="space-y-4">
            {filteredDashboards.length > 0 ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-corporate-gray">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>
                      {filteredDashboards.length} dashboard{filteredDashboards.length !== 1 ? 's' : ''} encontrado{filteredDashboards.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {/* Mostrar total quando há filtros ativos */}
                  {(selectedSetor !== 'all' || selectedPeriodo !== 'all' || selectedCriador !== 'all' || searchTerm) && (
                    <div className="text-xs text-corporate-gray">
                      Mostrando resultados filtrados
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDashboards.map(dashboard => (
                    <DashboardCard
                      key={dashboard.id}
                      dashboard={dashboard}
                      onEdit={handleEditDashboard}
                      onDelete={handleDeleteDashboard}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <LayoutDashboard className="h-16 w-16 text-corporate-gray mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-corporate-blue mb-2">
                  Nenhum dashboard encontrado
                </h3>
                
                {/* Mensagens diferentes baseadas nos filtros */}
                {selectedSetor !== 'all' || selectedPeriodo !== 'all' || selectedCriador !== 'all' || searchTerm ? (
                  <div className="space-y-3">
                    <p className="text-corporate-gray">
                      Não encontramos dashboards que correspondam aos filtros aplicados.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button variant="outline" onClick={handleClearFilters}>
                        Limpar Filtros
                      </Button>
                      {user?.tipo_usuario === 'admin' && (
                        <Button onClick={() => setIsFormOpen(true)} className="bg-primary hover:bg-primary-800">
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Dashboard
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-corporate-gray">
                      Não há dashboards criados ainda.
                    </p>
                    {user?.tipo_usuario === 'admin' && (
                      <Button 
                        onClick={() => setIsFormOpen(true)} 
                        className="bg-[#165A5D] hover:bg-[#0d3638] text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Primeiro Dashboard
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal do Formulário */}
      <DashboardForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        dashboard={editingDashboard}
      />
    </div>
  );
};

export default Dashboards;
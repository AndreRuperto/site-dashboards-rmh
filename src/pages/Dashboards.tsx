
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard, Dashboard } from '@/contexts/DashboardContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import DashboardFilters from '@/components/DashboardFilters';
import DashboardCard from '@/components/DashboardCard';
import DashboardForm from '@/components/DashboardForm';

const DashboardsPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

  const { user } = useAuth();
  const { getFilteredDashboards, deleteDashboard } = useDashboard();
  const { toast } = useToast();

  const filteredDashboards = getFilteredDashboards(
    selectedCategory === 'all' ? undefined : selectedCategory
  );

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedDepartment('all');
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
                className="bg-rmh-primary hover:bg-primary-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Dashboard
              </Button>
            )}
          </div>

          {/* Filters */}
          <DashboardFilters
            selectedCategory={selectedCategory}
            selectedDepartment={selectedDepartment}
            onCategoryChange={setSelectedCategory}
            onDepartmentChange={setSelectedDepartment}
            onClearFilters={handleClearFilters}
          />

          {/* Dashboards Grid */}
          <div className="space-y-4">
            {filteredDashboards.length > 0 ? (
              <>
                <div className="flex items-center space-x-2 text-sm text-corporate-gray">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>
                    {filteredDashboards.length} dashboard{filteredDashboards.length !== 1 ? 's' : ''} encontrado{filteredDashboards.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDashboards.map((dashboard) => (
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
                <p className="text-corporate-gray mb-6">
                  {selectedCategory !== 'all' || selectedDepartment !== 'all'
                    ? 'Tente ajustar os filtros para encontrar dashboards.'
                    : 'Não há dashboards criados ainda.'}
                </p>
                {(selectedCategory !== 'all' || selectedDepartment !== 'all') && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Limpar Filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dashboard Form Modal */}
      <DashboardForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        dashboard={editingDashboard}
      />
    </div>
  );
};

export default DashboardsPage;

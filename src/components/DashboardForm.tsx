import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDashboard, Dashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Users, Shield, Globe } from 'lucide-react';

interface DashboardFormProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard?: Dashboard | null;
}

const DashboardForm: React.FC<DashboardFormProps> = ({ isOpen, onClose, dashboard }) => {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    setor: '',
    url_iframe: '',
    ativo: true,
    largura: 1200,
    altura: 600,
    tipo_visibilidade: 'geral' as 'geral' | 'coordenadores' | 'admin'
  });

  const { addDashboard, updateDashboard, setores } = useDashboard();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (dashboard) {
      setFormData({
        titulo: dashboard.titulo,
        descricao: dashboard.descricao || '',
        setor: dashboard.setor,
        url_iframe: dashboard.url_iframe,
        ativo: dashboard.ativo,
        largura: dashboard.largura || 1200,
        altura: dashboard.altura || 600,
        tipo_visibilidade: dashboard.tipo_visibilidade || 'geral'
      });
    } else {
      setFormData({
        titulo: '',
        descricao: '',
        setor: '',
        url_iframe: '',
        ativo: true,
        largura: 1200,
        altura: 600,
        tipo_visibilidade: 'geral'
      });
    }
  }, [dashboard, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo.trim() || !formData.url_iframe.trim()) {
      toast({
        title: "Erro",
        description: "Título e URL do iframe são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      if (dashboard) {
        await updateDashboard(dashboard.id, formData);
        toast({
          title: "Sucesso",
          description: "Dashboard atualizado com sucesso"
        });
      } else {
        await addDashboard({
          ...formData,
          criado_por: user?.id || ''
        });
        toast({
          title: "Sucesso",
          description: "Dashboard criado com sucesso"
        });
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar dashboard:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar dashboard",
        variant: "destructive"
      });
    }
  };

  const setoresPredefinidos = [
    'Carteira',
    'Atendimento',
    'Prazos',
    'Trabalhista',
    'Projetos',
    'Inicial',
    'Criminal',
    'Financeiro',
    'Saúde',
    'Comercial/Marketing',
    'Administrativo',
    'Família e Sucessões'
  ];

  const visibilityOptions = [
    {
      value: 'geral',
      label: 'Geral',
      description: 'Visível para todos os usuários',
      icon: Globe,
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    {
      value: 'coordenadores',
      label: 'Coordenadores',
      description: 'Visível apenas para coordenadores e admins',
      icon: Users,
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      value: 'admin',
      label: 'Administradores',
      description: 'Visível apenas para administradores',
      icon: Shield,
      color: 'bg-red-100 text-red-800 border-red-200'
    }
  ];

  const selectedVisibility = visibilityOptions.find(opt => opt.value === formData.tipo_visibilidade);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-semibold text-corporate-blue">
            {dashboard ? 'Editar Dashboard' : 'Novo Dashboard'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Nome do dashboard"
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva o que este dashboard apresenta"
              rows={3}
            />
          </div>

          {/* Setor e Visibilidade lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Setor */}
            <div className="space-y-2">
              <Label htmlFor="setor">Setor *</Label>
              <Select value={formData.setor} onValueChange={(value) => setFormData(prev => ({ ...prev, setor: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {setoresPredefinidos.map(setor => (
                    <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                  ))}
                  {setores.filter(setor => !setoresPredefinidos.includes(setor)).map(setor => (
                    <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Visibilidade */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Tipo de Visibilidade *
              </Label>
              <Select 
                value={formData.tipo_visibilidade} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_visibilidade: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a visibilidade" />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                          <Badge className={`text-xs ${option.color}`}>
                            {option.value === 'geral' ? 'Público' : 
                             option.value === 'coordenadores' ? 'Restrito' : 'Privado'}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* URL do Power BI */}
          <div className="space-y-2">
            <Label htmlFor="url_iframe">URL do Power BI *</Label>
            <Input
              id="url_iframe"
              value={formData.url_iframe}
              onChange={(e) => setFormData(prev => ({ ...prev, url_iframe: e.target.value }))}
              placeholder="https://app.fabric.microsoft.com/view?r=..."
              required
            />
          </div>

          {/* Dimensões */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="largura">Largura (px)</Label>
              <Input
                id="largura"
                type="number"
                value={formData.largura}
                onChange={(e) => setFormData(prev => ({ ...prev, largura: parseInt(e.target.value) || 1200 }))}
                min="600"
                max="2000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura">Altura (px)</Label>
              <Input
                id="altura"
                type="number"
                value={formData.altura}
                onChange={(e) => setFormData(prev => ({ ...prev, altura: parseInt(e.target.value) || 600 }))}
                min="400"
                max="1200"
              />
            </div>
          </div>

          {/* Dashboard Ativo */}
          <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
            />
            <Label htmlFor="ativo" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              {formData.ativo ? (
                <>
                  <Eye className="h-4 w-4 text-green-600" />
                  Dashboard ativo
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 text-gray-400" />
                  Dashboard inativo
                </>
              )}
            </Label>
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-corporate-blue hover:bg-corporate-blue/90"
              disabled={!formData.titulo.trim() || !formData.url_iframe.trim() || !formData.setor}
            >
              {dashboard ? 'Atualizar' : 'Criar Dashboard'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DashboardForm;
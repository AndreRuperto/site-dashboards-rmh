// src/pages/Home.tsx - Página Inicial com Dashboard Principal
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, RotateCw, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { service, factories, models, Report } from 'powerbi-client';

// ==================== INTERFACES ====================
interface PowerBIEmbedToken {
  accessToken: string;
  tokenType: string;
  expiration: string;
  reportId: string;
  groupId: string;
  embedUrl: string;
  generatedAt: string;
  validFor: number;
}

interface MainDashboard {
  id: string;
  titulo: string;
  descricao?: string;
  url_iframe: string;
  embed_type?: 'public' | 'secure';
  powerbi_report_id?: string;
  powerbi_group_id?: string;
  setor: string;
}

// ==================== COMPONENTE PRINCIPAL ====================
const Home: React.FC = () => {
  // ========== HOOKS ==========
  const { user } = useAuth();
  const { toast } = useToast();
  
  // ========== ESTADOS ==========
  const [dashboard, setDashboard] = useState<MainDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedToken, setEmbedToken] = useState<PowerBIEmbedToken | null>(null);
  const [powerbiReport, setPowerbiReport] = useState<Report | null>(null);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    titulo: 'Dashboard Geral',
    descricao: 'Dashboard principal da página inicial',
    url_iframe: ''
  });
  
  // ========== REFS ==========
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ==================== FUNÇÕES DE API ====================
  
  // Buscar dashboard principal
  const fetchMainDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/main-dashboard`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Dashboard não existe
          if (user?.tipo_usuario === 'admin') {
            setIsSetupModalOpen(true);
            setError('Dashboard principal não configurado.'); // Não mostrar erro para admin
            setIsLoading(false); // ✅ IMPORTANTE: parar loading
          } else {
            setError('Dashboard principal não configurado. Entre em contato com o administrador.');
            setIsLoading(false);
          }
          return;
        }
        throw new Error('Erro ao carregar dashboard principal');
      }

      const data = await response.json();
      setDashboard(data.dashboard);

      if (data.dashboard.embed_type === 'secure' && data.dashboard.powerbi_report_id) {
        await getEmbedToken(data.dashboard);
      } else {
        setIsLoading(false);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dashboard');
      setIsLoading(false);
    }
  };

  // Criar dashboard principal
  const handleCreateMainDashboard = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo.trim() || !formData.url_iframe.trim()) {
      toast({
        title: "Erro",
        description: "Título e URL do Power BI são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

      const response = await fetch(`${API_BASE_URL}/api/dashboards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          titulo: formData.titulo,
          descricao: formData.descricao,
          setor: 'Geral',
          tipo: 'Geral',
          url_iframe: formData.url_iframe,
          ativo: true,
          largura: 1200,
          altura: 600,
          tipo_visibilidade: 'geral',
          criado_por: user?.id
        })
      });

      if (!response.ok) throw new Error('Erro ao criar dashboard principal');

      toast({
        title: "Sucesso",
        description: "Dashboard principal criado com sucesso!"
      });

      setFormData({
        titulo: 'Dashboard Geral',
        descricao: 'Dashboard principal da página inicial',
        url_iframe: ''
      });
      setIsSetupModalOpen(false);
      fetchMainDashboard();

    } catch (error) {
      console.error('Erro ao criar dashboard:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar dashboard principal",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obter token para dashboard seguro
  const getEmbedToken = async (dashboardData: MainDashboard) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_BASE_URL}/api/powerbi/embed-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          reportId: dashboardData.powerbi_report_id,
          groupId: dashboardData.powerbi_group_id,
          dashboardId: dashboardData.id
        })
      });

      if (!response.ok) throw new Error('Erro ao obter token');

      const tokenData = await response.json();
      setEmbedToken(tokenData);
      setTimeout(() => embedSecureReport(tokenData), 100);

    } catch (error) {
      console.error('❌ Erro ao obter token:', error);
      setError('Erro ao autenticar dashboard seguro');
      setIsLoading(false);
    }
  };

  // Embed de dashboard seguro
  const embedSecureReport = async (token: PowerBIEmbedToken) => {
    if (!reportContainerRef.current) return;

    try {
      const embedConfig = {
        type: 'report',
        id: token.reportId,
        embedUrl: token.embedUrl,
        accessToken: token.accessToken,
        tokenType: models.TokenType.Embed,
        permissions: models.Permissions.Read,
        settings: {
          layoutType: models.LayoutType.Custom,
          customLayout: { displayOption: models.DisplayOption.FitToPage },
          panes: {
            filters: { visible: false, expanded: false },
            pageNavigation: { visible: true, position: models.PageNavigationPosition.Bottom }
          },
          visualSettings: {
            visualHeaders: [{ settings: { visible: false } }]
          },
          background: models.BackgroundType.Default,
          bars: {
            statusBar: { visible: false },
            actionBar: { visible: false }
          }
        }
      };

      if (powerbiReport) {
        powerbiReport.off('loaded');
        powerbiReport.off('error');
        powerbiReport.off('rendered');
      }

      const powerbiService = new service.Service(
        factories.hpmFactory, 
        factories.wpmpFactory, 
        factories.routerFactory
      );

      const report = powerbiService.embed(reportContainerRef.current, embedConfig) as Report;
      setPowerbiReport(report);

      report.on('loaded', () => {
        console.log('✅ Dashboard carregado');
        setIsLoading(false);
      });

      report.on('error', (event) => {
        console.error('❌ Erro no Power BI:', event.detail);
        setError('Erro ao carregar dashboard');
        setIsLoading(false);
      });

    } catch (error) {
      console.error('❌ Erro no embed:', error);
      setError('Erro ao inicializar dashboard');
      setIsLoading(false);
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    fetchMainDashboard();

    return () => {
      if (powerbiReport) {
        powerbiReport.off('loaded');
        powerbiReport.off('error');
        powerbiReport.off('rendered');
      }
    };
  }, []);

  // ==================== RENDER ====================
  const isSecureDashboard = dashboard?.embed_type === 'secure';

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      
      <main className="flex-1 relative overflow-auto">
        {/* Loading */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 text-[#165A5D] animate-spin" />
              <p className="text-sm text-gray-600">Carregando dashboard...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center space-y-4 text-center p-6 max-w-md">
              <AlertTriangle className="h-12 w-12 text-amber-500" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Dashboard Indisponível</h3>
                <p className="text-sm text-gray-600 mb-4">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Seguro */}
        {isSecureDashboard && !error && (
          <div className="relative w-full h-full">
            <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none" style={{ height: '42px', background: '#ffffff' }} />
            <div ref={reportContainerRef} className="w-full h-full" style={{ minHeight: '500px' }} />
          </div>
        )}

        {/* ✅ Dashboard Embed - Iframe Público COM CLIPPING */}
        {dashboard && !isSecureDashboard && !error && (
          <div className="w-full h-full powerbi-container-clipped-home">
            <iframe
              ref={iframeRef}
              src={dashboard.url_iframe}
              title={dashboard.titulo}
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="yes"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
              style={{
                border: 'none',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                // ✅ Cortar o topo para ocultar banner
                clipPath: 'inset(42px 0px 0px 0px)', // Corta 42px do topo
                display: 'block',
              }}
              onLoad={() => {
                console.log('🚀 Dashboard público carregado!', dashboard.titulo);
                setIsLoading(false);
              }}
              onError={() => {
                console.error('❌ Erro ao carregar dashboard público');
                setError('Erro ao carregar dashboard');
                setIsLoading(false);
              }}
            />
          </div>
        )}
      </main>

      {/* Modal de Configuração */}
      <Dialog open={isSetupModalOpen} onOpenChange={(open) => !isSubmitting && setIsSetupModalOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-semibold text-corporate-blue flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Dashboard Principal
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2">
              Configure o dashboard que será exibido na página inicial para todos os usuários
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMainDashboard} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Nome do dashboard"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descreva o que este dashboard apresenta"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url_iframe">URL do Power BI *</Label>
              <Input
                id="url_iframe"
                value={formData.url_iframe}
                onChange={(e) => setFormData(prev => ({ ...prev, url_iframe: e.target.value }))}
                placeholder="https://app.fabric.microsoft.com/view?r=..."
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">Cole a URL de embed do seu relatório Power BI</p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsSetupModalOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-rmh-lightGreen hover:bg-rmh-primary"
                disabled={isSubmitting || !formData.titulo.trim() || !formData.url_iframe.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Dashboard
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
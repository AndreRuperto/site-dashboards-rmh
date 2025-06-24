// src/pages/Home.tsx - Página Inicial com Dashboard Principal
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

// ✅ IMPORTAÇÃO DA BIBLIOTECA OFICIAL DO POWER BI (se necessário)
import { service, factories, models, Embed } from 'powerbi-client';

interface PowerBIEmbed extends Embed {
  remove?: () => void;
}

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

const Home: React.FC = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<MainDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embedToken, setEmbedToken] = useState<PowerBIEmbedToken | null>(null);
  const [powerbiReport, setPowerbiReport] = useState<PowerBIEmbed | null>(null);
  
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ✅ BUSCAR O DASHBOARD PRINCIPAL (configurável via admin)
  const fetchMainDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://resendemh.up.railway.app'
        : 'http://localhost:3001';

      const response = await fetch(`${API_BASE_URL}/api/main-dashboard`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        // ✅ TRATAMENTO ESPECÍFICO PARA 404
        if (response.status === 404) {
          const data = await response.json();
          throw new Error(data.suggestion || 'Dashboard principal não configurado');
        }
        throw new Error('Erro ao carregar dashboard principal');
      }

      const data = await response.json();
      setDashboard(data.dashboard);

      // ✅ Se é dashboard seguro E tem powerbi_report_id, obter token
      if (data.dashboard.embed_type === 'secure' && data.dashboard.powerbi_report_id) {
        await getEmbedToken(data.dashboard);
      } else {
        // Dashboard público, não precisa de token
        setIsLoading(false);
      }

    } catch (error) {
      console.error('❌ Erro ao carregar dashboard principal:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dashboard');
      setIsLoading(false);
    }
  };

  // ✅ OBTER TOKEN PARA DASHBOARDS SEGUROS
  const getEmbedToken = async (dashboardData: MainDashboard) => {
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'production' 
        ? 'https://resendemh.up.railway.app'
        : 'http://localhost:3001';

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

      if (!response.ok) {
        throw new Error('Erro ao obter token de autenticação');
      }

      const tokenData = await response.json();
      setEmbedToken(tokenData);
      
      // Inicializar Power BI Embed
      setTimeout(() => {
        embedSecureReport(tokenData);
      }, 100);

    } catch (error) {
      console.error('❌ Erro ao obter token:', error);
      setError('Erro ao autenticar dashboard seguro');
      setIsLoading(false);
    }
  };

  // ✅ EMBED SEGURO COM POWER BI CLIENT
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
          panes: {
            filters: { expanded: false, visible: false },
            pageNavigation: { visible: false }
          },
          background: models.BackgroundType.Transparent,
          bars: {
            statusBar: { visible: false },
            actionBar: { visible: false }
          }
        }
      };

      // Limpar embed anterior
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          if (powerbiReport.remove) powerbiReport.remove();
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }

      const powerbiService = new service.Service(
        factories.hpmFactory, 
        factories.wpmpFactory, 
        factories.routerFactory
      );

      const report = powerbiService.embed(reportContainerRef.current, embedConfig) as PowerBIEmbed;
      setPowerbiReport(report);

      report.on('loaded', () => {
        console.log('✅ Dashboard principal carregado');
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

  // ✅ RECARREGAR DASHBOARD (função mantida para eventuais usos futuros)
  const handleRefresh = () => {
    if (dashboard?.embed_type === 'secure') {
      fetchMainDashboard();
    } else if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // ✅ ABRIR EM NOVA ABA (função mantida para eventuais usos futuros)
  const handleOpenInNewTab = () => {
    if (dashboard) {
      window.open(dashboard.url_iframe, '_blank');
    }
  };

  // ✅ INICIALIZAR AO CARREGAR A PÁGINA
  useEffect(() => {
    fetchMainDashboard();

    // Cleanup ao desmontar
    return () => {
      if (powerbiReport) {
        try {
          powerbiReport.off('loaded');
          powerbiReport.off('error');
          if (powerbiReport.remove) powerbiReport.remove();
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }
    };
  }, []);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header Fixo */}
      <Header />
      
      {/* Container do Dashboard - Ocupa 100% do espaço restante */}
      <main className="flex-1 relative min-h-0">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#165A5D]" />
              <p className="text-sm text-gray-600">
                Carregando dashboard principal...
              </p>
              {dashboard?.embed_type === 'secure' && (
                <p className="text-xs text-gray-500">Autenticando...</p>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <div className="flex flex-col items-center space-y-4 text-center p-6">
              <AlertTriangle className="h-12 w-12 text-red-500" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Dashboard Indisponível
                </h3>
                <p className="text-sm text-gray-600 mb-4">{error}</p>
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={fetchMainDashboard}
                  className="bg-[#165A5D] hover:bg-[#0d3638]"
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                {user?.tipo_usuario !== 'usuario' && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/dashboards'}
                  >
                    Ver Todos os Dashboards
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Embed - Power BI Seguro */}
        {dashboard?.embed_type === 'secure' && !error && (
          <div 
            ref={reportContainerRef}
            className="absolute inset-0 w-full h-full"
          />
        )}

        {/* Dashboard Embed - Iframe Público */}
        {dashboard && dashboard.embed_type !== 'secure' && !error && (
          <iframe
            ref={iframeRef}
            src={`${dashboard.url_iframe}&navContentPaneEnabled=false`}
            title={dashboard.titulo}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setError('Erro ao carregar dashboard');
              setIsLoading(false);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Home;
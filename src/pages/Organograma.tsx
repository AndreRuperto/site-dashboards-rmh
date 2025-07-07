import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Configurações da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Usuario {
  id: string;
  nome: string;
  setor: string;
  cargo: string;
  sub_setor?: string;
  email: string;
  telefone?: string;
  status: string;
  tipo_usuario: 'usuario' | 'admin';
  tipo_colaborador: 'estagiario' | 'clt_associado';
  is_coordenador: boolean;
  ativo: boolean;
  email_verificado: boolean;
}

interface CargoProps {
  titulo: string;
  nome: string;
  setor: string;
  tipo: 'diretor' | 'gerente' | 'coordenador' | 'assistente' | 'estagiario';
  info?: string;
  temFilhos?: boolean;
  onExpand?: () => void;
  expandido?: boolean;
}

interface NivelProps {
  children: React.ReactNode;
  id?: string;
  oculto?: boolean;
  expandido?: boolean;
  className?: string;
  titulo?: string;
}

const Cargo: React.FC<CargoProps> = ({ 
  titulo, 
  nome, 
  setor, 
  tipo, 
  info, 
  temFilhos = false, 
  onExpand,
  expandido = false 
}) => {
  return (
    <div 
      className={`cargo ${tipo}`}
      data-info={info}
      style={{
        background: getCargoBg(tipo),
        color: getCargoColor(tipo),
        borderRadius: '12px',
        padding: '16px',
        margin: '0 8px 8px 8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center',
        minWidth: '180px',
        maxWidth: '220px',
        position: 'relative',
        transition: 'all 0.3s ease',
        cursor: temFilhos ? 'pointer' : 'default',
        border: '2px solid transparent',
        fontWeight: tipo === 'diretor' ? 'bold' : tipo === 'gerente' || tipo === 'coordenador' ? '600' : '500'
      }}
      onMouseEnter={(e) => {
        if (temFilhos) {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(22, 90, 93, 0.2)';
          e.currentTarget.style.borderColor = '#165A5D';
        }
      }}
      onMouseLeave={(e) => {
        if (temFilhos) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
      onClick={temFilhos ? onExpand : undefined}
    >
      <h3 style={{
        fontFamily: 'Ruda, sans-serif',
        fontSize: '1rem',
        marginBottom: '6px',
        lineHeight: '1.2',
        fontWeight: '600'
      }}>
        {titulo}
      </h3>
      <div style={{
        fontSize: '0.875rem',
        opacity: 0.95,
        marginBottom: '4px',
        fontWeight: '500'
      }}>
        {nome}
      </div>
      <div style={{
        fontSize: '0.75rem',
        opacity: 0.8,
        fontStyle: 'italic'
      }}>
        {setor}
      </div>
      
      {temFilhos && (
        <div
          style={{
            background: 'rgba(255,255,255,0.9)',
            color: '#165A5D',
            border: '2px solid #165A5D',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            bottom: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {expandido ? '−' : '+'}
        </div>
      )}
    </div>
  );
};

const Nivel: React.FC<NivelProps> = ({ children, id, oculto = false, expandido = false, className = '', titulo }) => {
  const isVisible = !oculto || expandido;
  
  return (
    <div 
      id={id}
      className={`nivel ${className}`}
      style={{
        display: isVisible ? 'block' : 'none',
        marginBottom: '40px',
        position: 'relative'
      }}
    >
      {titulo && (
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#165A5D',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {titulo}
        </div>
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px',
        position: 'relative'
      }}>
        {children}
      </div>
    </div>
  );
};

const getCargoBg = (tipo: string): string => {
  switch (tipo) {
    case 'diretor':
      return 'linear-gradient(135deg, #0d3638 0%, #165A5D 100%)';
    case 'gerente':
      return 'linear-gradient(135deg, #165A5D 0%, #2a7a7f 100%)';
    case 'coordenador':
      return 'linear-gradient(135deg, #4a9fa3 0%, #6bb6ba 100%)';
    case 'assistente':
      return 'linear-gradient(135deg, #8cc8cc 0%, #aad3d6 100%)';
    case 'estagiario':
      return 'linear-gradient(135deg, #b8dde0 0%, #d4e8ea 100%)';
    default:
      return '#165A5D';
  }
};

const getCargoColor = (tipo: string): string => {
  switch (tipo) {
    case 'diretor':
    case 'gerente':
    case 'coordenador':
      return 'white';
    case 'assistente':
    case 'estagiario':
      return '#0d3638';
    default:
      return 'white';
  }
};

// Componente para criar conexões hierárquicas
const ConexoesHierarquicas: React.FC<{ 
  nivelPai: string; 
  nivelFilho: string; 
  quantidadePais: number; 
  quantidadeFilhos: number;
  topPai: number;
  topFilho: number;
}> = ({ nivelPai, nivelFilho, quantidadePais, quantidadeFilhos, topPai, topFilho }) => {
  
  // Linha vertical principal do centro
  const linhaVerticalPrincipal = (
    <div style={{
      position: 'absolute',
      width: '2px',
      height: '30px',
      background: '#165A5D',
      left: '50%',
      transform: 'translateX(-50%)',
      top: `${topPai}px`,
      zIndex: 1
    }} />
  );

  // Linha horizontal para conectar filhos
  const linhaHorizontal = quantidadeFilhos > 1 ? (
    <div style={{
      position: 'absolute',
      width: `${Math.min(80, quantidadeFilhos * 15)}%`,
      height: '2px',
      background: '#165A5D',
      left: '50%',
      transform: 'translateX(-50%)',
      top: `${topFilho - 15}px`,
      zIndex: 1
    }} />
  ) : null;

  // Linhas verticais para cada filho
  const linhasVerticaisFilhos = [];
  if (quantidadeFilhos > 1) {
    const larguraTotal = Math.min(80, quantidadeFilhos * 15);
    const espacamento = larguraTotal / (quantidadeFilhos + 1);
    
    for (let i = 0; i < quantidadeFilhos; i++) {
      const posicaoX = 50 - (larguraTotal / 2) + (espacamento * (i + 1));
      linhasVerticaisFilhos.push(
        <div
          key={`linha-filho-${i}`}
          style={{
            position: 'absolute',
            width: '2px',
            height: '15px',
            background: '#165A5D',
            left: `${posicaoX}%`,
            top: `${topFilho - 15}px`,
            zIndex: 1
          }}
        />
      );
    }
  } else if (quantidadeFilhos === 1) {
    linhasVerticaisFilhos.push(
      <div
        key="linha-filho-unico"
        style={{
          position: 'absolute',
          width: '2px',
          height: '15px',
          background: '#165A5D',
          left: '50%',
          transform: 'translateX(-50%)',
          top: `${topFilho - 15}px`,
          zIndex: 1
        }}
      />
    );
  }

  return (
    <>
      {linhaVerticalPrincipal}
      {linhaHorizontal}
      {linhasVerticaisFilhos}
    </>
  );
};

const Organograma: React.FC = () => {
  const [niveisExpandidos, setNiveisExpandidos] = useState<Record<string, boolean>>({});
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { toast } = useToast();

  // Função para obter token de autenticação
  const getAuthToken = () => localStorage.getItem("authToken");

  // Função para fazer requisições autenticadas
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    if (!token) throw new Error("Token não encontrado no localStorage");

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.href = "/";
      throw new Error("Token inválido ou expirado");
    }

    return response;
  };

  // Carregar dados dos colaboradores
  const carregarUsuarios = async () => {
    try {
        setCarregando(true);
        console.log('📊 Carregando dados da view vw_colaboradores...');
        
        const response = await fetchWithAuth(`${API_BASE_URL}/api/organograma/colaboradores`);
        
        if (!response.ok) {
        throw new Error("Erro ao carregar dados dos colaboradores");
        }

        const data = await response.json();
        
        const colaboradores = data.colaboradores || [];
        setUsuarios(colaboradores);
        
        console.log(`✅ ${colaboradores.length} colaboradores carregados da view vw_colaboradores`);
        
        toast({
        title: "Organograma atualizado!",
        description: `${colaboradores.length} colaboradores carregados`,
        });
    } catch (error) {
        console.error("❌ Erro ao carregar colaboradores:", error);
        toast({
        title: "Erro ao carregar dados",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive"
        });
    } finally {
        setCarregando(false);
    }
    };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const toggleNivel = (nivelId: string) => {
    setNiveisExpandidos(prev => ({
      ...prev,
      [nivelId]: !prev[nivelId]
    }));
  };

  useEffect(() => {
    // Expansão automática dos primeiros níveis ao carregar
    const timer = setTimeout(() => {
      setNiveisExpandidos(prev => ({ 
        ...prev, 
        'nivel-gerencia': true,
        'nivel-coordenacao': true 
      }));
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Organizar colaboradores por hierarquia melhorada
  const organizarPorHierarquia = () => {
    const diretores = usuarios.filter(u => 
      u.tipo_usuario === 'admin' || 
      (u.cargo && u.cargo.toLowerCase().includes('diretor'))
    );
    
    const gerentes = usuarios.filter(u => 
      u.cargo && (
        u.cargo.toLowerCase().includes('gerente') || 
        u.cargo.toLowerCase().includes('supervisor')
      ) && !diretores.some(d => d.id === u.id)
    );
    
    const coordenadores = usuarios.filter(u => 
      (u.is_coordenador || 
       (u.cargo && u.cargo.toLowerCase().includes('coordenador'))) &&
      !diretores.some(d => d.id === u.id) &&
      !gerentes.some(g => g.id === u.id)
    );
    
    const estagiarios = usuarios.filter(u => 
      u.tipo_colaborador === 'estagiario' &&
      !diretores.some(d => d.id === u.id) &&
      !gerentes.some(g => g.id === u.id) &&
      !coordenadores.some(c => c.id === u.id)
    );
    
    const assistentes = usuarios.filter(u => 
      !diretores.some(d => d.id === u.id) &&
      !gerentes.some(g => g.id === u.id) &&
      !coordenadores.some(c => c.id === u.id) &&
      !estagiarios.some(e => e.id === u.id)
    );

    // Agrupar por setor
    const agruparPorSetor = (colaboradores: Usuario[]) => {
      const grupos: Record<string, Usuario[]> = {};
      colaboradores.forEach(colaborador => {
        const setor = colaborador.setor || 'Outros';
        if (!grupos[setor]) grupos[setor] = [];
        grupos[setor].push(colaborador);
      });
      return grupos;
    };

    return {
      diretores,
      gerentes: agruparPorSetor(gerentes),
      coordenadores: agruparPorSetor(coordenadores),
      assistentes: agruparPorSetor(assistentes),
      estagiarios: agruparPorSetor(estagiarios)
    };
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-6 py-8 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-8 w-8 animate-spin text-rmh-primary" />
              <span className="text-lg font-medium text-gray-700">Carregando organograma...</span>
            </div>
            <div className="text-sm text-gray-500">Buscando dados dos colaboradores</div>
          </div>
        </div>
      </div>
    );
  }

  const hierarquia = organizarPorHierarquia();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-6 py-8" style={{
        fontFamily: 'Raleway, Segoe UI, sans-serif',
        paddingTop: '20px',
        paddingBottom: '40px'
      }}>
        {/* Container do Organograma */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          padding: '30px 20px',
          overflowX: 'auto',
          position: 'relative',
          minHeight: 'calc(100vh - 180px)'
        }}>

          {/* Nível 1: Diretoria */}
          {hierarquia.diretores.length > 0 && (
            <Nivel titulo="DIRETORIA">
              {hierarquia.diretores.map((diretor) => (
                <Cargo
                  key={diretor.id}
                  titulo={diretor.cargo || "DIRETOR"}
                  nome={diretor.nome}
                  setor={diretor.setor}
                  tipo="diretor"
                  info={`${diretor.cargo} - ${diretor.setor}`}
                  temFilhos={Object.keys(hierarquia.gerentes).length > 0}
                  onExpand={() => toggleNivel('nivel-gerencia')}
                  expandido={niveisExpandidos['nivel-gerencia']}
                />
              ))}
            </Nivel>
          )}

          {/* Conexões entre Diretoria e Gerências */}
          {hierarquia.diretores.length > 0 && Object.keys(hierarquia.gerentes).length > 0 && (
            <ConexoesHierarquicas
              nivelPai="diretoria"
              nivelFilho="gerencia"
              quantidadePais={hierarquia.diretores.length}
              quantidadeFilhos={Object.keys(hierarquia.gerentes).length}
              topPai={100}
              topFilho={200}
            />
          )}

          {/* Nível 2: Gerências por Setor */}
          {Object.keys(hierarquia.gerentes).length > 0 && (
            <Nivel 
              id="nivel-gerencia" 
              oculto={true} 
              expandido={niveisExpandidos['nivel-gerencia']}
              titulo="GERÊNCIAS"
            >
              {Object.entries(hierarquia.gerentes).map(([setor, gerentes]) => (
                <div key={setor} style={{ margin: '0 10px' }}>
                  {gerentes.map((gerente) => (
                    <Cargo
                      key={gerente.id}
                      titulo={gerente.cargo || "GERENTE"}
                      nome={gerente.nome}
                      setor={gerente.setor}
                      tipo="gerente"
                      info={`${gerente.cargo} - ${gerente.setor}`}
                      temFilhos={hierarquia.coordenadores[setor]?.length > 0}
                      onExpand={() => toggleNivel(`coord-${setor}`)}
                      expandido={niveisExpandidos[`coord-${setor}`]}
                    />
                  ))}
                </div>
              ))}
            </Nivel>
          )}

          {/* Conexões dinâmicas para cada setor */}
          {Object.entries(hierarquia.coordenadores).map(([setor, coordenadores], index) => {
            const gerentesSetor = hierarquia.gerentes[setor]?.length || 0;
            const coordenadoresSetor = coordenadores.length;
            
            return coordenadoresSetor > 0 && gerentesSetor > 0 && (
              <div key={`conexao-${setor}`}>
                <ConexoesHierarquicas
                  nivelPai={`gerencia-${setor}`}
                  nivelFilho={`coord-${setor}`}
                  quantidadePais={gerentesSetor}
                  quantidadeFilhos={coordenadoresSetor}
                  topPai={270}
                  topFilho={370}
                />
              </div>
            );
          })}

          {/* Nível 3: Coordenações por Setor */}
          {Object.entries(hierarquia.coordenadores).map(([setor, coordenadores]) => (
            coordenadores.length > 0 && (
              <div key={setor}>
                <Nivel 
                  id={`coord-${setor}`}
                  oculto={true} 
                  expandido={niveisExpandidos[`coord-${setor}`]}
                  titulo={`COORDENAÇÃO - ${setor.toUpperCase()}`}
                >
                  {coordenadores.map((coordenador) => (
                    <Cargo
                      key={coordenador.id}
                      titulo={coordenador.cargo || "COORDENADOR"}
                      nome={coordenador.nome}
                      setor={coordenador.setor}
                      tipo="coordenador"
                      info={`${coordenador.cargo} - ${coordenador.setor}`}
                      temFilhos={
                        (hierarquia.assistentes[setor]?.length > 0) || 
                        (hierarquia.estagiarios[setor]?.length > 0)
                      }
                      onExpand={() => toggleNivel(`equipe-${setor}`)}
                      expandido={niveisExpandidos[`equipe-${setor}`]}
                    />
                  ))}
                </Nivel>
              </div>
            )
          ))}

          {/* Conexões para equipes */}
          {Object.keys(hierarquia.assistentes).concat(Object.keys(hierarquia.estagiarios))
            .filter((setor, index, array) => array.indexOf(setor) === index)
            .map((setor) => {
              const assistentesSetor = hierarquia.assistentes[setor]?.length || 0;
              const estagiariosSetor = hierarquia.estagiarios[setor]?.length || 0;
              const coordenadoresSetor = hierarquia.coordenadores[setor]?.length || 0;
              const totalEquipe = assistentesSetor + estagiariosSetor;

              return totalEquipe > 0 && coordenadoresSetor > 0 && (
                <div key={`conexao-equipe-${setor}`}>
                  <ConexoesHierarquicas
                    nivelPai={`coord-${setor}`}
                    nivelFilho={`equipe-${setor}`}
                    quantidadePais={coordenadoresSetor}
                    quantidadeFilhos={totalEquipe}
                    topPai={440}
                    topFilho={540}
                  />
                </div>
              );
            })}

          {/* Nível 4: Equipes (Assistentes + Estagiários) */}
          {Object.keys(hierarquia.assistentes).concat(Object.keys(hierarquia.estagiarios))
            .filter((setor, index, array) => array.indexOf(setor) === index)
            .map((setor) => {
              const assistentesSetor = hierarquia.assistentes[setor] || [];
              const estagiariosSetor = hierarquia.estagiarios[setor] || [];
              const temEquipe = assistentesSetor.length > 0 || estagiariosSetor.length > 0;

              return temEquipe && (
                <div key={setor}>
                  <Nivel 
                    id={`equipe-${setor}`}
                    oculto={true} 
                    expandido={niveisExpandidos[`equipe-${setor}`]}
                    titulo={`EQUIPE - ${setor.toUpperCase()}`}
                  >
                    {/* Assistentes */}
                    {assistentesSetor.map((assistente) => (
                      <Cargo
                        key={assistente.id}
                        titulo={assistente.cargo || "ASSISTENTE"}
                        nome={assistente.nome}
                        setor={assistente.setor}
                        tipo="assistente"
                        info={`${assistente.cargo} - ${assistente.setor}`}
                      />
                    ))}
                    
                    {/* Estagiários */}
                    {estagiariosSetor.map((estagiario) => (
                      <Cargo
                        key={estagiario.id}
                        titulo="ESTAGIÁRIO"
                        nome={estagiario.nome}
                        setor={estagiario.setor}
                        tipo="estagiario"
                        info={`Estagiário - ${estagiario.setor}`}
                      />
                    ))}
                  </Nivel>
                </div>
              );
            })}

          {/* Mensagem quando não há dados */}
          {usuarios.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#666'
            }}>
              <h3 style={{ marginBottom: '10px', fontSize: '1.2rem' }}>Nenhum colaborador encontrado</h3>
              <p style={{ marginBottom: '20px' }}>Carregue os dados para visualizar o organograma</p>
              <Button
                onClick={carregarUsuarios}
                style={{ 
                  backgroundColor: '#165A5D',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Carregar Dados
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Organograma;
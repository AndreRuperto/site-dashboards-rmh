import React, { useMemo, useRef } from 'react';
import Cargo, { CargoProps, CargoTipo } from './Cargo';
import Nivel from './Nivel';
import LinhasSVG from './LinhasSVG';

export interface Usuario {
  id: string;
  nome: string;
  setor: string;
  cargo: string;
  tipo_usuario: 'usuario' | 'admin';
  tipo_colaborador: 'estagiario' | 'clt_associado';
  is_coordenador: boolean;
}

export interface OrganogramaTreeProps {
  usuarios: Usuario[];
}

const OrganogramaTree: React.FC<OrganogramaTreeProps> = ({ usuarios }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const hierarquia = useMemo(() => {
    const diretores = usuarios.filter(u => u.tipo_usuario === 'admin' || u.cargo?.toLowerCase().includes('diretor'));
    const gerentes = usuarios.filter(u => u.cargo?.toLowerCase().includes('gerente') && !diretores.some(d => d.id === u.id));
    const coordenadores = usuarios.filter(u => (u.is_coordenador || u.cargo?.toLowerCase().includes('coordenador')) && !diretores.some(d => d.id === u.id) && !gerentes.some(g => g.id === u.id));
    const assistentes = usuarios.filter(u => !diretores.some(d => d.id === u.id) && !gerentes.some(g => g.id === u.id) && !coordenadores.some(c => c.id === u.id) && u.tipo_colaborador !== 'estagiario');
    const estagiarios = usuarios.filter(u => u.tipo_colaborador === 'estagiario');
    
    // Agrupa por setor para melhor organização
    const agruparPorSetor = (pessoas: Usuario[]) => {
      const grupos = pessoas.reduce((acc, pessoa) => {
        const setor = pessoa.setor || 'Geral';
        if (!acc[setor]) acc[setor] = [];
        acc[setor].push(pessoa);
        return acc;
      }, {} as Record<string, Usuario[]>);
      
      return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
    };
    
    return { 
      diretores: agruparPorSetor(diretores), 
      gerentes: agruparPorSetor(gerentes), 
      coordenadores: agruparPorSetor(coordenadores), 
      assistentes: agruparPorSetor(assistentes), 
      estagiarios: agruparPorSetor(estagiarios) 
    };
  }, [usuarios]);

  // refs for each level - flatten groups for refs
  const diretorRefs = useRef(hierarquia.diretores.flatMap(([_, pessoas]) => pessoas).map(() => React.createRef<HTMLDivElement>()));
  const gerenteRefs = useRef(hierarquia.gerentes.flatMap(([_, pessoas]) => pessoas).map(() => React.createRef<HTMLDivElement>()));
  const coordRefs = useRef(hierarquia.coordenadores.flatMap(([_, pessoas]) => pessoas).map(() => React.createRef<HTMLDivElement>()));
  const equipeRefs = useRef([...hierarquia.assistentes.flatMap(([_, pessoas]) => pessoas), ...hierarquia.estagiarios.flatMap(([_, pessoas]) => pessoas)].map(() => React.createRef<HTMLDivElement>()));

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Diretoria */}
      <Nivel titulo="DIRETORIA">
        {hierarquia.diretores.map(([setor, pessoas], setorIndex) => (
          <div key={setor} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 10px' }}>
            {setor !== 'Geral' && <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#165A5D', marginBottom: '5px' }}>{setor}</div>}
            {pessoas.map((d, i) => {
              const refIndex = hierarquia.diretores.slice(0, setorIndex).flatMap(([_, p]) => p).length + i;
              return (
                <Cargo key={d.id} ref={diretorRefs.current[refIndex]} titulo={d.cargo || 'DIRETOR'} nome={d.nome} setor={d.setor} tipo="diretor" />
              );
            })}
          </div>
        ))}
      </Nivel>

      {/* Gerentes */}
      {hierarquia.gerentes.length > 0 && (
        <Nivel titulo="GERÊNCIAS">
          {hierarquia.gerentes.map(([setor, pessoas], setorIndex) => (
            <div key={setor} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 10px' }}>
              {setor !== 'Geral' && <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#165A5D', marginBottom: '5px' }}>{setor}</div>}
              {pessoas.map((g, i) => {
                const refIndex = hierarquia.gerentes.slice(0, setorIndex).flatMap(([_, p]) => p).length + i;
                return (
                  <Cargo key={g.id} ref={gerenteRefs.current[refIndex]} titulo={g.cargo || 'GERENTE'} nome={g.nome} setor={g.setor} tipo="gerente" />
                );
              })}
            </div>
          ))}
        </Nivel>
      )}

      {/* Coordenadores */}
      {hierarquia.coordenadores.length > 0 && (
        <Nivel titulo="COORDENAÇÃO">
          {hierarquia.coordenadores.map(([setor, pessoas], setorIndex) => (
            <div key={setor} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 10px' }}>
              {setor !== 'Geral' && <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#165A5D', marginBottom: '5px' }}>{setor}</div>}
              {pessoas.map((c, i) => {
                const refIndex = hierarquia.coordenadores.slice(0, setorIndex).flatMap(([_, p]) => p).length + i;
                return (
                  <Cargo key={c.id} ref={coordRefs.current[refIndex]} titulo={c.cargo || 'COORDENADOR'} nome={c.nome} setor={c.setor} tipo="coordenador" />
                );
              })}
            </div>
          ))}
        </Nivel>
      )}

      {/* Equipe */}
      {(hierarquia.assistentes.length + hierarquia.estagiarios.length) > 0 && (
        <Nivel titulo="EQUIPE">
          {[...hierarquia.assistentes, ...hierarquia.estagiarios].map(([setor, pessoas], setorIndex) => (
            <div key={setor} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 10px' }}>
              {setor !== 'Geral' && <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#165A5D', marginBottom: '5px' }}>{setor}</div>}
              {pessoas.map((e, i) => {
                const assistentesLength = hierarquia.assistentes.flatMap(([_, p]) => p).length;
                const isEstagiario = e.tipo_colaborador === 'estagiario';
                const refIndex = isEstagiario ? 
                  assistentesLength + hierarquia.estagiarios.slice(0, setorIndex - hierarquia.assistentes.length).flatMap(([_, p]) => p).length + i :
                  hierarquia.assistentes.slice(0, setorIndex).flatMap(([_, p]) => p).length + i;
                return (
                  <Cargo key={e.id} ref={equipeRefs.current[refIndex]} titulo={e.cargo || (isEstagiario ? 'ESTAGIÁRIO' : 'ASSISTENTE')} nome={e.nome} setor={e.setor} tipo={isEstagiario ? 'estagiario' : 'assistente'} />
                );
              })}
            </div>
          ))}
        </Nivel>
      )}

      {/* Linhas */}
      {hierarquia.diretores.flatMap(([_, pessoas]) => pessoas).length > 0 && hierarquia.gerentes.flatMap(([_, pessoas]) => pessoas).length > 0 && (
        <LinhasSVG root={containerRef} parents={diretorRefs.current} children={gerenteRefs.current} />
      )}
      {hierarquia.gerentes.flatMap(([_, pessoas]) => pessoas).length > 0 && hierarquia.coordenadores.flatMap(([_, pessoas]) => pessoas).length > 0 && (
        <LinhasSVG root={containerRef} parents={gerenteRefs.current} children={coordRefs.current} />
      )}
      {hierarquia.coordenadores.flatMap(([_, pessoas]) => pessoas).length > 0 && equipeRefs.current.length > 0 && (
        <LinhasSVG root={containerRef} parents={coordRefs.current} children={equipeRefs.current} />
      )}
      {hierarquia.diretores.flatMap(([_, pessoas]) => pessoas).length > 0 && hierarquia.coordenadores.flatMap(([_, pessoas]) => pessoas).length > 0 && hierarquia.gerentes.flatMap(([_, pessoas]) => pessoas).length === 0 && (
        <LinhasSVG root={containerRef} parents={diretorRefs.current} children={coordRefs.current} />
      )}
      {hierarquia.gerentes.flatMap(([_, pessoas]) => pessoas).length > 0 && equipeRefs.current.length > 0 && hierarquia.coordenadores.flatMap(([_, pessoas]) => pessoas).length === 0 && (
        <LinhasSVG root={containerRef} parents={gerenteRefs.current} children={equipeRefs.current} />
      )}
      {hierarquia.diretores.flatMap(([_, pessoas]) => pessoas).length > 0 && equipeRefs.current.length > 0 && hierarquia.gerentes.flatMap(([_, pessoas]) => pessoas).length === 0 && hierarquia.coordenadores.flatMap(([_, pessoas]) => pessoas).length === 0 && (
        <LinhasSVG root={containerRef} parents={diretorRefs.current} children={equipeRefs.current} />
      )}
    </div>
  );
};

export default OrganogramaTree;

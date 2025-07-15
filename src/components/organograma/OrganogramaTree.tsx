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
    return { diretores, gerentes, coordenadores, assistentes, estagiarios };
  }, [usuarios]);

  // refs for each level
  const diretorRefs = useRef(hierarquia.diretores.map(() => React.createRef<HTMLDivElement>()));
  const gerenteRefs = useRef(hierarquia.gerentes.map(() => React.createRef<HTMLDivElement>()));
  const coordRefs = useRef(hierarquia.coordenadores.map(() => React.createRef<HTMLDivElement>()));
  const equipeRefs = useRef([...hierarquia.assistentes, ...hierarquia.estagiarios].map(() => React.createRef<HTMLDivElement>()));

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Diretoria */}
      <Nivel titulo="DIRETORIA">
        {hierarquia.diretores.map((d, i) => (
          <Cargo key={d.id} ref={diretorRefs.current[i]} titulo={d.cargo || 'DIRETOR'} nome={d.nome} setor={d.setor} tipo="diretor" />
        ))}
      </Nivel>

      {/* Gerentes */}
      {hierarquia.gerentes.length > 0 && (
        <Nivel titulo="GERÊNCIAS">
          {hierarquia.gerentes.map((g, i) => (
            <Cargo key={g.id} ref={gerenteRefs.current[i]} titulo={g.cargo || 'GERENTE'} nome={g.nome} setor={g.setor} tipo="gerente" />
          ))}
        </Nivel>
      )}

      {/* Coordenadores */}
      {hierarquia.coordenadores.length > 0 && (
        <Nivel titulo="COORDENAÇÃO">
          {hierarquia.coordenadores.map((c, i) => (
            <Cargo key={c.id} ref={coordRefs.current[i]} titulo={c.cargo || 'COORDENADOR'} nome={c.nome} setor={c.setor} tipo="coordenador" />
          ))}
        </Nivel>
      )}

      {/* Equipe */}
      {(hierarquia.assistentes.length + hierarquia.estagiarios.length) > 0 && (
        <Nivel titulo="EQUIPE">
          {[...hierarquia.assistentes, ...hierarquia.estagiarios].map((e, i) => (
            <Cargo key={e.id} ref={equipeRefs.current[i]} titulo={e.cargo || (e.tipo_colaborador === 'estagiario' ? 'ESTAGIÁRIO' : 'ASSISTENTE')} nome={e.nome} setor={e.setor} tipo={e.tipo_colaborador === 'estagiario' ? 'estagiario' : 'assistente'} />
          ))}
        </Nivel>
      )}

      {/* Linhas */}
      {hierarquia.diretores.length > 0 && hierarquia.gerentes.length > 0 && (
        <LinhasSVG root={containerRef} parents={diretorRefs.current} children={gerenteRefs.current} />
      )}
      {hierarquia.gerentes.length > 0 && hierarquia.coordenadores.length > 0 && (
        <LinhasSVG root={containerRef} parents={gerenteRefs.current} children={coordRefs.current} />
      )}
      {hierarquia.coordenadores.length > 0 && equipeRefs.current.length > 0 && (
        <LinhasSVG root={containerRef} parents={coordRefs.current} children={equipeRefs.current} />
      )}
    </div>
  );
};

export default OrganogramaTree;

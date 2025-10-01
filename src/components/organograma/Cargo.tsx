import React from 'react';

export type CargoTipo = 'diretor' | 'gerente' | 'coordenador' | 'assistente' | 'estagiario_ma';

export interface CargoProps {
  titulo: string;
  nome: string;
  setor: string;
  tipo: CargoTipo;
  temFilhos?: boolean;
  onToggle?: () => void;
}

const cargoBg = (tipo: CargoTipo): string => {
  switch (tipo) {
    case 'diretor':
      return 'linear-gradient(135deg, #0d3638 0%, #165A5D 100%)';
    case 'gerente':
      return 'linear-gradient(135deg, #165A5D 0%, #2a7a7f 100%)';
    case 'coordenador':
      return 'linear-gradient(135deg, #4a9fa3 0%, #6bb6ba 100%)';
    case 'assistente':
      return 'linear-gradient(135deg, #8cc8cc 0%, #aad3d6 100%)';
    case 'estagiario_ma':
      return 'linear-gradient(135deg, #b8dde0 0%, #d4e8ea 100%)';
    default:
      return '#165A5D';
  }
};

const cargoColor = (tipo: CargoTipo): string => {
  switch (tipo) {
    case 'assistente':
    case 'estagiario_ma':
      return '#0d3638';
    default:
      return '#ffffff';
  }
};

const Cargo = React.forwardRef<HTMLDivElement, CargoProps>(({
  titulo,
  nome,
  setor,
  tipo,
  temFilhos,
  onToggle
}, ref) => {
  return (
    <div
      ref={ref}
      className={`cargo ${tipo}`}
      style={{
        background: cargoBg(tipo),
        color: cargoColor(tipo),
        borderRadius: '12px',
        padding: '16px',
        margin: '0 8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center',
        minWidth: '160px',
        position: 'relative',
        cursor: temFilhos ? 'pointer' : 'default'
      }}
      onClick={temFilhos ? onToggle : undefined}
    >
      <h3 style={{ fontSize: '1rem', marginBottom: '6px', fontWeight: 600 }}>{titulo}</h3>
      <div style={{ fontSize: '0.875rem', marginBottom: '4px' }}>{nome}</div>
      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{setor}</div>
    </div>
  );
});

Cargo.displayName = 'Cargo';

export default Cargo;

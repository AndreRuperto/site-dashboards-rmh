import React from 'react';

export interface NivelProps {
  titulo?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const Nivel = React.forwardRef<HTMLDivElement, NivelProps>(({ titulo, children, style }, ref) => {
  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', ...style }}>
      {titulo && <div style={{ marginBottom: '16px', fontWeight: 600 }}>{titulo}</div>}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '16px' }}>
        {children}
      </div>
    </div>
  );
});

Nivel.displayName = 'Nivel';

export default Nivel;

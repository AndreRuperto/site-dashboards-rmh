import React, { useEffect, useState } from 'react';

interface RefPair {
  from: React.RefObject<HTMLDivElement>;
  to: React.RefObject<HTMLDivElement>;
}

export interface LinhasSVGProps {
  root: React.RefObject<HTMLDivElement>;
  parents: React.RefObject<HTMLDivElement>[];
  children: React.RefObject<HTMLDivElement>[];
}

interface Line {
  x1: number; y1: number; x2: number; y2: number;
}

const calcLines = (
  root: HTMLDivElement,
  parents: React.RefObject<HTMLDivElement>[],
  children: React.RefObject<HTMLDivElement>[]
): Line[] => {
  const rootRect = root.getBoundingClientRect();
  const lines: Line[] = [];
  
  if (parents.length === 0 || children.length === 0) return lines;
  
  // Se há apenas um parent, conecta a todos os children
  if (parents.length === 1) {
    const parent = parents[0];
    const pr = parent.current?.getBoundingClientRect();
    if (!pr) return lines;
    
    const x1 = pr.left + pr.width / 2 - rootRect.left;
    const y1 = pr.bottom - rootRect.top;
    
    children.forEach(child => {
      const cr = child.current?.getBoundingClientRect();
      if (!cr) return;
      const x2 = cr.left + cr.width / 2 - rootRect.left;
      const y2 = cr.top - rootRect.top;
      lines.push({ x1, y1, x2, y2 });
    });
  } else {
    // Para múltiplos parents, conecta cada parent ao child mais próximo
    parents.forEach(parent => {
      const pr = parent.current?.getBoundingClientRect();
      if (!pr) return;
      
      const parentCenterX = pr.left + pr.width / 2 - rootRect.left;
      const parentY = pr.bottom - rootRect.top;
      
      // Encontra o child mais próximo horizontalmente
      let closestChild: React.RefObject<HTMLDivElement> | null = null;
      let minDistance = Infinity;
      
      children.forEach(child => {
        const cr = child.current?.getBoundingClientRect();
        if (!cr) return;
        
        const childCenterX = cr.left + cr.width / 2 - rootRect.left;
        const distance = Math.abs(parentCenterX - childCenterX);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestChild = child;
        }
      });
      
      if (closestChild) {
        const cr = closestChild.current?.getBoundingClientRect();
        if (cr) {
          const x2 = cr.left + cr.width / 2 - rootRect.left;
          const y2 = cr.top - rootRect.top;
          lines.push({ x1: parentCenterX, y1: parentY, x2, y2 });
        }
      }
    });
  }
  
  return lines;
};

const LinhasSVG: React.FC<LinhasSVGProps> = ({ root, parents, children }) => {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const update = () => {
      if (!root.current) return;
      setLines(calcLines(root.current, parents, children));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [root, parents, children]);

  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#165A5D" />
        </marker>
      </defs>
      {lines.map((l, i) => (
        <g key={i}>
          <line 
            x1={l.x1} 
            y1={l.y1} 
            x2={l.x2} 
            y2={l.y2} 
            stroke="#165A5D" 
            strokeWidth={2} 
            markerEnd="url(#arrowhead)"
            strokeDasharray="none"
          />
          <circle cx={l.x1} cy={l.y1} r="3" fill="#165A5D" />
        </g>
      ))}
    </svg>
  );
};

export default LinhasSVG;

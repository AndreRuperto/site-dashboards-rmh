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
  parents.forEach(p => {
    const pr = p.current?.getBoundingClientRect();
    if (!pr) return;
    const x1 = pr.left + pr.width / 2 - rootRect.left;
    const y1 = pr.bottom - rootRect.top;
    children.forEach(c => {
      const cr = c.current?.getBoundingClientRect();
      if (!cr) return;
      const x2 = cr.left + cr.width / 2 - rootRect.left;
      const y2 = cr.top - rootRect.top;
      lines.push({ x1, y1, x2, y2 });
    });
  });
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
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#165A5D" strokeWidth={2} />
      ))}
    </svg>
  );
};

export default LinhasSVG;

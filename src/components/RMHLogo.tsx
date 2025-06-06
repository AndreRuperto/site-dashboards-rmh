import React from 'react';

interface RMHLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RMHLogo: React.FC<RMHLogoProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-12 w-auto',
    lg: 'h-16 w-auto'
  };

  return (
    <img 
      src="/logo-rmh.png" 
      alt="Resende Mori Hutchison - Advocacia" 
      className={`${sizeClasses[size]} object-contain ${className}`}
    />
  );
};

export default RMHLogo;
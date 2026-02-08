import type { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ title, description, children, className = '', onClick }: CardProps) {
  return (
    <div className={`rounded-lg bg-white p-6 shadow ${className}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {children}
    </div>
  );
}

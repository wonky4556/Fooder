import type { ReactNode } from 'react';

interface HeaderProps {
  title: string;
  rightContent?: ReactNode;
}

export function Header({ title, rightContent }: HeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {rightContent && <div>{rightContent}</div>}
      </div>
    </header>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/Nav';

type AppShellProps = {
  children: React.ReactNode;
  user: React.ComponentProps<typeof Nav>['user'];
};

export default function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  const hideSidebar = ['/', '/login', '/register'].includes(pathname);

  if (hideSidebar) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <Nav user={user} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
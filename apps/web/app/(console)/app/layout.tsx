import { ReactNode } from 'react';
import { ConsoleProvider } from '../../../components/console-provider';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ConsoleProvider>{children}</ConsoleProvider>;
}

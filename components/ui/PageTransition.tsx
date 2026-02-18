import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => (
  <div className="animate-page-enter">{children}</div>
);

export default PageTransition;

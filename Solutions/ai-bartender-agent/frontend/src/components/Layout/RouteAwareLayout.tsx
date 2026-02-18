import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from './Layout';
import { useSections } from '../../hooks/useSections';

interface RouteAwareLayoutProps {
  children: ReactNode;
}

/**
 * Layout wrapper that provides route-aware navigation
 * Shows section navigation in hamburger menu only on HomePage
 */
const RouteAwareLayout: React.FC<RouteAwareLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  // Fetch sections (will be used only if on home page)
  const { sections } = useSections();
  const [activeSectionId, setActiveSectionId] = React.useState<string | undefined>();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      const offset = 80; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  // Listen for active section changes from HomePage
  React.useEffect(() => {
    if (!isHomePage) return;

    const handleActiveSectionChange = (event: CustomEvent<string>) => {
      setActiveSectionId(event.detail);
    };

    window.addEventListener('activeSectionChange' as any, handleActiveSectionChange);
    return () => {
      window.removeEventListener('activeSectionChange' as any, handleActiveSectionChange);
    };
  }, [isHomePage]);

  return (
    <Layout
      sections={isHomePage ? sections : undefined}
      activeSectionId={isHomePage ? activeSectionId : undefined}
      onSectionClick={isHomePage ? scrollToSection : undefined}
      showSections={isHomePage}
    >
      {children}
    </Layout>
  );
};

export default RouteAwareLayout;

import React from 'react';
import Header from './Header';
import Footer from './Footer';
import InstallPWAPrompt from '../Mobile/InstallPWAPrompt';
import UserNotificationBanner from '../Notifications/UserNotificationBanner';
import { Section } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  sections?: Section[];
  activeSectionId?: string;
  onSectionClick?: (sectionId: string) => void;
  showSections?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children,
  sections,
  activeSectionId,
  onSectionClick,
  showSections = false,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        sections={sections}
        activeSectionId={activeSectionId}
        onSectionClick={onSectionClick}
        showSections={showSections}
      />
      <UserNotificationBanner />
      <main className="flex-1 safe-area-top safe-area-bottom">
        {children}
      </main>
      <Footer />
      <InstallPWAPrompt />
    </div>
  );
};

export default Layout;
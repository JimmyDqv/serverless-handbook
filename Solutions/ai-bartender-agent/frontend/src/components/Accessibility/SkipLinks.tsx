import React from 'react';
import { useLocation } from 'react-router-dom';

const SkipLinks: React.FC = () => {
  const location = useLocation();

  const getSkipLinks = () => {
    const links = [
      { href: '#main-content', text: 'Skip to main content' },
    ];

    // Add page-specific skip links
    if (location.pathname === '/') {
      links.push(
        { href: '#section-filters', text: 'Skip to section filters' },
        { href: '#drinks-grid', text: 'Skip to drinks' }
      );
    } else if (location.pathname.startsWith('/admin')) {
      links.push(
        { href: '#admin-navigation', text: 'Skip to admin navigation' },
        { href: '#order-queue', text: 'Skip to order queue' }
      );
    }

    return links;
  };

  return (
    <div className="sr-only focus-within:not-sr-only">
      {getSkipLinks().map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="skip-link"
          onClick={(e) => {
            e.preventDefault();
            const target = document.querySelector(link.href);
            if (target) {
              (target as HTMLElement).focus();
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          {link.text}
        </a>
      ))}
    </div>
  );
};

export default SkipLinks;
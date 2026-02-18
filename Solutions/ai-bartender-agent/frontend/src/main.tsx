import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Toaster } from 'react-hot-toast';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: 'var(--toast-bg)',
          color: 'var(--toast-color)',
          borderRadius: '12px',
          padding: '16px',
          fontSize: '14px',
          fontWeight: '500',
        },
        success: {
          iconTheme: {
            primary: '#00D9C0',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#FF6B6B',
            secondary: '#ffffff',
          },
        },
      }}
    />
  </React.StrictMode>
);

// PWA service worker is automatically handled by Vite PWA plugin
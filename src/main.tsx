import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register Service Worker for PWA installability & offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('DebtTrack PWA Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.warn('DebtTrack Service Worker registration failed:', error);
      });
  });
}

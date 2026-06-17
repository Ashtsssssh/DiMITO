import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadMockData } from './data/mockData';

// Load mock data on startup (remove this when you have real backend)
loadMockData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
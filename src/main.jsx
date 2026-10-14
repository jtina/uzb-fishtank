import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PRELOAD_IMAGES } from './constants.js';
import './styles.css';

PRELOAD_IMAGES.forEach(src => { new Image().src = src; });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

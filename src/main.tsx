import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { App } from './App';
import './design/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found in index.html');

createRoot(container).render(
  <StrictMode>
    {/*
      The reduced-motion media query in CSS cannot reach motion's JS-driven
      animations, so it is honoured here instead. `"user"` drops transforms for
      anyone who asked for less movement while still settling opacity, so nothing
      is left invisible.
    */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

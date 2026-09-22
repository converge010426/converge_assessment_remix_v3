import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { installV2MarketFixes } from './v2MarketFixes';
import { installHeroFinalFix } from './heroFinalFix';
import { installNavigationRepeatFix } from './navigationRepeatFix';
import './index.css';

installV2MarketFixes();
installNavigationRepeatFix();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

window.setTimeout(installHeroFinalFix, 350);
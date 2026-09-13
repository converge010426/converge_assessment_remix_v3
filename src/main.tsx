import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { PRICING } from './constants';
import './index.css';

async function loadAuthoritativePricing() {
  try {
    const response = await fetch('/api/pricing', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data?.products || typeof data.products !== 'object') return;

    Object.assign(PRICING.products, data.products);
    if (data.currency) PRICING.currency = data.currency;
  } catch {
    // Keep the bundled pricing as a safe fallback if the pricing service is unavailable.
  }
}

async function bootstrap() {
  await loadAuthoritativePricing();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

bootstrap();

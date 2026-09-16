import { calculateResults } from './logic';

const CONTACT_EMAIL = 'tomknsn@gmail.com';
const WHATSAPP = '0749361406';
const WHATSAPP_INTL = '27749361406';
const STORAGE_NAME = 'converge_candidate_name';
const STORAGE_EMAIL = 'converge_candidate_email';

function rememberCandidateDetails(): void {
  if (typeof window === 'undefined') return;
  document.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = target.value.trim();
    if (target.type === 'email' || target.name?.toLowerCase().includes('email') || target.placeholder?.toLowerCase().includes('email')) {
      if (value) sessionStorage.setItem(STORAGE_EMAIL, value);
    } else if (target.type === 'text' && (target.placeholder?.toLowerCase().includes('full name') || target.name?.toLowerCase().includes('name'))) {
      if (value) sessionStorage.setItem(STORAGE_NAME, value);
    }
  }, true);
}

function installSubmissionProtection(): void {
  if (typeof window === 'undefined' || (window as any).__convergeSubmissionProtection) return;
  (window as any).__convergeSubmissionProtection = true;
  rememberCandidateDetails();

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.endsWith('/api/submit') || !init?.body || typeof init.body !== 'string') {
      return originalFetch(input, init);
    }

    try {
      const body = JSON.parse(init.body);
      const storedName = sessionStorage.getItem(STORAGE_NAME)?.trim() || '';
      const storedEmail = sessionStorage.getItem(STORAGE_EMAIL)?.trim() || '';
      const name = String(body.name || storedName).trim();
      const email = String(body.email || storedEmail).trim();

      if (!name || !email) {
        return new Response(JSON.stringify({
          error: 'MISSING_CANDIDATE_DETAILS',
          message: 'Please enter your full name and email address before submitting your assessment.'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const calculatedResults = body.answers ? calculateResults(body.answers) : body.results;
      const protectedBody = {
        ...body,
        name,
        email,
        results: calculatedResults,
        product: body.product || sessionStorage.getItem('last_product') || 'mbti'
      };
      sessionStorage.setItem(STORAGE_NAME, name);
      sessionStorage.setItem(STORAGE_EMAIL, email);
      return originalFetch(input, { ...init, body: JSON.stringify(protectedBody) });
    } catch (error) {
      console.error('[CONVERGE] Submission protection failed safely:', error);
      return originalFetch(input, init);
    }
  };
}

function replaceText(root: ParentNode, oldText: string, newText: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach(node => {
    if (node.nodeValue?.includes(oldText)) node.nodeValue = node.nodeValue.replace(oldText, newText);
  });
}

function addContactBox(container: Element, variant: 'landing' | 'quiz' | 'thankyou'): void {
  if (container.querySelector('[data-converge-contact-box]')) return;
  const box = document.createElement('section');
  box.dataset.convergeContactBox = 'true';
  if (variant === 'quiz') box.classList.add('converge-quiz-contact');
  box.style.cssText = 'margin:28px 0;padding:20px 22px;border:1px solid rgba(197,160,89,.35);background:#fff;box-shadow:0 8px 24px rgba(26,43,75,.08);max-width:760px;';
  const intro = variant === 'quiz'
    ? 'Need help while completing the assessment? Send us a message. We will help without influencing your answers.'
    : 'Need help or have an enquiry about CONVERGE? Send us a message and we will get back to you.';
  box.innerHTML = `
    <div style="font-family:Arial,sans-serif;color:#1a2b4b;font-weight:800;letter-spacing:2px;font-size:11px;text-transform:uppercase;margin-bottom:8px">Message us</div>
    <div style="font-family:Arial,sans-serif;color:#444;font-size:13px;line-height:1.5;margin-bottom:12px">${intro}</div>
    <textarea data-converge-message rows="3" placeholder="Type your message here" style="box-sizing:border-box;width:100%;padding:11px 12px;border:1px solid rgba(197,160,89,.35);font:14px Arial,sans-serif;resize:vertical;min-height:76px;outline:none"></textarea>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
      <button type="button" data-converge-whatsapp style="border:0;background:#1a2b4b;color:#fff;padding:10px 15px;font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer">WhatsApp ${WHATSAPP}</button>
      <button type="button" data-converge-email style="border:0;background:#c5a059;color:#fff;padding:10px 15px;font:700 11px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;cursor:pointer">Email ${CONTACT_EMAIL}</button>
    </div>`;
  container.appendChild(box);
  const message = box.querySelector('[data-converge-message]') as HTMLTextAreaElement;
  (box.querySelector('[data-converge-whatsapp]') as HTMLButtonElement).onclick = () => {
    const text = encodeURIComponent(message.value.trim() || 'Hello CONVERGE, I have a question about the assessment.');
    window.open(`https://wa.me/${WHATSAPP_INTL}?text=${text}`, '_blank', 'noopener,noreferrer');
  };
  (box.querySelector('[data-converge-email]') as HTMLButtonElement).onclick = () => {
    const text = message.value.trim();
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('CONVERGE enquiry')}&body=${encodeURIComponent(text)}`;
  };
}

function addHeroCorrection(): void {
  const image = document.querySelector<HTMLImageElement>('.page-container > img[src="/converge-hero.png"]');
  if (!image) return;
  image.src = '/converge-hero-fixed.svg';
  image.removeAttribute('srcset');
}

function applyV2PresentationFixes(): void {
  const path = window.location.pathname;

  if (path === '/') {
    replaceText(document, 'A verified psychological architecture, built from three validated frameworks.', 'A psychological architecture drawing on three well-established perspectives.');
    replaceText(document, 'Three Validated Frameworks', 'Three Well-Established Perspectives');
    replaceText(document, 'Validated frameworks, one profile', 'Well-established perspectives, one profile');
    replaceText(document, '60 easy multiple-choice questions — less than 10 minutes.', '76 questions — complete in under 10 minutes.');
    replaceText(document, 'Answer honestly based on your natural tendencies, not how you think you should behave.', 'There are no right or wrong answers. Choose the response that best reflects you.');
    replaceText(document, "Try to avoid 'Neutral' answers where possible to ensure a more precise profile.", "Read each question, choose the response that best reflects you, and don't overthink it.");
    addHeroCorrection();
    const main = document.querySelector('.page-container main');
    if (main) addContactBox(main, 'landing');
  }

  if (path === '/quiz') {
    const main = document.querySelector('.page-container main');
    if (main && !main.querySelector('[data-converge-contact-box]')) addContactBox(main, 'quiz');
  }

  if (path === '/thank-you') {
    const returnHome = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Return Home');
    const main = returnHome?.closest('main');
    if (main && !main.querySelector('[data-converge-contact-box]')) {
      const boxHost = document.createElement('div');
      main.insertBefore(boxHost, returnHome || null);
      addContactBox(boxHost, 'thankyou');
    }
  }
}

export function installV2MarketFixes(): void {
  installSubmissionProtection();
  const run = () => applyV2PresentationFixes();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.setTimeout(run, 100);
}

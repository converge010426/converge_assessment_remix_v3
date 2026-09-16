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
          message: 'Please enter your full name and email address before submitting.'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Recalculate from the submitted answers so the complete V2 result object,
      // including preference-strength and response-evidence fields, cannot be lost
      // by an intermediate frontend normalization step.
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

function addLandingHeroV2Correction(): void {
  const image = document.querySelector<HTMLImageElement>('.page-container > img[src="/converge-hero.png"]');
  if (!image || image.parentElement?.querySelector('[data-converge-hero-v2]')) return;
  const parent = image.parentElement;
  if (!parent) return;
  parent.style.position = 'relative';
  const correction = document.createElement('div');
  correction.dataset.convergeHeroV2 = 'true';
  correction.style.cssText = 'position:absolute;left:1.7%;top:49.7%;width:28.8%;height:7.8%;box-sizing:border-box;background:#f7f7f5;padding:5px 7px;display:flex;align-items:center;gap:7px;z-index:3;pointer-events:none;font-family:Arial,sans-serif;color:#111;font-weight:800;font-size:clamp(8px,1.15vw,17px);line-height:1.05;';
  correction.innerHTML = '<span style="color:#5a9b45;font-size:1.15em">●</span><span>76 QUESTION QUESTIONNAIRE</span>';
  parent.appendChild(correction);
}

function addContactBox(container: Element, variant: 'landing' | 'quiz'): void {
  if (container.querySelector('[data-converge-contact-box]')) return;
  const box = document.createElement('section');
  box.dataset.convergeContactBox = 'true';
  box.style.cssText = 'margin:32px 0;padding:20px 22px;border:1px solid rgba(197,160,89,.35);background:#fff;box-shadow:0 8px 24px rgba(26,43,75,.08);max-width:760px;';
  box.innerHTML = `
    <div style="font-family:Arial,sans-serif;color:#1a2b4b;font-weight:800;letter-spacing:2px;font-size:11px;text-transform:uppercase;margin-bottom:8px">Message us</div>
    <div style="font-family:Arial,sans-serif;color:#444;font-size:13px;line-height:1.5;margin-bottom:12px">${variant === 'quiz' ? 'Need help with a question? Send us a message. We will help without influencing your answers.' : 'Have a question about CONVERGE? Send us a message and we will get back to you.'}</div>
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

function applyV2PresentationFixes(): void {
  if (typeof document === 'undefined') return;
  const path = window.location.pathname;
  const isLanding = path === '/';
  const isQuiz = path === '/quiz';

  if (isLanding) {
    addLandingHeroV2Correction();
    replaceText(document, 'A verified psychological architecture, built from three validated frameworks.', 'A psychological architecture drawing on three well-established perspectives.');
    replaceText(document, 'Three Validated Frameworks', 'Three Well-Established Perspectives');
    replaceText(document, 'Validated frameworks, one profile', 'Well-established perspectives, one profile');
    replaceText(document, '60 easy multiple-choice questions — less than 10 minutes.', '76 questions — complete in under 10 minutes.');
    replaceText(document, 'Answer honestly based on your natural tendencies, not how you think you should behave.', 'There are no right or wrong answers. Choose the response that best reflects you.');
    replaceText(document, "Try to avoid 'Neutral' answers where possible to ensure a more precise profile.", "Read each question, choose the response that best reflects you, and don't overthink it.");
    const main = document.querySelector('.page-container main');
    if (main) addContactBox(main, 'landing');
  }

  if (isQuiz) {
    replaceText(document, 'Three validated frameworks. One evidence-based hiring insight.', 'Drawing on three well-established perspectives: MBTI, EQ and Big Five.');
    replaceText(document, 'Three platforms. One integrated psychological insight.', 'Three perspectives. One integrated profile.');
    replaceText(document, 'Three frameworks. One executive advantage.', '76 questions. Under 10 minutes.');
    replaceText(document, 'Three developmental platforms. One transformational growth tool.', "No right or wrong answers. Don't overthink it.");
    const header = document.querySelector('header');
    if (header) {
      replaceText(header, 'Three platforms. One integrated psychological insight.', 'Three perspectives. One integrated profile.');
      replaceText(header, 'Three validated frameworks. One evidence-based hiring insight.', 'Drawing on three well-established perspectives: MBTI, EQ and Big Five.');
      replaceText(header, 'Three frameworks. One executive advantage.', '76 questions. Under 10 minutes.');
      replaceText(header, 'Three developmental platforms. One transformational growth tool.', "No right or wrong answers. Don't overthink it.");
    }
    const main = document.querySelector('.page-container main');
    if (main) addContactBox(main, 'quiz');
  }
}

export function installV2MarketFixes(): void {
  installSubmissionProtection();
  const run = () => applyV2PresentationFixes();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true }); else run();
  const observer = new MutationObserver(() => run());
  observer.observe(document.body, { childList: true, subtree: true });
}

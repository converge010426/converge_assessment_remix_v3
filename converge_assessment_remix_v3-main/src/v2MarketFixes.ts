import { calculateResults } from './logic';
import { questions } from './questions';

const CONTACT_EMAIL = 'tomknsn@gmail.com';
const WHATSAPP = '0749361406';
const WHATSAPP_INTL = '27749361406';
const STORAGE_NAME = 'converge_candidate_name';
const STORAGE_EMAIL = 'converge_candidate_email';
const STORAGE_ANSWERS = 'converge_saved_answers';
const STORAGE_REUSE = 'converge_reuse_ready';
const STORAGE_PRODUCT = 'converge_last_product';
const STORAGE_REPLAY = 'converge_replay_state';

function rememberCandidateDetails(): void {
  if (typeof window === 'undefined') return;
  document.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    const value = target.value.trim();
    const isEmail = target.type === 'email' || target.name?.toLowerCase().includes('email') || target.placeholder?.toLowerCase().includes('email');
    const isName = target.type === 'text' && (target.placeholder?.toLowerCase().includes('full name') || target.name?.toLowerCase().includes('name'));
    if (isEmail) {
      const previous = sessionStorage.getItem(STORAGE_EMAIL)?.trim() || '';
      if (previous && value && previous !== value) {
        sessionStorage.removeItem(STORAGE_ANSWERS);
        sessionStorage.removeItem(STORAGE_REUSE);
        sessionStorage.removeItem(STORAGE_REPLAY);
      }
      if (value) sessionStorage.setItem(STORAGE_EMAIL, value);
    } else if (isName) {
      const previous = sessionStorage.getItem(STORAGE_NAME)?.trim() || '';
      if (previous && value && previous !== value) {
        sessionStorage.removeItem(STORAGE_ANSWERS);
        sessionStorage.removeItem(STORAGE_REUSE);
        sessionStorage.removeItem(STORAGE_REPLAY);
      }
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
        product: body.product || sessionStorage.getItem(STORAGE_PRODUCT) || 'mbti'
      };
      sessionStorage.setItem(STORAGE_NAME, name);
      sessionStorage.setItem(STORAGE_EMAIL, email);
      sessionStorage.setItem(STORAGE_PRODUCT, protectedBody.product);
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

function setReactInputValue(input: HTMLInputElement, value: string): void {
  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function restoreCandidateDetailsOnLanding(): void {
  if (window.location.pathname !== '/') return;
  const name = sessionStorage.getItem(STORAGE_NAME)?.trim() || '';
  const email = sessionStorage.getItem(STORAGE_EMAIL)?.trim() || '';
  if (!name && !email) return;
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.page-container input'));
  const nameInput = inputs.find(input => input.placeholder?.toLowerCase().includes('full name') || input.name?.toLowerCase().includes('name'));
  const emailInput = inputs.find(input => input.type === 'email' || input.placeholder?.toLowerCase().includes('email') || input.name?.toLowerCase().includes('email'));
  if (nameInput && name && nameInput.value !== name) setReactInputValue(nameInput, name);
  if (emailInput && email && emailInput.value !== email) setReactInputValue(emailInput, email);
}

function rememberAssessmentAnswers(): void {
  if ((window as any).__convergeAnswerCapture) return;
  (window as any).__convergeAnswerCapture = true;
  document.addEventListener('click', (event) => {
    if (window.location.pathname !== '/quiz') return;
    const button = (event.target as Element | null)?.closest('button');
    if (!button) return;
    const label = button.textContent?.trim() || '';
    const valueByLabel: Record<string, number> = {
      'Strongly Agree': 5,
      'Agree': 4,
      'Neutral': 3,
      'Disagree': 2,
      'Strongly Disagree': 1,
    };
    const value = valueByLabel[label];
    if (!value) return;
    const heading = Array.from(document.querySelectorAll('h2')).find(h => /^Question\s+\d+\s+of\s+\d+$/i.test(h.textContent?.trim() || ''));
    const match = heading?.textContent?.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
    if (!match) return;
    const questionNumber = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isFinite(questionNumber) || questionNumber < 1 || questionNumber > questions.length) return;
    let saved: Record<string, number> = {};
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_ANSWERS) || '{}'); } catch { saved = {}; }
    saved[String(questionNumber)] = value;
    sessionStorage.setItem(STORAGE_ANSWERS, JSON.stringify(saved));
    if (total === questions.length && Object.keys(saved).length >= questions.length) {
      sessionStorage.setItem(STORAGE_REUSE, 'true');
    }
  }, true);
}

function hasCompleteSavedAnswers(): boolean {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_ANSWERS) || '{}') as Record<string, number>;
    return questions.length > 0 && questions.every((_, index) => Number.isFinite(saved[String(index + 1)]));
  } catch {
    return false;
  }
}

function answerLabel(value: number): string {
  return ({ 5: 'Strongly Agree', 4: 'Agree', 3: 'Neutral', 2: 'Disagree', 1: 'Strongly Disagree' } as Record<number, string>)[value] || '';
}

function replaySavedAnswersOnce(): void {
  if (window.location.pathname !== '/quiz') return;
  if (sessionStorage.getItem(STORAGE_REUSE) !== 'true' || !hasCompleteSavedAnswers()) return;
  if (sessionStorage.getItem(STORAGE_REPLAY) === 'done') return;

  let saved: Record<string, number>;
  try { saved = JSON.parse(sessionStorage.getItem(STORAGE_ANSWERS) || '{}'); } catch { return; }

  let state: { question: number; attempts: number } = { question: 1, attempts: 0 };
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_REPLAY) || '');
    if (parsed?.active) state = parsed;
  } catch { /* start at question 1 */ }

  const step = () => {
    if (window.location.pathname !== '/quiz') return;
    const heading = Array.from(document.querySelectorAll('h2')).find(h => /^Question\s+\d+\s+of\s+\d+$/i.test(h.textContent?.trim() || ''));
    const match = heading?.textContent?.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
    if (!match) {
      window.setTimeout(step, 120);
      return;
    }
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (total !== questions.length || current >= questions.length) {
      sessionStorage.setItem(STORAGE_REPLAY, 'done');
      return;
    }
    const target = answerLabel(saved[String(current)]);
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.page-container main button')).find(b => b.textContent?.trim() === target);
    if (!button) {
      state.attempts += 1;
      if (state.attempts > 15) {
        sessionStorage.removeItem(STORAGE_REPLAY);
        return;
      }
      sessionStorage.setItem(STORAGE_REPLAY, JSON.stringify({ active: true, question: current, attempts: state.attempts }));
      window.setTimeout(step, 120);
      return;
    }
    state = { question: current + 1, attempts: 0 };
    sessionStorage.setItem(STORAGE_REPLAY, JSON.stringify({ active: true, question: state.question, attempts: 0 }));
    button.click();
    window.setTimeout(step, 120);
  };

  sessionStorage.setItem(STORAGE_REPLAY, JSON.stringify({ active: true, question: state.question, attempts: state.attempts }));
  window.setTimeout(step, 180);
}

function installBeginAssessmentFallback(): void {
  if ((window as any).__convergeBeginFallback) return;
  (window as any).__convergeBeginFallback = true;
  document.addEventListener('click', (event) => {
    if (window.location.pathname !== '/') return;
    const button = (event.target as Element | null)?.closest('button');
    if (!button || button.textContent?.trim() !== 'Begin Assessment') return;
    window.setTimeout(() => {
      if (window.location.pathname === '/') {
        window.history.pushState({}, '', '/quiz');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }, 80);
  }, true);
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
  if (!image || image.parentElement?.querySelector('[data-converge-hero-overlay]')) return;
  const wrapper = document.createElement('div');
  wrapper.dataset.convergeHeroWrapper = 'true';
  wrapper.style.cssText = 'position:relative;width:100%;margin-bottom:3rem;line-height:0;overflow:hidden;';
  image.parentElement?.insertBefore(wrapper, image);
  wrapper.appendChild(image);
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlay.setAttribute('viewBox', '0 0 1536 1024');
  overlay.setAttribute('preserveAspectRatio', 'none');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.dataset.convergeHeroOverlay = 'true';
  overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block;';
  overlay.innerHTML = `
    <rect x="493" y="322" width="453" height="155" fill="#5f31a1"/>
    <circle cx="604" cy="400" r="70" fill="#5f31a1" stroke="#fff" stroke-width="6"/>
    <text x="604" y="417" text-anchor="middle" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="#fff">EQ</text>
    <text x="700" y="367" font-family="Arial,sans-serif" font-size="32" font-weight="800" fill="#fff">EQ</text>
    <text x="700" y="407" font-family="Arial,sans-serif" font-size="24" fill="#fff">How you handle</text>
    <text x="700" y="435" font-family="Arial,sans-serif" font-size="24" fill="#fff">the human dimension</text>
    <rect x="92" y="518" width="375" height="102" fill="#eef0f3"/>
    <text x="98" y="553" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#14233f">76 QUESTIONS</text>
    <text x="98" y="589" font-family="Arial,sans-serif" font-size="24" fill="#14233f">Complete in under 10 minutes.</text>
    <rect x="504" y="582" width="294" height="191" fill="#f4f4f5"/>
    <rect x="823" y="582" width="297" height="191" fill="#f4f4f5"/>
    <rect x="1143" y="582" width="310" height="191" fill="#f4f4f5"/>
    <g font-family="Arial,sans-serif" fill="#14233f" text-anchor="middle">
      <text x="651" y="620" font-size="20">A focused MBTI</text>
      <text x="651" y="646" font-size="20">personality assessment</text>
      <text x="651" y="672" font-size="20">and report.</text>
      <rect x="560" y="676" width="181" height="2" fill="#214f8b"/>
      <text x="971" y="620" font-size="20">A deeper integrated</text>
      <text x="971" y="646" font-size="20">analysis of MBTI, EQ</text>
      <text x="971" y="672" font-size="20">&amp; Big Five.</text>
      <rect x="881" y="676" width="181" height="2" fill="#6b35ad"/>
      <text x="1298" y="620" font-size="20">The comprehensive assessment</text>
      <text x="1298" y="646" font-size="20">plus a job-specific Candidate</text>
      <text x="1298" y="672" font-size="20">Suitability Analysis.</text>
      <rect x="1201" y="676" width="194" height="2" fill="#248743"/>
    </g>
    <rect x="0" y="862" width="705" height="151" fill="#022340"/>
    <text x="72" y="912" font-family="Arial,sans-serif" font-size="27" font-weight="800" fill="#59bf3e">THREE PERSPECTIVES.</text>
    <text x="72" y="946" font-family="Arial,sans-serif" font-size="21" fill="#fff">One integrated view of how</text>
    <text x="72" y="974" font-family="Arial,sans-serif" font-size="21" fill="#fff">you think, behave and relate.</text>
  `;
  wrapper.appendChild(overlay);
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
    restoreCandidateDetailsOnLanding();
  }
  if (path === '/quiz') {
    const main = document.querySelector('.page-container main');
    if (main && !main.querySelector('[data-converge-contact-box]')) addContactBox(main, 'quiz');
    replaySavedAnswersOnce();
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

function installRouteObserver(): void {
  if ((window as any).__convergeRouteObserver) return;
  (window as any).__convergeRouteObserver = true;
  const rerun = () => {
    window.setTimeout(applyV2PresentationFixes, 0);
    window.setTimeout(applyV2PresentationFixes, 120);
    window.setTimeout(restoreCandidateDetailsOnLanding, 250);
  };
  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<History['pushState']>) => {
    originalPushState(...args);
    rerun();
  }) as History['pushState'];
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    originalReplaceState(...args);
    rerun();
  }) as History['replaceState'];
  window.addEventListener('popstate', rerun);
  const observer = new MutationObserver(() => {
    if (window.location.pathname === '/') restoreCandidateDetailsOnLanding();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function installV2MarketFixes(): void {
  installSubmissionProtection();
  rememberAssessmentAnswers();
  installBeginAssessmentFallback();
  installRouteObserver();
  const run = () => applyV2PresentationFixes();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.setTimeout(run, 100);
}

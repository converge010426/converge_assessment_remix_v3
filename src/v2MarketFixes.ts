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
  if (!image || image.parentElement?.querySelector('[data-converge-current-hero]')) return;

  const wrapper = document.createElement('div');
  wrapper.dataset.convergeCurrentHero = 'true';
  wrapper.style.cssText = 'position:relative;width:100%;margin-bottom:3rem;line-height:0;overflow:hidden;';
  image.parentElement?.insertBefore(wrapper, image);
  wrapper.appendChild(image);

  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;font-family:Montserrat,Arial,sans-serif;';
  layer.innerHTML = `
    <div style="position:absolute;left:32.1%;top:31.45%;width:29.5%;height:15.2%;background:#5f31a1;color:#fff;display:flex;align-items:center;justify-content:center;">
      <div style="width:100%;height:100%;position:relative;">
        <div style="position:absolute;left:8%;top:10%;width:31%;height:78%;border:6px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:clamp(18px,3vw,44px);">EQ</div>
        <div style="position:absolute;left:46%;top:17%;font-weight:800;font-size:clamp(16px,2.2vw,32px);">EQ</div>
        <div style="position:absolute;left:46%;top:43%;font-size:clamp(12px,1.6vw,24px);line-height:1.05;">How you handle<br>the human dimension</div>
      </div>
    </div>
    <div style="position:absolute;left:5.5%;top:50.5%;width:25%;height:6.1%;background:#f6f7f9;color:#14233f;display:flex;align-items:center;padding-left:1%;font-weight:800;font-size:clamp(13px,1.8vw,28px);">76 QUESTION QUESTIONNAIRE</div>
    <div style="position:absolute;left:32.8%;top:56.8%;width:19.1%;height:18.8%;background:#f6f7f9;"></div>
    <div style="position:absolute;left:53.5%;top:56.8%;width:19.2%;height:18.8%;background:#f6f7f9;"></div>
    <div style="position:absolute;left:74.5%;top:56.8%;width:20.1%;height:18.8%;background:#f6f7f9;"></div>
    <div style="position:absolute;left:32.8%;top:59.5%;width:19.1%;text-align:center;color:#14233f;font-size:clamp(11px,1.35vw,20px);line-height:1.18;">A focused MBTI<br>personality assessment<br>and report.<div style="height:2px;background:#214f8b;width:62%;margin:14px auto 0;"></div></div>
    <div style="position:absolute;left:53.5%;top:59.5%;width:19.2%;text-align:center;color:#14233f;font-size:clamp(11px,1.35vw,20px);line-height:1.18;">A deeper integrated<br>analysis of MBTI, EQ<br>&amp; Big Five.<div style="height:2px;background:#6b35ad;width:62%;margin:14px auto 0;"></div></div>
    <div style="position:absolute;left:74.5%;top:59.5%;width:20.1%;text-align:center;color:#14233f;font-size:clamp(11px,1.35vw,20px);line-height:1.18;">The comprehensive assessment<br>plus a job-specific Candidate<br>Suitability Analysis.<div style="height:2px;background:#248743;width:62%;margin:14px auto 0;"></div></div>
    <div style="position:absolute;left:0;top:84.2%;width:45.8%;height:14.7%;background:#022340;color:#fff;padding:2.6% 0 0 4.6%;box-sizing:border-box;">
      <div style="font-weight:800;font-size:clamp(15px,2vw,27px);color:#59bf3e;line-height:1.1;">THREE PERSPECTIVES.</div>
      <div style="font-size:clamp(12px,1.55vw,22px);line-height:1.25;margin-top:8px;">One integrated view of how<br>you think, behave and relate.</div>
    </div>
  `;
  wrapper.appendChild(layer);
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
    const submitButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'SUBMIT' || button.textContent?.includes('NEXT: JOB CONTEXT'));
    const row = submitButton?.parentElement;
    const host = row?.parentElement;
    if (host && !host.querySelector('[data-converge-contact-box]')) addContactBox(host, 'quiz');
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

export function installHeroFinalFix(): void {
  if (typeof window === 'undefined') return;

  const run = () => {
    const image = document.querySelector<HTMLImageElement>('.page-container img[src="/converge-hero.png"]');
    if (!image) return;

    // Remove any previous/failed hero correction layers and restore the image to the page container.
    document.querySelectorAll('[data-converge-hero-overlay]').forEach(el => el.remove());
    document.querySelectorAll('[data-converge-hero-wrapper]').forEach(wrapper => {
      const img = wrapper.querySelector<HTMLImageElement>('img[src="/converge-hero.png"]');
      if (img && wrapper.parentElement) wrapper.parentElement.insertBefore(img, wrapper);
      wrapper.remove();
    });

    const parent = image.parentElement;
    if (!parent) return;

    const wrapper = document.createElement('div');
    wrapper.dataset.convergeHeroWrapper = 'true';
    wrapper.style.cssText = 'position:relative;width:100%;aspect-ratio:3/2;overflow:hidden;line-height:0;margin-bottom:3rem;';
    parent.insertBefore(wrapper, image);
    wrapper.appendChild(image);
    image.style.cssText = 'display:block;width:100%;height:100%;object-fit:fill;margin:0;';

    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('viewBox', '0 0 1536 1024');
    overlay.setAttribute('preserveAspectRatio', 'none');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.dataset.convergeHeroOverlay = 'true';
    overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';

    overlay.innerHTML = `
      <defs>
        <linearGradient id="eq-panel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#4b2d76"/>
          <stop offset="100%" stop-color="#603793"/>
        </linearGradient>
      </defs>
      <rect x="493" y="322" width="453" height="155" fill="url(#eq-panel)"/>
      <circle cx="604" cy="400" r="70" fill="#6336a0" stroke="#ffffff" stroke-width="6"/>
      <text x="604" y="417" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff">EQ</text>
      <text x="700" y="367" font-family="Arial, sans-serif" font-size="32" font-weight="800" fill="#ffffff">EQ</text>
      <text x="700" y="407" font-family="Arial, sans-serif" font-size="24" fill="#ffffff">How you handle</text>
      <text x="700" y="435" font-family="Arial, sans-serif" font-size="24" fill="#ffffff">the human dimension</text>

      <rect x="92" y="518" width="375" height="102" fill="#eef0f3"/>
      <text x="98" y="553" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#14233f">76 QUESTIONS</text>
      <text x="98" y="589" font-family="Arial, sans-serif" font-size="24" fill="#14233f">Complete in under 10 minutes.</text>

      <rect x="504" y="582" width="294" height="191" fill="#f4f4f5"/>
      <rect x="823" y="582" width="297" height="191" fill="#f4f4f5"/>
      <rect x="1143" y="582" width="310" height="191" fill="#f4f4f5"/>
      <g font-family="Arial, sans-serif" fill="#14233f" text-anchor="middle" font-size="20">
        <text x="651" y="620">A focused MBTI</text>
        <text x="651" y="646">personality assessment</text>
        <text x="651" y="672">and report.</text>
        <rect x="560" y="676" width="181" height="2" fill="#214f8b"/>
        <text x="971" y="620">A deeper integrated</text>
        <text x="971" y="646">analysis of MBTI, EQ</text>
        <text x="971" y="672">&amp; Big Five.</text>
        <rect x="881" y="676" width="181" height="2" fill="#6b35ad"/>
        <text x="1298" y="620">The comprehensive assessment</text>
        <text x="1298" y="646">plus a job-specific Candidate</text>
        <text x="1298" y="672">Suitability Analysis.</text>
        <rect x="1201" y="676" width="194" height="2" fill="#248743"/>
      </g>

      <rect x="0" y="862" width="705" height="151" fill="#022340"/>
      <text x="72" y="912" font-family="Arial, sans-serif" font-size="27" font-weight="800" fill="#59bf3e">THREE PERSPECTIVES.</text>
      <text x="72" y="946" font-family="Arial, sans-serif" font-size="21" fill="#ffffff">One integrated view of how</text>
      <text x="72" y="974" font-family="Arial, sans-serif" font-size="21" fill="#ffffff">you think, behave and relate.</text>
    `;

    wrapper.appendChild(overlay);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  window.setTimeout(run, 300);
  window.setTimeout(run, 1000);
  window.setTimeout(run, 2000);
}

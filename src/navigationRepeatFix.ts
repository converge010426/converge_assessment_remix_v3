const STORAGE_REPLAY = 'converge_replay_state';

/**
 * Small stability bridge for the existing React app.
 * It does not change questions, scoring, submission, pricing, or reports.
 */
export function installNavigationRepeatFix(): void {
  if (typeof window === 'undefined' || (window as any).__convergeNavigationRepeatFix) return;
  (window as any).__convergeNavigationRepeatFix = true;

  document.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest('button');
    if (!button) return;
    const text = button.textContent?.replace(/\s+/g, ' ').trim() || '';

    // Product selection starts a new navigation attempt. Clear only the replay
    // marker so a previous product cannot block replay for the next product.
    if (window.location.pathname === '/' && (
      text.includes('MBTI Basic') ||
      text.includes('Comprehensive') ||
      text.includes('Recruiter All-in')
    )) {
      sessionStorage.removeItem(STORAGE_REPLAY);
    }

    // The React navigate() normally handles this. If the SPA transition is
    // swallowed by the presentation/DOM bridge, perform a deterministic route
    // navigation so the user never has to manually refresh the URL.
    if (window.location.pathname === '/' && text === 'Begin Assessment') {
      window.setTimeout(() => {
        if (window.location.pathname === '/') {
          window.location.assign('/quiz');
        }
      }, 120);
    }
  }, true);
}

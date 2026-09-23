import fs from 'node:fs';

const forbidden = [
  ['src/v2MarketFixes.ts', 'function addHeroCorrection'],
  ['src/v2MarketFixes.ts', 'function installBeginAssessmentFallback'],
  ['src/main.tsx', 'installNavigationRepeatFix'],
  ['src/main.tsx', 'installHeroFinalFix'],
  ['src/v2MarketFixes.ts', 'history.pushState ='],
  ['src/v2MarketFixes.ts', 'history.replaceState ='],
  ['src/v2MarketFixes.ts', 'originalPushState'],
  ['src/v2MarketFixes.ts', 'originalReplaceState'],
];

for (const [file, token] of forbidden) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes(token)) {
    console.error('Legacy navigation/hero code detected: ' + file + ' contains "' + token + '"');
    process.exit(1);
  }
}

console.log('Legacy navigation/hero guard: PASS');

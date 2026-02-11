/**
 * Full inspection of vemula.me mobile layout.
 * Run: npx playwright install chromium && node scripts/inspect-vemula.js
 * Output: scripts/vemula-spec.json
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIEWPORT = { width: 375, height: 812 };
const URL = 'https://vemula.me';

const STYLES = [
  'position', 'display', 'flexDirection', 'alignItems', 'justifyContent',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'top', 'right', 'bottom', 'left', 'transform', 'transformOrigin',
  'perspective', 'borderRadius', 'boxShadow', 'backgroundColor', 'color',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'overflow', 'overflowX', 'overflowY', 'touchAction', 'cursor',
  'zIndex', 'gap', 'flex', 'flexShrink', 'objectFit'
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2500);

  const result = await page.evaluate((STYLES) => {
    const getSpec = (el) => {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const out = {
        tagName: el.tagName?.toLowerCase(),
        className: (el.className && typeof el.className === 'string' ? el.className : '')?.slice(0, 120),
        rect: { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), left: Math.round(rect.left) },
        styles: {},
        text: (el.childNodes?.length === 1 && el.childNodes[0].nodeType === 3) ? el.textContent?.trim()?.slice(0, 100) : undefined,
        childrenCount: el.children?.length ?? 0,
      };
      for (const p of STYLES) {
        const k = p.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        const v = cs.getPropertyValue(k);
        if (v && v !== 'none' && v !== 'normal') out.styles[p] = v;
      }
      return out;
    };

    const root = document.body;
    const container = root.querySelector('[class*="container"]') || root.querySelector('main') || root.firstElementChild;
    const pageEl = container?.querySelector('[class*="page_"]') || container?.querySelector('[class*="page"]') || container;
    const titleContainer = document.querySelector('[class*="titleContainer"]') || document.querySelector('[class*="TitleAnimation"]');
    const pageTitle = document.querySelector('[class*="pageTitle"]') || document.querySelector('h1');
    const subtitle = document.querySelector('[class*="subtitle"]');
    const stackWrapper = document.querySelector('[class*="stackWrapper"]');
    const stackContainer = document.querySelector('[class*="stack-container"]') || document.querySelector('[style*="perspective"]');
    const cardRotate = document.querySelector('[class*="card-rotate"]');
    const cardInner = document.querySelector('[class*="card"]')?.querySelector('[class*="card"]') || document.querySelector('[class*="card"]');
    const cards = document.querySelectorAll('[class*="card-rotate"]');

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      body: getSpec(document.body),
      html: getSpec(document.documentElement),
      container: container ? getSpec(container) : null,
      page: pageEl ? getSpec(pageEl) : null,
      titleContainer: titleContainer ? getSpec(titleContainer) : null,
      pageTitle: pageTitle ? getSpec(pageTitle) : null,
      pageTitleText: pageTitle?.innerText?.slice(0, 300) ?? null,
      subtitle: subtitle ? getSpec(subtitle) : null,
      subtitleText: subtitle?.innerText?.slice(0, 150) ?? null,
      stackWrapper: stackWrapper ? getSpec(stackWrapper) : null,
      stackWrapperStyle: stackWrapper?.getAttribute?.('style') ?? null,
      stackContainer: stackContainer ? getSpec(stackContainer) : null,
      stackContainerStyle: stackContainer?.getAttribute?.('style') ?? null,
      cardCount: cards?.length ?? 0,
      cardRotate: cardRotate ? getSpec(cardRotate) : null,
      cardInner: cardInner ? getSpec(cardInner) : null,
      firstCardRect: cardInner ? cardInner.getBoundingClientRect() : null,
    };
  }, STYLES);

  const outPath = path.join(process.cwd(), 'scripts', 'vemula-spec.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('Wrote scripts/vemula-spec.json');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

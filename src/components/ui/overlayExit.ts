/**
 * حركة إغلاق موحدة لكل النوافذ (.app-overlay)
 *
 * النوافذ تختفي من React فوراً عند إغلاقها، لذلك نراقب إزالتها من الصفحة ونضع مكانها
 * نسخة ثابتة (بدون React ولا تستقبل ضغطات) تتلاشى خلال ~200ms ثم تُحذف.
 * بهذا تحصل كل النوافذ على حركة إغلاق دون تعديل كل نافذة على حدة.
 */

// موضع التمرير داخل النوافذ (لا يمكن قراءته بعد إزالة العنصر من الصفحة)
const scrollPositions = new WeakMap<Element, number>();

function cloneAsGhost(overlay: HTMLElement): HTMLElement {
  const ghost = overlay.cloneNode(true) as HTMLElement;
  ghost.classList.add('app-overlay-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;

  const from = [overlay, ...Array.from(overlay.querySelectorAll('*'))];
  const to = [ghost, ...Array.from(ghost.querySelectorAll('*'))];
  const scrolled: Array<[Element, number]> = [];
  from.forEach((src, i) => {
    const dst = to[i];
    if (!dst) return;
    dst.removeAttribute('id');
    // قيم الحقول تبقى كما كانت لحظة الإغلاق
    if (src instanceof HTMLInputElement || src instanceof HTMLTextAreaElement || src instanceof HTMLSelectElement) {
      (dst as typeof src).value = src.value;
    }
    const top = scrollPositions.get(src);
    if (top) scrolled.push([dst, top]);
  });

  document.body.appendChild(ghost);
  scrolled.forEach(([el, top]) => { el.scrollTop = top; });
  return ghost;
}

export function setupOverlayExitAnimations(): void {
  const root = document.getElementById('root');
  if (!root || typeof MutationObserver === 'undefined') return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  document.addEventListener(
    'scroll',
    e => {
      const el = e.target;
      if (el instanceof Element && el.closest('.app-overlay')) scrollPositions.set(el, el.scrollTop);
    },
    { capture: true, passive: true },
  );

  new MutationObserver(records => {
    if (reduceMotion?.matches) return;
    for (const record of records) {
      record.removedNodes.forEach(node => {
        if (!(node instanceof HTMLElement) || !node.classList.contains('app-overlay')) return;
        const ghost = cloneAsGhost(node);
        const remove = () => ghost.remove();
        ghost.addEventListener('animationend', e => { if (e.target === ghost) remove(); });
        window.setTimeout(remove, 400);
      });
    }
  }).observe(root, { childList: true, subtree: true });
}

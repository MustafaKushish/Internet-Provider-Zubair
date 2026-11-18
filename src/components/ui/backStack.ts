/**
 * زر «رجوع» في الهاتف والمتصفح:
 * - إذا كانت نافذة مفتوحة: يغلق آخر نافذة فُتحت بدل الخروج من المنظومة
 * - وإلا: يعود إلى القسم السابق (التبويب)
 *
 * طالما توجد نافذة مفتوحة نضع مدخلاً واحداً إضافياً في سجل المتصفح ("الحارس").
 * الضغط على رجوع يستهلك الحارس ويغلق النافذة العليا، ثم يُعاد وضعه إن بقيت نوافذ أخرى.
 * عند إغلاق آخر نافذة بزر عادي نحذف الحارس بأنفسنا (history.back) ونتجاهل حدثه.
 */

type Entry = { close: () => void };

const stack: Entry[] = [];
let armed = false;
let ignorePops = 0;
let onTabBack: ((tab: string) => void) | null = null;

function arm() {
  if (armed) return;
  history.pushState({ ...(history.state || {}), sasGuard: true }, '');
  armed = true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', e => {
    if (ignorePops > 0) { ignorePops--; return; }
    if (armed && stack.length) {
      armed = false;
      stack.pop()!.close();
      if (stack.length) arm();
      return;
    }
    armed = false;
    const tab = (e.state as { sasTab?: string } | null)?.sasTab;
    if (tab && onTabBack) onTabBack(tab);
  });
}

/** تسجيل نافذة مفتوحة؛ يعيد دالة تُستدعى عند إغلاقها */
export function registerBackClose(close: () => void): () => void {
  const entry: Entry = { close };
  stack.push(entry);
  arm();
  return () => {
    const i = stack.indexOf(entry);
    if (i < 0) return; // أُغلقت بزر رجوع
    stack.splice(i, 1);
    // ننتظر قليلاً: قد تُفتح نافذة أخرى مكانها مباشرة (الملف ← التجديد) فيبقى الحارس
    setTimeout(() => {
      if (!stack.length && armed) {
        armed = false;
        ignorePops++;
        history.back();
      }
    }, 0);
  };
}

/** يسجل التبويب الحالي في سجل المتصفح ليعمل زر رجوع بين الأقسام */
export function pushTabHistory(tab: string, replace = false): void {
  if (armed) return; // لا نغيّر السجل أثناء فتح نافذة
  const state = { sasTab: tab };
  if (replace) history.replaceState(state, '');
  else if ((history.state as { sasTab?: string } | null)?.sasTab !== tab) history.pushState(state, '');
}

export function setTabBackHandler(handler: ((tab: string) => void) | null): void {
  onTabBack = handler;
}

// Genel klavye kısayolları için ortak kural: yazı alanında ya da diyalog içindeyken kısayol YOK.
// (Esc'yi diyalog kendisi işler: yalnız pencereyi kapatır.)

/** Olay bir form denetiminden (input, textarea, select, combobox, contenteditable) mi geliyor? */
export function isFormTarget(t: EventTarget | null): boolean {
  const el = t instanceof HTMLElement ? t : null;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable || el.getAttribute('role') === 'combobox';
}

/** Açık bir modal diyalog var mı ya da olay bir diyalogun içinden mi geliyor? */
export function inDialog(t: EventTarget | null): boolean {
  const el = t instanceof Element ? t : null;
  return !!el?.closest('[role="dialog"]') || !!document.querySelector('[role="dialog"][aria-modal="true"]');
}

/** Genel kısayol işlenmeli mi? Değiştirici tuşlar, yazı alanları ve açık diyaloglar hariç. */
/** Ayarlar → "Tek tuş kısayollarını kapat" (ekran okuyucu tuşlarıyla çakışırsa). Alt+T her zaman çalışır. */
let enabled = true;
export const setShortcutsEnabled = (v: boolean) => { enabled = v; };
export const shortcutsEnabled = () => enabled;
export function shortcutAllowed(e: KeyboardEvent): boolean {
  if (!enabled || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false;
  return !isFormTarget(e.target) && !inDialog(e.target);
}

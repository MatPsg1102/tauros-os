// Script inicial anti-flash (6.3.2 §7) — string mínima executada ANTES da
// hidratação para definir os atributos data-* corretos e evitar FOUC.
// Sem eval, sem rede, sem segredos; valida o storage; falha em silêncio.
// A aplicação decide COMO servir (inline com nonce de CSP ou arquivo externo)
// — nenhum acoplamento a Next.js aqui.

import { PREFERENCES_STORAGE_KEY } from './theme-types.js';

export interface InitialThemeScriptOptions {
  /** Chave versionada do storage (default: oficial do pacote). */
  readonly storageKey?: string;
}

/**
 * Gera o conteúdo JS do script inicial. Lógica espelhada de
 * `resolveEffectiveTheme` reduzida ao necessário pré-hidratação:
 * colorScheme (+system), reducedMotion (+system), contraste e glove.
 */
export function buildInitialThemeScript(options: InitialThemeScriptOptions = {}): string {
  const key = JSON.stringify(options.storageKey ?? PREFERENCES_STORAGE_KEY);
  // String estática — nenhum dado externo entra na composição além da chave
  // (serializada com JSON.stringify, nunca concatenação crua).
  return (
    '(function(){try{' +
    'var d=document.documentElement;' +
    `var raw=null;try{raw=localStorage.getItem(${key});}catch(e){}` +
    'var p=null;try{p=raw?JSON.parse(raw):null;}catch(e){}' +
    'var ok=p&&p.version===1&&p.preferences&&typeof p.preferences==="object";' +
    'var pref=ok?p.preferences:{};' +
    'var scheme=(pref.colorScheme==="light"||pref.colorScheme==="dark")?pref.colorScheme:"system";' +
    'var m=(pref.modes&&typeof pref.modes==="object")?pref.modes:{};' +
    'var mq=function(q){try{return window.matchMedia(q).matches;}catch(e){return false;}};' +
    'var dark=scheme==="dark"||(scheme==="system"&&mq("(prefers-color-scheme: dark)"));' +
    'var reduced=m.reducedMotion===true||(m.reducedMotion!==false&&mq("(prefers-reduced-motion: reduce)"));' +
    'var contrast=m.industrial===true||m.highContrast===true||mq("(prefers-contrast: more)");' +
    'd.setAttribute("data-theme",dark?"dark":"light");' +
    'd.setAttribute("data-contrast",contrast?"high":"default");' +
    'd.setAttribute("data-environment",m.industrial===true?"industrial":"default");' +
    'd.setAttribute("data-input-mode",m.glove===true?"glove":"default");' +
    'd.setAttribute("data-motion",reduced?"reduced":"default");' +
    '}catch(e){}})();'
  );
}

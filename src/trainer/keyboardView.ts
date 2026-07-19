import type { KeyCode, KeyStat, GuidanceMode, KeyboardView } from './types';
import { HE_LAYOUT } from './data/hebrewLayout';
import { confidenceFor } from './engine/confidence';
import { GATE } from './engine/gating';

interface ViewOpts {
  nextCode: KeyCode | null; statsByCode: Record<KeyCode, KeyStat>; guidance: GuidanceMode;
  faultCode?: KeyCode | null; // optional: the key to flash `key-fault` on (see useFaultFlash)
}

export function buildKeyboardView({ nextCode, statsByCode, guidance, faultCode = null }: ViewOpts): KeyboardView {
  const view: KeyboardView = {};
  for (const key of HE_LAYOUT) {
    const stat = statsByCode[key.code];
    // Only tint keys that have actually been practiced. A never-typed key has no
    // meaningful "confidence" — painting it red (heat 0) just reads as "you're bad
    // at everything" on a fresh keyboard, so leave it untinted (heat undefined).
    const hasData = !!stat && stat.attempts > 0;
    const conf = hasData ? confidenceFor(stat) : 0;
    const isNext = key.code === nextCode;
    let hidden = false, dim = false;
    if (!isNext) {
      if (guidance === 'hidden') hidden = true;
      else if (guidance === 'dim') dim = true;
      else if (guidance === 'auto') hidden = conf >= GATE.minConfidence;
    }
    view[key.componentId] = { heat: hasData ? conf : undefined, finger: key.finger, isNextTarget: isNext, hidden, dim, fault: key.code === faultCode };
  }
  return view;
}

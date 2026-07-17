import type { KeyCode, KeyStat, GuidanceMode, KeyboardView } from './types';
import { HE_LAYOUT } from './data/hebrewLayout';
import { confidenceFor } from './engine/confidence';
import { GATE } from './engine/gating';

interface ViewOpts { nextCode: KeyCode | null; statsByCode: Record<KeyCode, KeyStat>; guidance: GuidanceMode }

export function buildKeyboardView({ nextCode, statsByCode, guidance }: ViewOpts): KeyboardView {
  const view: KeyboardView = {};
  for (const key of HE_LAYOUT) {
    const stat = statsByCode[key.code];
    const conf = stat ? confidenceFor(stat) : 0;
    const isNext = key.code === nextCode;
    let hidden = false, dim = false;
    if (!isNext) {
      if (guidance === 'hidden') hidden = true;
      else if (guidance === 'dim') dim = true;
      else if (guidance === 'auto') hidden = conf >= GATE.minConfidence;
    }
    view[key.componentId] = { heat: conf, finger: key.finger, isNextTarget: isNext, hidden, dim };
  }
  return view;
}

/*
 * Reading a Trinity audit's verdict.
 *
 * The model answers in the user's own language, so these three fields come back
 * in whatever Kno is set to. Matching English words alone meant a Chinese audit
 * never matched anything and every card came back green "SOLID LOGIC" — the one
 * verdict the audit had not given. Each flag carries the words the model uses
 * for it in the languages the interface offers.
 */
import type { CritiqueResult } from '../types';

const BAD_LOGIC = ['fallacy', 'flaw', 'unsound', '谬误', '不成立', '有缺陷', 'falacia', 'sophisme', 'fehlschluss', '誤謬', '오류'];
const BAD_FACT = ['unverified', 'misleading', 'false', '未经验证', '未經驗證', '存疑', '误导', '誤導', '不实', 'no verificad', 'non vérifié', 'unbelegt', '未検証', '검증되지'];
const SKEWED = ['skewed', 'echo', 'bias', '偏斜', '偏颇', '偏頗', '片面', '回音', 'sesgad', 'biais', 'einseitig', '偏り', '편향'];

const hits = (value: string | undefined, words: string[]) => {
  const v = (value || '').toLowerCase();
  return words.some(w => v.includes(w));
};

export type CritiqueStatus = 'danger' | 'warning' | 'safe';

export function critiqueStatusOf(critique: CritiqueResult | undefined): CritiqueStatus | null {
  if (!critique) return null;
  const a = critique.structuredAnalysis;
  if (!a) return critique.isSafe ? 'safe' : 'danger';
  if (hits(a.logic?.status, BAD_LOGIC) || hits(a.factual?.status, BAD_FACT)) return 'danger';
  if (hits(a.balance?.status, SKEWED)) return 'warning';
  return 'safe';
}

export const isFallacy = (critique: CritiqueResult | undefined) =>
  critique?.isSafe === false || hits(critique?.structuredAnalysis?.logic?.status, BAD_LOGIC);

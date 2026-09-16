/**
 * SmartDraw Analytics — Core math module.
 *
 * Strategy "Draw (X) + Odd Total" — legal two-shoulder arbitrage.
 *
 * All formulas are taken directly from the TZ (the Python reference implementation
 * is the source of truth — the written formula text in §3.1 is garbled):
 *  - ROI   = (1 / (1/K_draw + 1/K_odd) - 1) * 100%   ← matches TZ Python `prematch_roi`
 *  - S_draw = S * K_odd / (K_draw + K_odd)
 *  - S_odd  = S * K_draw / (K_draw + K_odd)
 *  - R_prematch = S_draw * K_draw = S / (1/K_draw + 1/K_odd)
 *  - S_hedge = R_prematch / K_live_correct_score
 *  - Rounding: nearest multiple of `roundingStep`, never below `roundingStep`
 *  - Net if score holds = S_hedge * K_live - S - S_hedge
 *  - Net if goal scored = R_prematch - S - S_hedge
 *
 * Zone classifier (final score or live score):
 *  - SAFE (green):   total odd OR diff == 0  -> one of pre-match shoulders wins
 *  - DANGER (red):   total even, diff == 2, total <= 4  -> {2:0,0:2,3:1,1:3}
 *  - ANOMALOUS (yellow): total even, diff >= 2, otherwise -> {4:0,0:4,4:2,...}
 */

export type Zone = 'green' | 'red' | 'yellow';

export interface PrematchCalcInput {
  totalBank: number;
  kDraw: number;
  kOdd: number;
  kFavorite?: number | null;
  roundingStep?: number;
  minRoi?: number;
  minFavoriteK?: number;
}

export interface PrematchCalcResult {
  roi: number;
  rPrematch: number;
  sDraw: number;
  sOdd: number;
  sDrawRounded: number;
  sOddRounded: number;
  /** Effective ROI after rounding (true realised ROI) */
  roiRounded: number;
  /** Implied probability sum (1/Kd + 1/Ko) — arb exists when < 1 */
  impliedProbSum: number;
  passed: boolean;
  passedReasons: string[];
}

export interface HedgeCalcInput {
  totalBank: number;
  kDraw: number;
  kOdd: number;
  kLiveCorrectScore: number;
  roundingStep?: number;
}

export interface HedgeCalcResult {
  sDraw: number;
  sOdd: number;
  rPrematch: number;
  prematchRoi: number;
  rawSHedge: number;
  sHedgeRounded: number;
  netIfScoreHolds: number;
  netIfGoalScored: number;
  netIfScoreHoldsPct: number;
  netIfGoalScoredPct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  const rounded = Math.round(value / step) * step;
  return Math.max(step, rounded);
}

export function pct(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

// ─── Zone classifier ───────────────────────────────────────────────────────
export function classifyZone(home: number, away: number): {
  zone: Zone;
  label: string;
  reason: string;
} {
  const total = home + away;
  const diff = Math.abs(home - away);

  if (total % 2 === 1) {
    return {
      zone: 'green',
      label: 'Зелёная зона',
      reason: 'Нечётный тотал — зашло плечо «Нечет».',
    };
  }
  if (diff === 0) {
    return {
      zone: 'green',
      label: 'Зелёная зона',
      reason: 'Ничья — зашло плечо «Ничья (X)».',
    };
  }
  // Even total, diff >= 2 → blind zone
  if (diff === 2 && total <= 4) {
    return {
      zone: 'red',
      label: 'Опасная зона',
      reason: 'Чётный счёт с разницей 2 — слепая зона, нужна страховка.',
    };
  }
  return {
    zone: 'yellow',
    label: 'Аномальная зона',
    reason: 'Высокий чётный счёт — ждать 80+ минуты, возможен 5-й гол (переход в Нечет).',
  };
}

// ─── Pre-match arbitrage calculator ───────────────────────────────────────
export function calcPrematch(input: PrematchCalcInput): PrematchCalcResult {
  const {
    totalBank,
    kDraw,
    kOdd,
    kFavorite = null,
    roundingStep = 50,
    minRoi = 20,
    minFavoriteK = 1.9,
  } = input;

  const impliedProbSum = 1 / kDraw + 1 / kOdd;
  // ROI = 1/(1/Kd + 1/Ko) - 1  (standard arbitrage yield; matches TZ Python `prematch_roi`)
  const roi = (1 / impliedProbSum - 1) * 100;

  // Note: ROI > 0 when 1/Kd + 1/Ko < 1 (classic arb condition).
  // The minRoi threshold filter decides which matches to take.
  const sDraw = (totalBank * kOdd) / (kDraw + kOdd);
  const sOdd = (totalBank * kDraw) / (kDraw + kOdd);
  const rPrematch = sDraw * kDraw;

  const sDrawRounded = roundToStep(sDraw, roundingStep);
  const sOddRounded = roundToStep(sOdd, roundingStep);
  // Effective realised ROI after rounding (conservative — use min of two shoulders)
  const rAfterRound = Math.min(sDrawRounded * kDraw, sOddRounded * kOdd);
  const roiRounded = pct(rAfterRound - totalBank, totalBank);

  const passedReasons: string[] = [];
  let passed = true;

  if (roi < minRoi) {
    passed = false;
    passedReasons.push(`ROI ${roi.toFixed(2)}% < порога ${minRoi}%`);
  }
  if (kFavorite != null && kFavorite > 0 && kFavorite < minFavoriteK) {
    passed = false;
    passedReasons.push(
      `Кэф фаворита ${kFavorite.toFixed(2)} < ${minFavoriteK} (явный фаворит)`,
    );
  }
  if (passed) {
    passedReasons.push('Матч прошёл все фильтры — брать в работу.');
  }

  return {
    roi: round2(roi),
    rPrematch: round2(rPrematch),
    sDraw: round2(sDraw),
    sOdd: round2(sOdd),
    sDrawRounded,
    sOddRounded,
    roiRounded: round2(roiRounded),
    impliedProbSum: round4(impliedProbSum),
    passed,
    passedReasons,
  };
}

// ─── Live hedge calculator ─────────────────────────────────────────────────
export function calcHedge(input: HedgeCalcInput): HedgeCalcResult {
  const { totalBank, kDraw, kOdd, kLiveCorrectScore, roundingStep = 50 } = input;

  const sDraw = (totalBank * kOdd) / (kDraw + kOdd);
  const sOdd = (totalBank * kDraw) / (kDraw + kOdd);
  const rPrematch = sDraw * kDraw;
  const prematchRoi = pct(rPrematch - totalBank, totalBank);

  // Mathematically exact hedge: S_hedge * K_live = R_prematch
  const rawSHedge = rPrematch / kLiveCorrectScore;
  const sHedgeRounded = roundToStep(rawSHedge, roundingStep);

  // Scenario A: score stays the same — the live Correct Score bet wins
  const payoutIfHolds = sHedgeRounded * kLiveCorrectScore;
  const netIfScoreHolds = payoutIfHolds - totalBank - sHedgeRounded;

  // Scenario B: one more goal is scored — pre-match Odd Total shoulder wins
  const netIfGoalScored = rPrematch - totalBank - sHedgeRounded;

  return {
    sDraw: round2(sDraw),
    sOdd: round2(sOdd),
    rPrematch: round2(rPrematch),
    prematchRoi: round2(prematchRoi),
    rawSHedge: round2(rawSHedge),
    sHedgeRounded,
    netIfScoreHolds: round2(netIfScoreHolds),
    netIfGoalScored: round2(netIfGoalScored),
    netIfScoreHoldsPct: round2(pct(netIfScoreHolds, totalBank)),
    netIfGoalScoredPct: round2(pct(netIfGoalScored, totalBank)),
  };
}

// ─── Final P&L when a match is closed ──────────────────────────────────────
export interface FinalPnlInput {
  totalBank: number;
  kDraw: number;
  kOdd: number;
  sDrawRounded: number;
  sOddRounded: number;
  homeScore: number;
  awayScore: number;
  hedge?: {
    sHedgeRounded: number;
    kLiveCorrectScore: number;
    /** did the live score stay until FT (hedge won) or did a goal flip it? */
    hedgeWon: boolean;
  } | null;
}

export interface FinalPnlResult {
  zone: Zone;
  resultType: 'draw' | 'odd' | 'blind' | 'hedged';
  finalPnl: number;
  finalRoi: number;
  description: string;
}

export function calcFinalPnl(input: FinalPnlInput): FinalPnlResult {
  const { totalBank, kDraw, kOdd, sDrawRounded, sOddRounded, homeScore, awayScore, hedge } = input;
  const zone = classifyZone(homeScore, awayScore).zone;

  // Determine which pre-match shoulder won (if any)
  const total = homeScore + awayScore;
  const diff = Math.abs(homeScore - awayScore);
  const drawWon = diff === 0;
  const oddWon = total % 2 === 1;

  let prematchReturn = 0;
  let resultType: FinalPnlResult['resultType'];

  if (drawWon) {
    prematchReturn = sDrawRounded * kDraw;
    resultType = 'draw';
  } else if (oddWon) {
    prematchReturn = sOddRounded * kOdd;
    resultType = 'odd';
  } else {
    // Blind zone — neither shoulder wins
    prematchReturn = 0;
    resultType = hedge ? 'hedged' : 'blind';
  }

  let hedgeReturn = 0;
  if (hedge) {
    hedgeReturn = hedge.hedgeWon
      ? hedge.sHedgeRounded * hedge.kLiveCorrectScore
      : 0;
    // If hedge lost (a goal was scored), the odd shoulder usually wins.
    if (!hedge.hedgeWon && oddWon) {
      prematchReturn = sOddRounded * kOdd;
      resultType = 'hedged';
    }
    if (hedge.hedgeWon) {
      resultType = 'hedged';
    }
  }

  const totalStaked = totalBank + (hedge ? hedge.sHedgeRounded : 0);
  const finalPnl = prematchReturn + hedgeReturn - totalStaked;
  const finalRoi = pct(finalPnl, totalBank);

  let description: string;
  if (resultType === 'draw') description = `Ничья ${homeScore}:${awayScore} — зашло плечо «Ничья».`;
  else if (resultType === 'odd') description = `Нечётный тотал (${total}) — зашло плечо «Нечет».`;
  else if (resultType === 'hedged') description = hedge?.hedgeWon
    ? `Слепая зона ${homeScore}:${awayScore} — страховка зашла, убыток минимизирован.`
    : `Слепая зона ${homeScore}:${awayScore} — забит гол, зашло плечо «Нечет» (страховка проиграла).`;
  else description = `Слепая зона ${homeScore}:${awayScore} — без страховки, полный убыток.`;

  return {
    zone,
    resultType,
    finalPnl: round2(finalPnl),
    finalRoi: round2(finalRoi),
    description,
  };
}

// ─── Utils ──────────────────────────────────────────────────────────────────
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function formatMoney(v: number, withSign = false): string {
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${Math.round(v).toLocaleString('ru-RU')} ₽`;
}

export function formatPct(v: number, withSign = true): string {
  const sign = withSign && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

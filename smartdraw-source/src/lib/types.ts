// Shared client-side types matching the API responses

export type Zone = 'green' | 'red' | 'yellow';
export type MatchStatus = 'prematch' | 'live' | 'finished' | 'cancelled';
export type ResultType = 'draw' | 'odd' | 'hedged' | 'blind';

export interface League {
  id: string;
  country: string;
  name: string;
  code: string;
  tier: 'whitelist' | 'blacklist' | 'neutral';
  zone: string | null;
  avgDrawPct: number | null;
  avgUnder25Pct: number | null;
  notes: string | null;
}

export interface Hedge {
  id: string;
  matchId: string;
  minute: number;
  currentHome: number;
  currentAway: number;
  scoreLabel: string;
  kLiveCorrectScore: number;
  rawSHedge: number;
  sHedgeRounded: number;
  netIfScoreHolds: number;
  netIfGoalScored: number;
  netIfScoreHoldsPct: number;
  netIfGoalScoredPct: number;
  applied: boolean;
  createdAt: string;
}

export interface Match {
  id: string;
  leagueId: string | null;
  league: League | null;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  totalBank: number;
  kDraw: number;
  kOdd: number;
  kFavorite: number | null;
  favoriteSide: string | null;
  bkDraw: string | null;
  bkOdd: string | null;
  sDraw: number | null;
  sOdd: number | null;
  sDrawRounded: number | null;
  sOddRounded: number | null;
  roiPrematch: number | null;
  rPrematch: number | null;
  passedFilter: boolean;
  status: MatchStatus;
  homeScore: number;
  awayScore: number;
  minute: number;
  zone: Zone | null;
  resultType: ResultType | null;
  finalPnl: number | null;
  finalRoi: number | null;
  notes: string | null;
  hedges: Hedge[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: string;
  roundingStep: number;
  minRoi: number;
  minFavoriteK: number;
  defaultBank: number;
  liveStartMin: number;
  liveEndMin: number;
  hedgeTargetLoss: number;
}

export interface Stats {
  overview: {
    total: number;
    wins: number;
    losses: number;
    breakeven: number;
    winRate: number;
    totalBankStaked: number;
    totalPnl: number;
    totalRoi: number;
    hedgeCount: number;
    matchesWithHedge: number;
    activeLive: number;
    activePrematch: number;
  };
  byResult: Record<ResultType, number>;
  byLeague: {
    league: string;
    count: number;
    pnl: number;
    bank: number;
    roi: number;
  }[];
  series: {
    id: string;
    label: string;
    pnl: number;
    roi: number;
    date: string;
  }[];
}

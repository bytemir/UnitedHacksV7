import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  HelpCircle,
  Moon,
  Search,
  Settings,
  Sun,
  Trophy,
  Tv,
  User,
} from "lucide-react";

import rawPlayersJson from "../../data/worldcup_players.json";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameState = "PLAYING" | "WON" | "LOST";
type GameMode = "CLASSIC" | "BLUR";
type Position = "GK" | "DF" | "MF" | "FW";
type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
type FeedbackState = "correct" | "partial" | "wrong";

interface Player {
  id: string;
  name: string;
  espnId: string;
  country: string;
  confederation: Confederation;
  league: string;
  position: Position;
  age: number;
  shirtNumber: number;
}

interface ComparisonResult {
  country: FeedbackState;
  confederation: FeedbackState;
  league: FeedbackState;
  position: FeedbackState;
  age: FeedbackState;
  ageHint?: "up" | "down";
  shirtNumber: FeedbackState;
  shirtNumberHint?: "up" | "down";
}

interface GuessRow {
  player: Player;
  comparison: ComparisonResult;
}

interface RawPlayer {
  id: number;
  name: string;
  espn_id: string;
  country: string;
  confederation: Confederation;
  league: string;
  position: Position;
  age: number;
  shirt_number: number;
}

interface GameStats {
  totalGames: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: number[];
}

// ─── Player Dataset (local JSON) ─────────────────────────────────────────────

function normalizePlayers(raw: RawPlayer[]): Player[] {
  return raw.map((p) => ({
    id: String(p.id),
    name: p.name,
    espnId: p.espn_id,
    country: p.country,
    confederation: p.confederation,
    league: p.league,
    position: p.position,
    age: p.age,
    shirtNumber: p.shirt_number,
  }));
}

const ALL_PLAYERS: Player[] = normalizePlayers(
  rawPlayersJson as RawPlayer[],
);

const STATS_STORAGE_KEY = "worldcupdle_stats";

const EMPTY_STATS: GameStats = {
  totalGames: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
};

const STADIUM_BG =
  "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=2400&q=80";

const LOCAL_FACE_DEFAULT = "/faces/default.png";

function localFaceUrl(espnId: string): string {
  return `/faces/${espnId}.png`;
}

function handleLocalFaceError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
) {
  const img = e.target as HTMLImageElement;
  if (!img.src.endsWith("/faces/default.png")) {
    img.src = "/faces/default.png";
  }
}

const HEADSHOT_IMG_CLASS =
  "w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-slate-700/50 flex-shrink-0";

function PlayerHeadshot({
  espnId,
  alt,
  className = "",
}: {
  espnId?: string;
  alt: string;
  className?: string;
}) {
  const src = espnId ? localFaceUrl(espnId) : LOCAL_FACE_DEFAULT;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={handleLocalFaceError}
      className={`${HEADSHOT_IMG_CLASS} ${className}`}
    />
  );
}

const MAX_GUESSES = 6;

/** Blur intensity per attempt index (0 = before first guess, 5 = sixth guess) */
const BLUR_LEVELS_PX = [14, 10, 7, 4, 2, 1] as const;

function getBlurPx(guessCount: number, gameState: GameState): number {
  if (gameState !== "PLAYING") return 0;
  return BLUR_LEVELS_PX[Math.min(guessCount, MAX_GUESSES - 1)];
}

const COLUMN_HEADERS = [
  "Player",
  "Country",
  "League",
  "Pos",
  "Age",
  "#",
] as const;

const BLUR_COLUMN_HEADERS = [
  "Name/Face",
  "Country",
  "Confederation",
  "League",
  "Position",
  "Age/#",
] as const;

const ATTRIBUTE_HEADERS = COLUMN_HEADERS.slice(1);

const FLIP_STAGGER_MS = 80;

/** ~170% scaled layout tokens (base × 1.7) */
const APP_CONTAINER = "max-w-5xl";

/** Shared row grid — 6 equal columns, micro spacing */
const ROW_GRID = "grid w-full grid-cols-6 gap-1 sm:gap-1.5";

/** Row stack — tight vertical rhythm for 6 guess rows */
const ROW_STACK = "flex flex-col gap-1 sm:gap-1.5";

/** Fixed cell height — compact tiles to fit viewport without scroll */
const CELL_SHELL =
  "flex h-10 w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-sm border px-0.5 sm:h-12";

const TILE_TEXT =
  "block w-full min-w-0 truncate whitespace-nowrap overflow-hidden text-xs font-bold sm:text-sm";

const FIFA_CODES: Record<string, string> = {
  France: "FRA",
  Argentina: "ARG",
  Portugal: "POR",
  Norway: "NOR",
  Brazil: "BRA",
  England: "ENG",
  Spain: "ESP",
  Croatia: "CRO",
  Egypt: "EGY",
  "South Korea": "KOR",
  Belgium: "BEL",
  Netherlands: "NED",
  Canada: "CAN",
  USA: "USA",
  Nigeria: "NGA",
  Germany: "GER",
  Poland: "POL",
  Morocco: "MAR",
  Uruguay: "URU",
};

const COUNTRY_FLAGS: Record<string, string> = {
  France: "🇫🇷",
  Argentina: "🇦🇷",
  Portugal: "🇵🇹",
  Norway: "🇳🇴",
  Brazil: "🇧🇷",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Croatia: "🇭🇷",
  Egypt: "🇪🇬",
  "South Korea": "🇰🇷",
  Belgium: "🇧🇪",
  Netherlands: "🇳🇱",
  Canada: "🇨🇦",
  USA: "🇺🇸",
  Nigeria: "🇳🇬",
  Germany: "🇩🇪",
  Poland: "🇵🇱",
  Morocco: "🇲🇦",
  Uruguay: "🇺🇾",
};

const LEAGUE_SHORT: Record<string, string> = {
  "Premier League": "EPL",
  "La Liga": "LaLiga",
  Bundesliga: "BL",
  "Serie A": "SerieA",
  "Ligue 1": "L1",
  MLS: "MLS",
  "Saudi Pro League": "SPL",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readStats(): GameStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) {
      return {
        ...EMPTY_STATS,
        guessDistribution: [...EMPTY_STATS.guessDistribution],
      };
    }
    const parsed = JSON.parse(raw) as GameStats;
    return {
      ...EMPTY_STATS,
      ...parsed,
      guessDistribution:
        parsed.guessDistribution?.length === 6
          ? [...parsed.guessDistribution]
          : [...EMPTY_STATS.guessDistribution],
    };
  } catch {
    return {
      ...EMPTY_STATS,
      guessDistribution: [...EMPTY_STATS.guessDistribution],
    };
  }
}

function writeStats(stats: GameStats) {
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
}

function applyWinStats(guessCount: number): GameStats {
  const stats = readStats();
  stats.totalGames += 1;
  stats.wins += 1;
  stats.currentStreak += 1;
  stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  if (guessCount >= 1 && guessCount <= MAX_GUESSES) {
    stats.guessDistribution[guessCount - 1] += 1;
  }
  writeStats(stats);
  return stats;
}

function applyLossStats(): GameStats {
  const stats = readStats();
  stats.totalGames += 1;
  stats.currentStreak = 0;
  writeStats(stats);
  return stats;
}

function winPercentage(stats: GameStats): number {
  if (stats.totalGames === 0) return 0;
  return Math.round((stats.wins / stats.totalGames) * 100);
}

function pickRandomPlayer(players: Player[], excludeId?: string): Player {
  const pool =
    excludeId && players.length > 1
      ? players.filter((p) => p.id !== excludeId)
      : players;
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatDailyDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getFifaCode(country: string): string {
  return FIFA_CODES[country] ?? country.slice(0, 3).toUpperCase();
}

function getFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? "🏳️";
}

function formatCountry(country: string): string {
  return `${getFlag(country)} ${getFifaCode(country)}`;
}

function formatLeague(league: string, compact: boolean): string {
  if (compact) return LEAGUE_SHORT[league] ?? league;
  return league;
}

function compareGuess(guess: Player, target: Player): ComparisonResult {
  const country: FeedbackState =
    guess.country === target.country
      ? "correct"
      : guess.confederation === target.confederation
        ? "partial"
        : "wrong";

  const confederation: FeedbackState =
    guess.confederation === target.confederation ? "correct" : "wrong";

  const league: FeedbackState =
    guess.league === target.league ? "correct" : "wrong";

  const position: FeedbackState =
    guess.position === target.position ? "correct" : "wrong";

  const ageCorrect = guess.age === target.age;
  const age: FeedbackState = ageCorrect ? "correct" : "wrong";
  const ageHint: "up" | "down" | undefined = ageCorrect
    ? undefined
    : target.age > guess.age
      ? "up"
      : "down";

  const shirtCorrect = guess.shirtNumber === target.shirtNumber;
  const shirtNumber: FeedbackState = shirtCorrect ? "correct" : "wrong";
  const shirtNumberHint: "up" | "down" | undefined = shirtCorrect
    ? undefined
    : target.shirtNumber > guess.shirtNumber
      ? "up"
      : "down";

  return {
    country,
    confederation,
    league,
    position,
    age,
    ageHint,
    shirtNumber,
    shirtNumberHint,
  };
}

function combinedAgeNumberState(c: ComparisonResult): FeedbackState {
  if (c.age === "correct" && c.shirtNumber === "correct") return "correct";
  return "wrong";
}

function tileStateClasses(state: FeedbackState): string {
  switch (state) {
    case "correct":
      return "bg-emerald-600 border-emerald-500 text-white";
    case "partial":
      return "bg-amber-500 border-amber-400 text-white";
    case "wrong":
      return "bg-red-600/90 border-red-500 text-white";
  }
}

function remainingAttempts(guesses: number, gameState: GameState): number {
  if (gameState !== "PLAYING") return 0;
  return MAX_GUESSES - guesses;
}

interface ThemeClasses {
  rootText: string;
  overlay: string;
  header: string;
  headerTitle: string;
  headerSub: string;
  headerBtn: string;
  intro: string;
  input: string;
  inputFocus: string;
  searchIcon: string;
  dropdown: string;
  dropdownItem: string;
  dropdownItemActive: string;
  dropdownSub: string;
  dropdownAvatar: string;
  attempts: string;
  columnHeader: string;
  legend: string;
  emptyTile: string;
  playerName: string;
  playerAvatarBorder: string;
  playerAvatarBorderEmpty: string;
  playerIcon: string;
  playerIconEmpty: string;
  settingsPanel: string;
  settingsItem: string;
  settingsItemActive: string;
  helpBackdrop: string;
  helpPanel: string;
  helpBody: string;
  gameOverBackdrop: string;
  gameOverPanel: string;
  gameOverCard: string;
  gameOverSub: string;
  modePillActive: string;
  modePillInactive: string;
  blurFrame: string;
}

function getTheme(isDarkMode: boolean): ThemeClasses {
  if (isDarkMode) {
    return {
      rootText: "text-slate-100",
      overlay: "backdrop-blur-md bg-slate-950/80",
      header: "border-slate-700/60 bg-slate-950/50",
      headerTitle: "text-white",
      headerSub: "text-slate-500",
      headerBtn:
        "text-slate-400 hover:bg-slate-800/60 hover:text-amber-400",
      intro: "text-slate-400",
      input:
        "border-slate-700 bg-slate-900/90 text-slate-100 placeholder:text-slate-600",
      inputFocus: "focus:border-amber-400/40",
      searchIcon: "text-slate-500",
      dropdown: "border-slate-700 bg-slate-900/98",
      dropdownItem: "text-slate-300 hover:bg-slate-800/70",
      dropdownItemActive: "bg-slate-800 text-white",
      dropdownSub: "text-slate-500",
      dropdownAvatar: "border-slate-700 bg-slate-800",
      attempts: "text-slate-400",
      columnHeader: "text-white",
      legend: "text-white",
      emptyTile: "border border-slate-700 bg-slate-900/40",
      playerName:
        "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]",
      playerAvatarBorder: "border-slate-400/50",
      playerAvatarBorderEmpty: "border-slate-600/40",
      playerIcon: "text-slate-100",
      playerIconEmpty: "text-slate-500/70",
      settingsPanel: "border-slate-700 bg-slate-900 shadow-xl",
      settingsItem: "text-slate-200 hover:bg-slate-800",
      settingsItemActive: "bg-slate-800 text-amber-400",
      helpBackdrop: "bg-black/60",
      helpPanel: "border-slate-700 bg-slate-900/95 text-white",
      helpBody: "text-slate-300",
      gameOverBackdrop: "bg-slate-950/75",
      gameOverPanel: "border-slate-700 bg-slate-900/95",
      gameOverCard: "border-slate-700 bg-slate-800/60",
      gameOverSub: "text-slate-400",
      modePillActive: "bg-emerald-600/90 text-white shadow-sm",
      modePillInactive: "text-slate-400 bg-slate-800/40 hover:bg-slate-800/60",
      blurFrame: "border-slate-600/50 bg-slate-900/30 shadow-xl shadow-black/30",
    };
  }

  return {
    rootText: "text-slate-900",
    overlay: "backdrop-blur-md bg-white/80",
    header: "border-slate-200 bg-white/80",
    headerTitle: "text-slate-900",
    headerSub: "text-slate-600",
    headerBtn: "text-slate-600 hover:bg-slate-200/80 hover:text-amber-600",
    intro: "text-slate-600",
    input:
      "border-slate-200 bg-white/90 text-slate-900 placeholder:text-slate-400",
    inputFocus: "focus:border-amber-500/50",
    searchIcon: "text-slate-400",
    dropdown: "border-slate-200 bg-white/98",
    dropdownItem: "text-slate-700 hover:bg-slate-100",
    dropdownItemActive: "bg-slate-200 text-slate-900",
    dropdownSub: "text-slate-500",
    dropdownAvatar: "border-slate-200 bg-slate-100",
    attempts: "text-slate-600",
    columnHeader: "text-slate-900",
    legend: "text-slate-900",
    emptyTile: "border border-slate-300 bg-white/50",
    playerName:
      "text-slate-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]",
    playerAvatarBorder: "border-slate-600/60",
    playerAvatarBorderEmpty: "border-slate-400/50",
    playerIcon: "text-slate-700",
    playerIconEmpty: "text-slate-400",
    settingsPanel: "border-slate-200 bg-white shadow-xl",
    settingsItem: "text-slate-800 hover:bg-slate-100",
    settingsItemActive: "bg-slate-100 text-amber-600",
    helpBackdrop: "bg-black/40",
    helpPanel: "border-slate-200 bg-white/95 text-slate-900",
    helpBody: "text-slate-600",
    gameOverBackdrop: "bg-black/40",
    gameOverPanel: "border-slate-200 bg-white/95",
    gameOverCard: "border-slate-200 bg-slate-50",
    gameOverSub: "text-slate-600",
    modePillActive: "bg-emerald-600/90 text-white shadow-sm",
    modePillInactive: "text-slate-500 bg-slate-100/80 hover:bg-slate-200/80",
    blurFrame: "border-slate-300/80 bg-white/50 shadow-xl shadow-slate-300/30",
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeaderButton({
  icon: Icon,
  label,
  onClick,
  theme,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
  theme: ThemeClasses;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm transition-colors sm:h-11 sm:w-11 ${theme.headerBtn}`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </button>
  );
}

function TileText({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span title={title} className={`${TILE_TEXT} ${className}`}>
      {children}
    </span>
  );
}

function GridCell({
  surface,
  children,
  flip = false,
  flipDelay = 0,
  title,
}: {
  surface: string;
  children?: React.ReactNode;
  flip?: boolean;
  flipDelay?: number;
  title?: string;
}) {
  return (
    <div className="min-w-0 [perspective:800px]">
      <div
        title={title}
        className={`${CELL_SHELL} ${surface} ${flip ? "animate-flip" : ""}`}
        style={flip ? { animationDelay: `${flipDelay}ms` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function AttributeTile({
  state,
  children,
  empty = false,
  flip = false,
  flipDelay = 0,
  title,
  theme,
}: {
  state?: FeedbackState;
  children?: React.ReactNode;
  empty?: boolean;
  flip?: boolean;
  flipDelay?: number;
  title?: string;
  theme: ThemeClasses;
}) {
  const surface = empty
    ? theme.emptyTile
    : tileStateClasses(state ?? "wrong");

  return (
    <GridCell surface={surface} flip={flip} flipDelay={flipDelay} title={title}>
      <div className="flex w-full min-w-0 items-center justify-center px-0.5">
        {typeof children === "string" || typeof children === "number" ? (
          <TileText title={title}>{children}</TileText>
        ) : (
          children
        )}
      </div>
    </GridCell>
  );
}

function PlayerCard({
  player,
  empty = false,
  theme,
}: {
  player?: Player;
  empty?: boolean;
  theme: ThemeClasses;
}) {
  return (
    <div className="min-w-0">
      <div className={`${CELL_SHELL} border-transparent bg-transparent shadow-none`}>
        {empty ? (
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-transparent sm:h-8 sm:w-8 ${theme.playerAvatarBorderEmpty}`}
          >
            <User className={`h-3 w-3 ${theme.playerIconEmpty}`} />
          </div>
        ) : (
          <>
            <PlayerHeadshot espnId={player!.espnId} alt={player!.name} />
            <TileText
              title={player!.name}
              className={`mt-px normal-case text-[10px] sm:text-xs ${theme.playerName}`}
            >
              {player!.name}
            </TileText>
          </>
        )}
      </div>
    </div>
  );
}

function HintValue({
  value,
  hint,
}: {
  value: number;
  hint?: "up" | "down";
}) {
  const HintIcon = hint === "up" ? ArrowUp : ArrowDown;
  return (
    <span className="flex w-full min-w-0 items-center justify-center gap-px">
      <TileText>{value}</TileText>
      {hint && (
        <HintIcon
          className="h-4 w-4 shrink-0 opacity-90"
          strokeWidth={2.5}
        />
      )}
    </span>
  );
}

function CountryCell({ country }: { country: string }) {
  const label = `${getFlag(country)} ${getFifaCode(country)}`;
  return (
    <TileText title={country} className="text-center">
      {label}
    </TileText>
  );
}

function LeagueCell({ league }: { league: string }) {
  return (
    <>
      <TileText title={league} className="md:hidden">
        {formatLeague(league, true)}
      </TileText>
      <TileText title={league} className="hidden md:block">
        {formatLeague(league, false)}
      </TileText>
    </>
  );
}

function GuessRowView({
  row,
  isFresh,
  theme,
}: {
  row: GuessRow;
  isFresh: boolean;
  theme: ThemeClasses;
}) {
  const { player, comparison: c } = row;

  const attributes: {
    state: FeedbackState;
    content: React.ReactNode;
    title?: string;
  }[] = [
    {
      state: c.country,
      content: <CountryCell country={player.country} />,
      title: player.country,
    },
    {
      state: c.league,
      content: <LeagueCell league={player.league} />,
      title: player.league,
    },
    { state: c.position, content: player.position, title: player.position },
    {
      state: c.age,
      content: <HintValue value={player.age} hint={c.ageHint} />,
    },
    {
      state: c.shirtNumber,
      content: (
        <HintValue value={player.shirtNumber} hint={c.shirtNumberHint} />
      ),
    },
  ];

  return (
    <div className={ROW_GRID}>
      <PlayerCard player={player} theme={theme} />
      {attributes.map((attr, index) => (
        <AttributeTile
          key={ATTRIBUTE_HEADERS[index]}
          state={attr.state}
          flip={isFresh}
          flipDelay={(index + 1) * FLIP_STAGGER_MS}
          title={attr.title}
          theme={theme}
        >
          {attr.content}
        </AttributeTile>
      ))}
    </div>
  );
}

function EmptyRow({ theme }: { theme: ThemeClasses }) {
  return (
    <div className={ROW_GRID}>
      <PlayerCard empty theme={theme} />
      {ATTRIBUTE_HEADERS.map((header) => (
        <AttributeTile key={header} empty theme={theme} />
      ))}
    </div>
  );
}

function BlurGuessRowView({
  row,
  isFresh,
  theme,
}: {
  row: GuessRow;
  isFresh: boolean;
  theme: ThemeClasses;
}) {
  const { player, comparison: c } = row;

  const attributes: {
    state: FeedbackState;
    content: React.ReactNode;
    title?: string;
  }[] = [
    {
      state: c.country,
      content: <CountryCell country={player.country} />,
      title: player.country,
    },
    {
      state: c.confederation,
      content: player.confederation,
      title: player.confederation,
    },
    {
      state: c.league,
      content: <LeagueCell league={player.league} />,
      title: player.league,
    },
    { state: c.position, content: player.position, title: player.position },
    {
      state: combinedAgeNumberState(c),
      content: (
        <div className="flex flex-col items-center justify-center gap-0.5">
          <HintValue value={player.age} hint={c.ageHint} />
          <span className="flex w-full min-w-0 items-center justify-center gap-px text-sm font-bold sm:text-base">
            <TileText>#</TileText>
            <HintValue value={player.shirtNumber} hint={c.shirtNumberHint} />
          </span>
        </div>
      ),
      title: `Age ${player.age}, #${player.shirtNumber}`,
    },
  ];

  return (
    <div className={ROW_GRID}>
      <PlayerCard player={player} theme={theme} />
      {attributes.map((attr, index) => (
        <AttributeTile
          key={BLUR_COLUMN_HEADERS[index + 1]}
          state={attr.state}
          flip={isFresh}
          flipDelay={(index + 1) * FLIP_STAGGER_MS}
          title={attr.title}
          theme={theme}
        >
          {attr.content}
        </AttributeTile>
      ))}
    </div>
  );
}

function BlurEmptyRow({ theme }: { theme: ThemeClasses }) {
  return (
    <div className={ROW_GRID}>
      <PlayerCard empty theme={theme} />
      {BLUR_COLUMN_HEADERS.slice(1).map((header) => (
        <AttributeTile key={header} empty theme={theme} />
      ))}
    </div>
  );
}

function HelpModal({
  onClose,
  theme,
}: {
  onClose: () => void;
  theme: ThemeClasses;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-sm ${theme.helpBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className={`animate-fade-up w-full max-w-md rounded-lg border p-6 shadow-2xl sm:p-7 ${theme.helpPanel}`}
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" strokeWidth={2} />
          <h2 id="help-modal-title" className="text-lg font-bold sm:text-xl">
            How to Play
          </h2>
        </div>
        <ul className={`space-y-3 text-sm sm:text-base ${theme.helpBody}`}>
          <li>
            Guess the World Cup mystery player in{" "}
            <strong className="text-amber-400">{MAX_GUESSES} tries</strong>.
          </li>
          <li>
            <strong className="text-emerald-400">Green</strong> means an exact
            match on that attribute.
          </li>
          <li>
            <strong className="text-amber-400">Yellow</strong> on Country
            means the same confederation (e.g. both UEFA).
          </li>
          <li>
            <strong className="text-red-400">Red</strong> means a complete
            miss on that attribute.
          </li>
          <li>
            <strong>Arrows</strong> on Age and Shirt Number indicate whether
            the mystery value is higher or lower.
          </li>
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-sm bg-amber-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 sm:text-base"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SettingsMenu({
  isDarkMode,
  onSelectDark,
  onSelectLight,
  theme,
}: {
  isDarkMode: boolean;
  onSelectDark: () => void;
  onSelectLight: () => void;
  theme: ThemeClasses;
}) {
  return (
    <div
      className={`absolute right-0 top-[calc(100%+4px)] z-50 w-52 overflow-hidden rounded-sm border ${theme.settingsPanel}`}
      role="menu"
      aria-label="Settings"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onSelectLight}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors sm:px-4 sm:py-3 sm:text-base ${
          !isDarkMode ? theme.settingsItemActive : theme.settingsItem
        }`}
      >
        <Sun className="h-4 w-4 shrink-0" strokeWidth={2} />
        Light Theme
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onSelectDark}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors sm:px-4 sm:py-3 sm:text-base ${
          isDarkMode ? theme.settingsItemActive : theme.settingsItem
        }`}
      >
        <Moon className="h-4 w-4 shrink-0" strokeWidth={2} />
        Dark Theme
      </button>
    </div>
  );
}

function StatsDashboard({
  stats,
  theme,
}: {
  stats: GameStats;
  theme: ThemeClasses;
}) {
  const maxDist = Math.max(...stats.guessDistribution, 1);

  return (
    <div
      className={`mt-4 rounded-sm border p-3 text-left text-xs sm:text-sm ${theme.gameOverCard}`}
    >
      <p className={`mb-2 font-bold uppercase tracking-wide ${theme.gameOverSub}`}>
        Your Stats
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <span className={theme.gameOverSub}>Games Played</span>
        <span className="font-bold">{stats.totalGames}</span>
        <span className={theme.gameOverSub}>Win %</span>
        <span className="font-bold">{winPercentage(stats)}%</span>
        <span className={theme.gameOverSub}>Current Streak</span>
        <span className="font-bold">{stats.currentStreak}</span>
        <span className={theme.gameOverSub}>Max Streak</span>
        <span className="font-bold">{stats.maxStreak}</span>
      </div>
      <p className={`mb-1.5 mt-3 font-semibold ${theme.gameOverSub}`}>
        Guess Distribution
      </p>
      <div className="space-y-1">
        {stats.guessDistribution.map((count, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center font-bold">{i + 1}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-sm bg-slate-700/25">
              <div
                className="flex h-full min-w-[1.25rem] items-center justify-end rounded-sm bg-emerald-600 px-1 text-[10px] font-bold text-white"
                style={{
                  width: `${Math.max((count / maxDist) * 100, count > 0 ? 12 : 0)}%`,
                }}
              >
                {count > 0 ? count : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostGameModal({
  gameState,
  player,
  guessCount,
  stats,
  theme,
  isDarkMode,
  onPlayAgain,
}: {
  gameState: "WON" | "LOST";
  player: Player;
  guessCount: number;
  stats: GameStats;
  theme: ThemeClasses;
  isDarkMode: boolean;
  onPlayAgain: () => void;
}) {
  const titleClass = isDarkMode ? "text-white" : "text-slate-900";
  const nameClass =
    gameState === "WON"
      ? titleClass
      : isDarkMode
        ? "text-amber-400"
        : "text-amber-600";

  return (
    <div
      className={`animate-fade-up fixed inset-0 z-[60] flex items-center justify-center px-4 backdrop-blur-sm ${theme.gameOverBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="postgame-title"
    >
      <div
        className={`max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border p-6 text-center shadow-2xl sm:p-7 ${theme.gameOverPanel}`}
      >
        {gameState === "WON" ? (
          <p
            id="postgame-title"
            className={`text-lg font-bold sm:text-xl ${titleClass}`}
          >
            🎉 Splendid! You solved it in {guessCount}{" "}
            {guessCount === 1 ? "try" : "tries"}!
          </p>
        ) : (
          <>
            <Trophy
              className={`mx-auto h-8 w-8 ${theme.gameOverSub}`}
              strokeWidth={1.75}
            />
            <p
              id="postgame-title"
              className={`mt-3 text-base font-bold sm:text-lg ${titleClass}`}
            >
              Full time — the mystery player was:
            </p>
          </>
        )}

        <div
          className={`mx-auto mt-4 flex max-w-[260px] flex-col items-center rounded-sm border p-4 ${theme.gameOverCard}`}
        >
          <PlayerHeadshot espnId={player.espnId} alt={player.name} />
          <p className={`mt-2 truncate text-base font-bold sm:text-lg ${nameClass}`}>
            {player.name}
          </p>
          <p className={`mt-1 truncate text-sm ${theme.gameOverSub}`}>
            {formatCountry(player.country)} · {player.league}
            {gameState === "LOST" ? ` · ${player.position}` : ""}
          </p>
        </div>

        <StatsDashboard stats={stats} theme={theme} />

        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-5 w-full rounded-sm bg-amber-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-400 sm:text-base"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function ModePillSelector({
  gameMode,
  onChange,
  theme,
}: {
  gameMode: GameMode;
  onChange: (mode: GameMode) => void;
  theme: ThemeClasses;
}) {
  const items: {
    mode: GameMode;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = [
    { mode: "CLASSIC", label: "Classic", icon: Tv },
    { mode: "BLUR", label: "Blur", icon: EyeOff },
  ];

  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Game mode">
      {items.map(({ mode, label, icon: Icon }) => {
        const active = gameMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(mode)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              active ? theme.modePillActive : theme.modePillInactive
            }`}
          >
            <Icon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BlurMysteryFrame({
  player,
  guessCount,
  gameState,
  theme,
}: {
  player: Player;
  guessCount: number;
  gameState: GameState;
  theme: ThemeClasses;
}) {
  const blurPx = getBlurPx(guessCount, gameState);

  return (
    <div className="flex w-full shrink-0 flex-col items-center">
      <div
        className={`relative overflow-hidden rounded-xl border p-1 ${theme.blurFrame}`}
      >
        <img
          src={localFaceUrl(player.espnId)}
          alt="Mystery player"
          loading="eager"
          decoding="async"
          onError={handleLocalFaceError}
          style={{ filter: blurPx > 0 ? `blur(${blurPx}px)` : "blur(0px)" }}
          className="h-24 w-24 rounded-lg object-cover transition-[filter] duration-500 ease-out sm:h-28 sm:w-28"
        />
        {gameState === "PLAYING" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 text-center">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/90 sm:text-[10px]">
              Who is this?
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Worldcupdle() {
  const [mysteryPlayer, setMysteryPlayer] = useState<Player>(() =>
    pickRandomPlayer(ALL_PLAYERS),
  );
  const [gameMode, setGameMode] = useState<GameMode>("CLASSIC");
  const [gameState, setGameState] = useState<GameState>("PLAYING");
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [freshGuessId, setFreshGuessId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [stats, setStats] = useState<GameStats>(() => readStats());
  const [roundKey, setRoundKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);

  const guessedIds = useMemo(
    () => new Set(guesses.map((g) => g.player.id)),
    [guesses],
  );

  const guessCount = guesses.length;

  const isGameOver = gameState !== "PLAYING";
  const attemptsLeft = remainingAttempts(guessCount, gameState);

  const resetRound = useCallback((nextMode?: GameMode) => {
    setMysteryPlayer((current) => pickRandomPlayer(ALL_PLAYERS, current.id));
    setGameState("PLAYING");
    setGuesses([]);
    setInputValue("");
    setIsDropdownOpen(false);
    setHighlightedIndex(0);
    setFreshGuessId(null);
    setRoundKey((k) => k + 1);
    if (nextMode) setGameMode(nextMode);
  }, []);

  const handleModeChange = useCallback(
    (mode: GameMode) => {
      if (mode === gameMode) return;
      resetRound(mode);
    },
    [gameMode, resetRound],
  );

  const filteredPlayers = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return [];
    return ALL_PLAYERS.filter(
      (p) =>
        !guessedIds.has(p.id) &&
        (p.name.toLowerCase().includes(query) ||
          p.country.toLowerCase().includes(query) ||
          getFifaCode(p.country).toLowerCase().includes(query)),
    ).slice(0, 6);
  }, [inputValue, guessedIds]);

  const submitGuess = useCallback(
    (player: Player) => {
      if (gameState !== "PLAYING" || guessedIds.has(player.id)) return;

      const comparison = compareGuess(player, mysteryPlayer);
      setFreshGuessId(player.id);

      setGuesses((prev) => {
        const next = [...prev, { player, comparison }];
        const won = player.id === mysteryPlayer.id;
        const lost = !won && next.length >= MAX_GUESSES;

        if (won) {
          setGameState("WON");
          setStats(applyWinStats(next.length));
        } else if (lost) {
          setGameState("LOST");
          setStats(applyLossStats());
        }

        return next;
      });

      setInputValue("");
      setIsDropdownOpen(false);
      setHighlightedIndex(0);

      setTimeout(
        () => setFreshGuessId(null),
        (ATTRIBUTE_HEADERS.length + 1) * FLIP_STAGGER_MS + 600,
      );
    },
    [gameState, guessedIds, mysteryPlayer],
  );

  const handlePlayAgain = useCallback(() => {
    resetRound();
  }, [resetRound]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPlayers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }

      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettingsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowHelpModal(false);
        setShowSettingsMenu(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  function handleInputChange(value: string) {
    setInputValue(value);
    setIsDropdownOpen(value.trim().length > 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isDropdownOpen || filteredPlayers.length === 0) {
      if (e.key === "Enter" && filteredPlayers.length === 1) {
        submitGuess(filteredPlayers[0]);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) =>
          i < filteredPlayers.length - 1 ? i + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) =>
          i > 0 ? i - 1 : filteredPlayers.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        submitGuess(filteredPlayers[highlightedIndex]);
        break;
      case "Escape":
        setIsDropdownOpen(false);
        break;
    }
  }

  return (
    <div
      className={`relative flex h-screen max-h-screen select-none flex-col justify-between overflow-hidden pb-4 font-sans tracking-wide ${theme.rootText}`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${STADIUM_BG})` }}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none absolute inset-0 ${theme.overlay}`}
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className={`shrink-0 border-b ${theme.header}`}>
          <div
            className={`mx-auto w-full ${APP_CONTAINER} px-4 sm:px-5`}
          >
            <div className="grid grid-cols-[44px_1fr_44px] items-center py-1.5 sm:grid-cols-[48px_1fr_48px] sm:py-2">
              <div className="flex flex-col items-start gap-1.5">
                <HeaderButton
                  icon={HelpCircle}
                  label="How to Play"
                  theme={theme}
                  onClick={() => {
                    setShowHelpModal(true);
                    setShowSettingsMenu(false);
                  }}
                />
                <ModePillSelector
                  gameMode={gameMode}
                  onChange={handleModeChange}
                  theme={theme}
                />
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" strokeWidth={2} />
                  <h1
                    className={`text-sm font-bold tracking-[0.12em] sm:text-base md:text-lg ${theme.headerTitle}`}
                  >
                    WORLDCUPDLE
                  </h1>
                </div>
                <p
                  className={`text-[10px] font-medium uppercase tracking-widest sm:text-xs ${theme.headerSub}`}
                >
                  {formatDailyDate()} · WC 2026
                </p>
              </div>
              <div className="relative flex justify-end" ref={settingsRef}>
                <HeaderButton
                  icon={Settings}
                  label="Settings"
                  theme={theme}
                  onClick={() => {
                    setShowSettingsMenu((open) => !open);
                    setShowHelpModal(false);
                  }}
                />
                {showSettingsMenu && (
                  <SettingsMenu
                    isDarkMode={isDarkMode}
                    theme={theme}
                    onSelectLight={() => {
                      setIsDarkMode(false);
                      setShowSettingsMenu(false);
                    }}
                    onSelectDark={() => {
                      setIsDarkMode(true);
                      setShowSettingsMenu(false);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          className={`mx-auto flex min-h-0 w-full flex-1 flex-col overflow-hidden ${APP_CONTAINER} px-4 sm:px-5`}
        >
          <p
            className={`mb-1 shrink-0 text-center text-xs sm:text-sm ${theme.intro}`}
          >
            {gameMode === "BLUR" ? (
              <>
                Identify the blurred World Cup Star ·{" "}
                <span className="font-semibold text-amber-400">
                  {MAX_GUESSES} tries
                </span>
              </>
            ) : (
              <>
                To Guess a random World Cup Star ·{" "}
                <span className="font-semibold text-amber-400">
                  {MAX_GUESSES} tries
                </span>
              </>
            )}
          </p>

          <div className="relative z-50 mb-1 w-full shrink-0">
            <div className="relative">
              <Search
                className={`pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 sm:left-3 sm:h-5 sm:w-5 ${theme.searchIcon}`}
                strokeWidth={2}
              />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                disabled={isGameOver}
                placeholder={
                  isGameOver
                    ? gameState === "WON"
                      ? "Solved!"
                      : "Game over"
                    : "Search player..."
                }
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => inputValue.trim() && setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                className={`w-full rounded-sm border py-2 pl-8 pr-3 text-xs font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:py-2.5 sm:pl-10 sm:text-sm ${theme.input} ${theme.inputFocus}`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {isDropdownOpen && filteredPlayers.length > 0 && (
              <div
                ref={dropdownRef}
                className={`absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-40 overflow-y-auto rounded-sm border shadow-xl backdrop-blur-sm sm:max-h-52 ${theme.dropdown}`}
              >
                <ul role="listbox" aria-label="Player suggestions">
                  {filteredPlayers.map((player, index) => (
                    <li
                      key={player.id}
                      role="option"
                      aria-selected={index === highlightedIndex}
                    >
                      <button
                        type="button"
                        onClick={() => submitGuess(player)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors sm:gap-2.5 sm:px-3 sm:py-2.5 ${
                          index === highlightedIndex
                            ? theme.dropdownItemActive
                            : theme.dropdownItem
                        }`}
                      >
                        <PlayerHeadshot
                          espnId={player.espnId}
                          alt={player.name}
                          className="h-7 w-7 sm:h-8 sm:w-8"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium sm:text-sm">
                            {player.name}
                          </span>
                          <span
                            className={`block truncate text-[10px] sm:text-xs ${theme.dropdownSub}`}
                          >
                            {formatCountry(player.country)} · {player.league}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isDropdownOpen &&
              inputValue.trim() &&
              filteredPlayers.length === 0 && (
                <div
                  className={`absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-sm border px-3 py-2 text-xs sm:text-sm ${theme.dropdown} ${theme.dropdownSub}`}
                >
                  No matching players
                </div>
              )}
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-hidden">
            <p
              className={`shrink-0 text-center text-[10px] font-semibold uppercase tracking-widest sm:text-xs ${theme.attempts}`}
            >
              {isGameOver
                ? gameState === "WON"
                  ? `Solved in ${guessCount} of ${MAX_GUESSES}`
                  : `All ${MAX_GUESSES} attempts used`
                : `${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} remaining`}
            </p>

            {gameMode === "BLUR" && (
              <BlurMysteryFrame
                player={mysteryPlayer}
                guessCount={guessCount}
                gameState={gameState}
                theme={theme}
              />
            )}

            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
              <div className={ROW_GRID}>
                {(gameMode === "BLUR" ? BLUR_COLUMN_HEADERS : COLUMN_HEADERS).map(
                  (header) => (
                    <div
                      key={header}
                      className={`flex min-w-0 items-end justify-center truncate pb-0.5 text-[9px] font-bold uppercase tracking-wide sm:text-[10px] ${theme.columnHeader}`}
                    >
                      {header}
                    </div>
                  ),
                )}
              </div>

              <div className={`mt-0.5 min-h-0 flex-1 ${ROW_STACK}`} key={roundKey}>
                {Array.from({ length: MAX_GUESSES }, (_, i) => {
                  const row = guesses[i];
                  if (row) {
                    return gameMode === "BLUR" ? (
                      <BlurGuessRowView
                        key={`${roundKey}-${row.player.id}`}
                        row={row}
                        isFresh={freshGuessId === row.player.id}
                        theme={theme}
                      />
                    ) : (
                      <GuessRowView
                        key={`${roundKey}-${row.player.id}`}
                        row={row}
                        isFresh={freshGuessId === row.player.id}
                        theme={theme}
                      />
                    );
                  }
                  return gameMode === "BLUR" ? (
                    <BlurEmptyRow
                      key={`${roundKey}-blur-empty-${i}`}
                      theme={theme}
                    />
                  ) : (
                    <EmptyRow key={`${roundKey}-empty-${i}`} theme={theme} />
                  );
                })}
              </div>
            </div>

            <div
              className={`flex shrink-0 items-center justify-center gap-3 text-[10px] sm:gap-4 sm:text-xs ${theme.legend}`}
            >
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600 sm:h-3 sm:w-3" />
                Correct
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 sm:h-3 sm:w-3" />
                Region/Partial
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-red-600 sm:h-3 sm:w-3" />
                Miss
              </span>
            </div>
          </div>
        </main>
      </div>

      {showHelpModal && (
        <HelpModal theme={theme} onClose={() => setShowHelpModal(false)} />
      )}

      {gameState !== "PLAYING" && (
        <PostGameModal
          gameState={gameState}
          player={mysteryPlayer}
          guessCount={guessCount}
          stats={stats}
          theme={theme}
          isDarkMode={isDarkMode}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}

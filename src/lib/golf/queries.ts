import { cache } from "react";
import { loadDataset } from "./load";
import type {
  Course,
  CourseTee,
  Dataset,
  Player,
  Round,
  School,
  Tournament,
  TournamentResult,
} from "./types";

// Views over the whole dataset. It is small (a few thousand results) and only read at build time,
// so the joins happen in memory rather than as SQL.

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id, row]));

const groupBy = <T, K>(rows: T[], key: (row: T) => K) => {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row);
    else groups.set(k, [row]);
  }
  return groups;
};

const indexes = cache(async () => {
  const data: Dataset = await loadDataset();
  return {
    data,
    schools: byId(data.schools),
    players: byId(data.players),
    courses: byId(data.courses),
    tees: byId(data.course_tees),
    tournaments: byId(data.tournaments),
    resultsByPlayer: groupBy(data.tournament_results, (r) => r.player_id),
    resultsByTournament: groupBy(data.tournament_results, (r) => r.tournament_id),
    roundsByResult: groupBy(data.rounds, (r) => r.result_id),
  };
});

export type PlayerStats = {
  events: number;
  wins: number;
  topTens: number;
  bestFinish: TournamentResult | null;
  /** Mean of 18-hole rounds only; 9-hole rounds would skew it. */
  scoringAverage: number | null;
  rounds18: number;
  lowRound: number | null;
  /** Mean WHS score differential over rounds whose tee has a rating and slope. */
  averageDifferential: number | null;
  ratedRounds: number;
};

function playerStats(results: TournamentResult[], rounds: Round[]): PlayerStats {
  const finished = results.filter((r) => r.status === "finished" && r.position != null);
  const bestFinish =
    finished.toSorted((a, b) => a.position! - b.position! || Number(a.tied) - Number(b.tied))[0] ??
    null;
  const scores18 = rounds.filter((r) => r.holes === 18 && r.score != null).map((r) => r.score!);
  const differentials = rounds
    .filter((r) => r.score_differential != null)
    .map((r) => r.score_differential!);
  return {
    events: results.length,
    wins: finished.filter((r) => r.position === 1).length,
    topTens: finished.filter((r) => r.position! <= 10).length,
    bestFinish,
    scoringAverage: mean(scores18),
    rounds18: scores18.length,
    lowRound: scores18.length ? Math.min(...scores18) : null,
    averageDifferential: mean(differentials),
    ratedRounds: differentials.length,
  };
}

export type PlayerSummary = {
  player: Player;
  school: School | null;
  stats: PlayerStats;
};

export const listPlayers = cache(async (): Promise<PlayerSummary[]> => {
  const ix = await indexes();
  return ix.data.players.map((player) => {
    const results = ix.resultsByPlayer.get(player.id) ?? [];
    const rounds = results.flatMap((r) => ix.roundsByResult.get(r.id) ?? []);
    return {
      player,
      school: player.school_id ? (ix.schools.get(player.school_id) ?? null) : null,
      stats: playerStats(results, rounds),
    };
  });
});

export type RoundDetail = Round & { tee: CourseTee | null };

export type PlayerResult = {
  result: TournamentResult;
  tournament: Tournament;
  course: Course | null;
  rounds: RoundDetail[];
};

export async function getPlayer(id: string) {
  const ix = await indexes();
  const player = ix.players.get(id);
  if (!player) return null;
  const results = ix.resultsByPlayer.get(id) ?? [];
  const history: PlayerResult[] = results
    .map((result) => {
      const tournament = ix.tournaments.get(result.tournament_id)!;
      return {
        result,
        tournament,
        course: tournament.course_id ? (ix.courses.get(tournament.course_id) ?? null) : null,
        rounds: (ix.roundsByResult.get(result.id) ?? [])
          .toSorted((a, b) => a.round_number - b.round_number)
          .map((round) => ({
            ...round,
            tee: round.course_tee_id ? (ix.tees.get(round.course_tee_id) ?? null) : null,
          })),
      };
    })
    .toSorted((a, b) => b.tournament.start_date.localeCompare(a.tournament.start_date));
  return {
    player,
    school: player.school_id ? (ix.schools.get(player.school_id) ?? null) : null,
    stats: playerStats(
      results,
      history.flatMap((h) => h.rounds),
    ),
    history,
  };
}

export type TournamentSummary = {
  tournament: Tournament;
  course: Course | null;
  winners: Player[];
};

export const listTournaments = cache(async (): Promise<TournamentSummary[]> => {
  const ix = await indexes();
  return ix.data.tournaments
    .map((tournament) => ({
      tournament,
      course: tournament.course_id ? (ix.courses.get(tournament.course_id) ?? null) : null,
      winners: (ix.resultsByTournament.get(tournament.id) ?? [])
        .filter((r) => r.status === "finished" && r.position === 1)
        .map((r) => ix.players.get(r.player_id)!),
    }))
    .toSorted(
      (a, b) =>
        b.tournament.start_date.localeCompare(a.tournament.start_date) ||
        (a.tournament.name_en ?? "").localeCompare(b.tournament.name_en ?? ""),
    );
});

const statusOrder = { finished: 0, cut: 1, wd: 2, dq: 3 } as const;

export type LeaderboardRow = {
  result: TournamentResult;
  player: Player;
  school: School | null;
  rounds: Round[];
};

export type RoundConditions = {
  roundNumber: number;
  playedOn: string | null;
  holes: number;
  weather: string | null;
  weatherEn: string | null;
  temperatureC: number | null;
  windSpeedMs: number | null;
  precipitationMm: number | null;
  averageScore: number | null;
};

export async function getTournament(id: string) {
  const ix = await indexes();
  const tournament = ix.tournaments.get(id);
  if (!tournament) return null;

  const leaderboard: LeaderboardRow[] = (ix.resultsByTournament.get(id) ?? [])
    .map((result) => {
      const player = ix.players.get(result.player_id)!;
      return {
        result,
        player,
        school: player.school_id ? (ix.schools.get(player.school_id) ?? null) : null,
        rounds: (ix.roundsByResult.get(result.id) ?? []).toSorted(
          (a, b) => a.round_number - b.round_number,
        ),
      };
    })
    .toSorted(
      (a, b) =>
        statusOrder[a.result.status] - statusOrder[b.result.status] ||
        (a.result.position ?? Infinity) - (b.result.position ?? Infinity) ||
        (a.result.total_score ?? Infinity) - (b.result.total_score ?? Infinity) ||
        (a.player.name_en ?? "").localeCompare(b.player.name_en ?? ""),
    );

  const allRounds = leaderboard.flatMap((row) => row.rounds);
  const roundNumbers = [...new Set(allRounds.map((r) => r.round_number))].toSorted((a, b) => a - b);
  const conditions: RoundConditions[] = roundNumbers.map((n) => {
    const rounds = allRounds.filter((r) => r.round_number === n);
    const first = rounds.find((r) => r.played_on) ?? rounds[0];
    const scores = rounds.filter((r) => r.score != null).map((r) => r.score!);
    return {
      roundNumber: n,
      playedOn: first.played_on,
      holes: first.holes,
      weather: first.weather,
      weatherEn: first.weather_en,
      temperatureC: first.temperature_c,
      windSpeedMs: first.wind_speed_ms,
      precipitationMm: first.precipitation_mm,
      averageScore: mean(scores),
    };
  });

  const teeIds = new Set(allRounds.map((r) => r.course_tee_id).filter((t) => t != null));
  const tees = [...teeIds].map((teeId) => ix.tees.get(teeId)).filter((t) => t != null);

  return {
    tournament,
    course: tournament.course_id ? (ix.courses.get(tournament.course_id) ?? null) : null,
    tees,
    leaderboard,
    roundNumbers,
    conditions,
  };
}

export async function playerIds() {
  return (await indexes()).data.players.map((p) => p.id);
}

export async function tournamentIds() {
  return (await indexes()).data.tournaments.map((t) => t.id);
}

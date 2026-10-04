// Row shapes of the Supabase tables (supabase/migrations). src/data/seed.json uses the same shapes.

export type Gender = "male" | "female";

export type School = {
  id: string;
  name_ja: string;
  name_en: string | null;
  prefecture: string;
};

export type Player = {
  id: string;
  school_id: string | null;
  name_ja: string;
  name_kana: string | null;
  name_en: string | null;
  gender: Gender;
  graduation_year: number | null;
  prefecture: string | null;
};

export type Course = {
  id: string;
  name_ja: string;
  name_en: string | null;
  prefecture: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type CourseTee = {
  id: string;
  course_id: string;
  tee_name: string;
  gender: Gender;
  par: number;
  yardage: number | null;
  course_rating: number | null;
  slope_rating: number | null;
};

export type Tournament = {
  id: string;
  name_ja: string;
  name_en: string | null;
  organizer: string | null;
  level: string | null;
  gender: Gender | "mixed" | null;
  course_id: string | null;
  start_date: string;
  end_date: string | null;
  field_size: number | null;
  winning_score: number | null;
  source_url: string | null;
};

export type ResultStatus = "finished" | "cut" | "wd" | "dq";

export type TournamentResult = {
  id: string;
  tournament_id: string;
  player_id: string;
  position: number | null;
  tied: boolean;
  total_score: number | null;
  to_par: number | null;
  rank_percentile: number | null;
  status: ResultStatus;
};

export type Round = {
  id: string;
  result_id: string;
  round_number: number;
  played_on: string | null;
  course_tee_id: string | null;
  score: number | null;
  holes: number;
  score_differential: number | null;
  weather: string | null;
  weather_en: string | null;
  temperature_c: number | null;
  wind_speed_ms: number | null;
  precipitation_mm: number | null;
};

export type Dataset = {
  schools: School[];
  players: Player[];
  courses: Course[];
  course_tees: CourseTee[];
  tournaments: Tournament[];
  tournament_results: TournamentResult[];
  rounds: Round[];
};

// Row shapes of the account tables (supabase/migrations/0004_accounts.sql, 0006_name_kana.sql).

export type Role = "student" | "parent" | "coach" | "hs_coach";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  name_kana: string | null;
  locale: "en" | "ja";
};

export type StudentProfile = {
  user_id: string;
  name_ja: string | null;
  name_en: string | null;
  name_kana: string | null;
  birth_date: string | null;
  graduation_year: number | null;
  gender: "male" | "female" | null;
  school_name: string | null;
  prefecture: string | null;
  bio: string | null;
  gpa_jp: number | null;
  gpa_us: number | null;
  intended_major: string | null;
  ncaa_eligibility_id: string | null;
  handicap: number | null;
  video_url: string | null;
  parent_invite_code: string;
  visible_to_coaches: boolean;
};

export type CoachProfile = {
  user_id: string;
  college_name: string | null;
  title: string | null;
  verification_status: "pending" | "verified" | "rejected";
};

export type TestName = "toefl_ibt" | "ielts" | "duolingo" | "eiken" | "toeic" | "sat" | "act";

export type TestScore = {
  id: string;
  student_id: string;
  test: TestName;
  score: string;
  taken_on: string | null;
};

export type PlayerClaim = {
  id: string;
  student_id: string;
  player_id: string;
  status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
};

export type ResultRequest = {
  id: string;
  student_id: string;
  tournament_name: string;
  start_date: string | null;
  position: string | null;
  scores: string | null;
  status: "pending" | "added" | "rejected";
  reviewer_note: string | null;
};

export type TargetStatus = "interested" | "contacted" | "applied" | "offer" | "committed" | "dropped";

export type TargetCollege = {
  id: string;
  student_id: string;
  college_name: string;
  status: TargetStatus;
  note: string | null;
};

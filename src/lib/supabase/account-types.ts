// Row shapes of the account tables (supabase/migrations/0004_accounts.sql, 0006_name_kana.sql,
// 0007_identity_checks.sql, 0008_student_recruiting_fields.sql).

export type Role = "student" | "parent" | "coach" | "hs_coach";

export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  name_kana: string | null;
  locale: "en" | "ja";
};

export type Division = "d1" | "d2" | "d3" | "naia" | "njcaa";
export type NcaaStatus = "not_registered" | "registered" | "certified";

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
  // Added in 0008_student_recruiting_fields.sql
  family_name_ja: string | null;
  given_name_ja: string | null;
  family_name_kana: string | null;
  given_name_kana: string | null;
  family_name_en: string | null;
  given_name_en: string | null;
  hometown: string | null;
  height_cm: number | null;
  handedness: "right" | "left" | null;
  class_rank: number | null;
  class_size: number | null;
  ncaa_status: NcaaStatus | null;
  entry_year: number | null;
  target_divisions: Division[];
  scoring_average: number | null;
  scoring_rounds: number | null;
  best_18: number | null;
  best_18_event: string | null;
  driving_distance_yd: number | null;
  wagr_rank: number | null;
  home_course: string | null;
  ranking_url: string | null;
  coach_name: string | null;
  coach_contact: string | null;
  parent_invite_code: string;
  visible_to_coaches: boolean;
};

export type CoachProfile = {
  user_id: string;
  college_name: string | null;
  title: string | null;
  verification_status: "pending" | "verified" | "rejected";
  verification_method: "staff_list" | "staff_review" | "team_invite" | null;
  invited_by: string | null;
};

export type TeamInvite = {
  id: string;
  email: string;
  accepted_by: string | null;
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
  evidence_url: string | null;
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

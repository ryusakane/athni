// Shapes of src/data/colleges.json (written by data/scripts/build_colleges.py).
// Same columns as the college_* tables in supabase/migrations/0003_colleges.sql, nested per college.

export type Division = "D1" | "D2" | "D3" | "NAIA" | "NJCAA";
export type ProgramGender = "male" | "female";
export type ClassYear = "FR" | "SO" | "JR" | "SR" | "GR";

export type Ranking = {
  source: string;
  rank: number;
  as_of: string;
  source_url: string | null;
};

export type Coach = {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  source_url: string | null;
};

export type RosterPlayer = {
  name: string;
  class_year: ClassYear | null;
  redshirt: boolean;
  hometown: string | null;
  country: string | null;
  previous_school: string | null;
};

export type AlumniPro = {
  name: string;
  tours: string[];
  final_college_year: number | null;
  country: string | null;
  source_url: string | null;
};

export type Social = {
  instagram_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
};

export type Program = Social & {
  gender: ProgramGender;
  golf_url: string | null;
  roster_url: string | null;
  coaches_url: string | null;
  roster_season: string | null;
  roster_source_url: string | null;
  collected_at: string | null;
  /** Why roster/coaches are missing, e.g. the athletics site blocks automated access. */
  collection_note: string | null;
  rankings: Ranking[];
  coaches: Coach[];
  roster: RosterPlayer[];
  alumni_pros: AlumniPro[];
};

export type College = {
  slug: string;
  name_en: string;
  name_ja: string | null;
  short_name: string | null;
  nickname: string | null;
  division: Division;
  conference: string | null;
  city: string | null;
  state: string | null;
  website_url: string | null;
  athletics_url: string | null;
  programs: Program[];
};

export type CollegeDataset = {
  generated_at: string;
  colleges: College[];
};

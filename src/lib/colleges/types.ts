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
  /** The coach's own bio page on the athletics site, when collected. */
  profile_url?: string | null;
  source_url: string | null;
};

export type RosterPlayer = {
  name: string;
  class_year: ClassYear | null;
  redshirt: boolean;
  hometown: string | null;
  country: string | null;
  previous_school: string | null;
  major?: string | null;
  /** The player's own bio page on the athletics site, when collected. */
  profile_url?: string | null;
};

/** A link to a player's profile on a professional tour's official site (links only, no results). */
export type TourLink = { tour: string; url: string };

/** How a former player's time on the team ended, estimated from the season rosters. */
export type CareerStatus = "graduated" | "transferred" | "left";

/** A player on a past-season roster (2016-17 onward) who is no longer on the team. */
export type FormerPlayer = {
  name: string;
  /** Seasons on the roster, oldest first, e.g. ["2016-17", "2017-18"]. */
  seasons: string[];
  /** Class in the last season listed. */
  class_year: ClassYear | null;
  major: string | null;
  hometown: string | null;
  country: string | null;
  previous_school: string | null;
  profile_url: string | null;
  source_url: string | null;
  career_status: CareerStatus;
  /** Slug of the D1 college whose roster they appear on next. */
  transferred_to: string | null;
  tour_links: TourLink[];
};

/** A coach on a past-season roster who is no longer on the staff. */
export type PastCoach = {
  name: string;
  title: string | null;
  seasons: string[];
  profile_url: string | null;
  source_url: string | null;
};

export type AlumniPro = {
  name: string;
  tours: string[];
  final_college_year: number | null;
  country: string | null;
  source_url: string | null;
  tour_links: TourLink[];
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
  /** Why roster/coaches are missing. Internal only: not shown on the site. */
  collection_note: string | null;
  rankings: Ranking[];
  coaches: Coach[];
  roster: RosterPlayer[];
  alumni_pros: AlumniPro[];
  former_players: FormerPlayer[];
  past_coaches: PastCoach[];
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

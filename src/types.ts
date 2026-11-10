import type { JobKeywordPresetId } from "./directoryJobBoards";

export type ApplicationStatus =
  | "Saved"
  | "Preparing"
  | "Applied"
  | "Interviewing"
  | "Offer"
  | "Closed";

export interface Profile {
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  skills: string;
  highlights: string;
}

export interface MatchFactor {
  label: string;
  score: number;
  detail: string;
}

export interface Job {
  id: string;
  sourceId?: string;
  source?: string;
  sourceUrl?: string;
  title: string;
  company: string;
  url: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description: string;
  status: ApplicationStatus;
  notes: string;
  followUp: string;
  draft: string;
  createdAt: string;
  updatedAt: string;
}

export type JobLevel = "" | "Junior" | "Senior" | "Principal" | "custom";

export interface SearchDefault {
  keyword: string;
  companyBoardKeys?: string[];
  jobLevel: JobLevel;
  customJobLevel: string;
}

export interface SavedJobSearch {
  id: string;
  name: string;
  presetId: JobKeywordPresetId | "custom";
  keyword: string;
  jobLevel: JobLevel;
  customJobLevel: string;
  filters: {
    company: string;
    location: string;
    locationMode: "preferred" | "anywhere" | "custom";
    workArrangement: "any" | "remote" | "hybrid" | "onsite";
    datePosted: "any" | "24h" | "7d" | "30d";
    minimumSalary: number | null;
    maximumSalary: number | null;
    includeUndisclosedSalary: boolean;
    maximumExperienceYears: number | null;
  };
  sort: "relevance" | "newest" | "salary-high" | "salary-low" | "company";
  companyBoardKeys: string[];
  createdAt: string;
}

export interface LocalData {
  profile: Profile;
  jobs: Job[];
  profileReady: boolean;
  searchDefaults: Record<string, SearchDefault>;
  savedSearches: SavedJobSearch[];
}

export const emptyProfile: Profile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  headline: "",
  skills: "",
  highlights: "",
};

export const defaultData: LocalData = {
  profile: emptyProfile,
  jobs: [],
  profileReady: false,
  searchDefaults: {},
  savedSearches: [],
};

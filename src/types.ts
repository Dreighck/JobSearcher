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

export interface LocalData {
  profile: Profile;
  jobs: Job[];
  profileReady: boolean;
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
};

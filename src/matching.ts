import type { Job, MatchFactor, Profile } from "./types";
import { salaryFromDescription } from "./jobFeeds";

const preferredSkills = (profile: Profile) =>
  profile.skills
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);

export function getMatch(job: Job, profile: Profile): { score: number; factors: MatchFactor[] } {
  const titleAndText = `${job.title} ${job.description}`.toLowerCase();
  const description = job.description.toLowerCase();
  const roleScore = /software engineer|software developer|developer|engineer/.test(titleAndText) ? 100 : 35;
  const skills = preferredSkills(profile);
  const matches = skills.filter((skill) => description.includes(skill.toLowerCase()));
  const skillScore = skills.length ? Math.round((matches.length / skills.length) * 100) : 0;
  const locationText = `${job.location ?? ""} ${job.description}`.toLowerCase();
  const remoteOrLocal = /remote|lafayette(?:,?\s*la|ouisiana)?/.test(locationText);
  const locationScore = remoteOrLocal ? 100 : /hybrid/.test(description) ? 55 : 25;
  const salaryMin = job.salaryMin ?? salaryFromDescription(job.description)?.min ?? null;
  const salaryScore = salaryMin !== null && salaryMin >= 140000 ? 100 : 0;

  const factors: MatchFactor[] = [
    {
      label: "Role fit",
      score: roleScore,
      detail: roleScore === 100 ? "Software engineering is prioritized." : "This title may be outside your preferred role.",
    },
    {
      label: "Skills overlap",
      score: skillScore,
      detail: skills.length
        ? `${matches.length} of ${skills.length} profile skills found${matches.length ? `: ${matches.join(", ")}` : "."}`
        : "Add skills to your profile to personalize this factor.",
    },
    {
      label: "Location",
      score: locationScore,
      detail: remoteOrLocal ? "Remote or Lafayette, Louisiana is mentioned." : "Remote/Lafayette preference is not explicit.",
    },
    {
      label: "Salary preference",
      score: salaryScore,
      detail: salaryMin === null
        ? "Salary is undisclosed; this role is shown separately and is not confirmed to meet the $140k minimum."
        : salaryMin >= 140000
          ? "The published salary minimum meets your $140k floor."
          : "The published salary minimum is below your $140k floor.",
    },
  ];
  const score = Math.round(
    roleScore * 0.35 + skillScore * 0.35 + locationScore * 0.2 + salaryScore * 0.1,
  );
  return { score, factors };
}

import type { Job, Profile } from "./types";

export function createDraft(profile: Profile, job: Job): string {
  const role = job.title || "the position";
  const name = profile.name || "Your Name";
  const skills = profile.skills
    .split(/[,;\n]/)
    .map((skill) => skill.trim())
    .filter((skill) => skill && job.description.toLowerCase().includes(skill.toLowerCase()))
    .slice(0, 3);
  const highlights = profile.highlights.trim();
  const company = job.company || "your team";
  return `Dear ${company} Hiring Team,\n\nI’m writing to express my interest in the ${role} role${job.company ? ` at ${job.company}` : ""}. ${
    profile.headline ? profile.headline.trim().replace(/[.!?]$/, "") + "." : "My experience has prepared me to contribute thoughtfully and deliver reliable results."
  }\n\n${skills.length ? `The role’s focus on ${skills.join(", ")} stood out to me. ` : ""}${
    highlights ? highlights : "I bring a practical, collaborative approach to solving problems and building useful software."
  }\n\nI’d welcome the opportunity to discuss how my experience could support ${company}. Thank you for your time and consideration.\n\nSincerely,\n${name}`;
}

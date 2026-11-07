const profileFields = ["name", "email", "phone", "location"];

export function normalizeProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The selected file must contain a profile object.");
  }

  const profile = Object.fromEntries(profileFields.map((field) => {
    const fieldValue = value[field];
    if (fieldValue !== undefined && typeof fieldValue !== "string") {
      throw new Error(`The profile field "${field}" must be text.`);
    }
    return [field, (fieldValue ?? "").trim().slice(0, 300)];
  }));

  if (!profileFields.some((field) => profile[field])) {
    throw new Error("The profile file does not contain name, email, phone, or location details.");
  }
  return profile;
}

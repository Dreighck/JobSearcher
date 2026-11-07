import { describe, expect, it } from "vitest";
import { normalizeProfile } from "./profile.js";

describe("extension profile import", () => {
  it("keeps only supported text fields", () => {
    expect(normalizeProfile({
      name: " Jordan Example ",
      email: " jordan@example.test ",
      phone: "555-0101",
      location: "Lafayette, Louisiana",
      extra: "ignored",
    })).toEqual({
      name: "Jordan Example",
      email: "jordan@example.test",
      phone: "555-0101",
      location: "Lafayette, Louisiana",
    });
  });

  it("rejects empty or non-text profiles", () => {
    expect(() => normalizeProfile({})).toThrow("does not contain");
    expect(() => normalizeProfile({ name: 7 })).toThrow('field "name" must be text');
  });
});

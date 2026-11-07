import { afterEach, describe, expect, it, vi } from "vitest";
import { autofillSupportedFields } from "./autofill.js";

class InputBase {
  get value() { return this._value ?? ""; }
  set value(value) { this._value = value; }
}

class TestInput extends InputBase {
  constructor({ value = "", id = "", type = "text", ...attributes } = {}) {
    super();
    this.value = value;
    this.id = id;
    this.disabled = false;
    this.readOnly = false;
    this.attributes = { type, ...attributes };
    this.events = [];
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  getClientRects() {
    return [1];
  }

  closest() {
    return null;
  }

  dispatchEvent(event) {
    this.events.push(event.type);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("user-invoked application autofill", () => {
  it("fills blank supported fields without changing populated fields or screening answers", () => {
    const name = new TestInput({ "aria-label": "Full name" });
    const existingEmail = new TestInput({ value: "already@example.test", type: "email", name: "email" });
    const phone = new TestInput({ autocomplete: "tel" });
    const location = new TestInput({ placeholder: "Current location" });
    const screeningAnswer = new TestInput({ name: "desired_salary" });
    const password = new TestInput({ type: "password", name: "password" });
    const fields = [name, existingEmail, phone, location, screeningAnswer, password];
    vi.stubGlobal("location", { hostname: "www.linkedin.com" });
    vi.stubGlobal("HTMLInputElement", InputBase);
    vi.stubGlobal("document", {
      querySelectorAll: (selector) => selector === "input" ? fields : [],
    });

    const result = autofillSupportedFields({
      name: "Jordan Example",
      email: "jordan@example.test",
      phone: "555-0101",
      location: "Lafayette, Louisiana",
    });

    expect(result.filled).toBe(3);
    expect(name.value).toBe("Jordan Example");
    expect(existingEmail.value).toBe("already@example.test");
    expect(phone.value).toBe("555-0101");
    expect(location.value).toBe("Lafayette, Louisiana");
    expect(screeningAnswer.value).toBe("");
    expect(password.value).toBe("");
    expect(name.events).toEqual(["input", "change"]);
  });

  it("does not run on other sites", () => {
    vi.stubGlobal("location", { hostname: "example.test" });
    vi.stubGlobal("document", { querySelectorAll: () => [] });

    expect(autofillSupportedFields({ name: "Jordan Example" })).toEqual({
      filled: 0,
      reason: "Open a LinkedIn or Indeed page first.",
    });
  });
});

export function autofillSupportedFields(profile) {
  const host = location.hostname.toLowerCase();
  const supportedSite = ["linkedin.com", "indeed.com"].some((domain) =>
    host === domain || host.endsWith(`.${domain}`),
  );
  if (!supportedSite) return { filled: 0, reason: "Open a LinkedIn or Indeed page first." };

  const nameParts = (profile.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  let filled = 0;

  const fields = Array.from(document.querySelectorAll("input")).filter((field) => {
    const type = (field.getAttribute("type") || "text").toLowerCase();
    return !field.disabled && !field.readOnly &&
      ["text", "email", "tel"].includes(type) &&
      field.getClientRects().length > 0;
  });

  for (const field of fields) {
    if (field.value.trim()) continue;

    const linkedLabel = Array.from(document.querySelectorAll("label[for]"))
      .find((label) => label.htmlFor === field.id)?.textContent || "";
    const wrappingLabel = field.closest("label")?.textContent || "";
    const hints = [
      field.getAttribute("autocomplete"),
      field.getAttribute("aria-label"),
      field.getAttribute("name"),
      field.id,
      field.getAttribute("placeholder"),
      linkedLabel,
      wrappingLabel,
    ].filter(Boolean).join(" ").toLowerCase();

    if (/password|resume|cover.?letter|address|street|postal|zip|desired|preferred|job.?location|work.?location/.test(hints)) continue;

    let value = "";
    if (/email|e-mail/.test(hints)) value = profile.email || "";
    else if (/phone|mobile|telephone|\btel\b/.test(hints)) value = profile.phone || "";
    else if (/given-name|first.?name/.test(hints)) value = firstName;
    else if (/family-name|last.?name|surname/.test(hints)) value = lastName;
    else if (/full.?name|your.?name|(^|[\s._-])name($|[\s._-])/.test(hints)) value = profile.name || "";
    else if (/city|current.?location|(^|[\s._-])location($|[\s._-])/.test(hints)) value = profile.location || "";
    if (!value) continue;

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) continue;
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    filled += 1;
  }

  return { filled, reason: filled ? "" : "No supported empty fields were found. Existing fields were left unchanged." };
}

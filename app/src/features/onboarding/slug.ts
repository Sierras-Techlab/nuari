export function generateSlug(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 63 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !["api", "app", "login", "register", "onboarding", "admin", "www", "support", "nuari"].includes(slug);
}

export function isValidIdentity(name: string, slug: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 100 && isValidSlug(slug);
}

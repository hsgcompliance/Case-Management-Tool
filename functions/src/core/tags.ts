//Depreciated - Tags just arent necessary for our system
// functions/src/core/tags.ts
export type Taggable = Record<string, unknown>;

export function buildClientTags(c: Taggable) {
  const t = new Set<string>();
  if (c.enrolled) t.add("enrolled");
  if (c.status) t.add(`status:${String(c.status).toLowerCase()}`);
  if (c.city) t.add(`city:${String(c.city).toLowerCase()}`);
  if (c.caseManagerId) t.add(`cm:${c.caseManagerId}`);
  if (Array.isArray(c.programs)) for (const p of c.programs) t.add(`prog:${String(p).toLowerCase()}`);
  return Array.from(t).sort();
}

export function buildGrantTags(g: Taggable) {
  const t = new Set<string>();
  if (g.active === false) t.add("inactive");
  if (g.funder) t.add(`funder:${String(g.funder).toLowerCase()}`);
  if (g.fy) t.add(`fy:${String(g.fy)}`);
  return Array.from(t).sort();
}

export function buildPaymentTags(p: Taggable) {
  const t = new Set<string>();
  if (p.status) t.add(`status:${String(p.status).toLowerCase()}`);
  if (p.type) t.add(`type:${String(p.type).toLowerCase()}`);
  if (p.monthKey) t.add(`mo:${p.monthKey}`);
  if (p.grantId) t.add(`grant:${p.grantId}`);
  if (p.clientId) t.add(`client:${p.clientId}`);
  return Array.from(t).sort();
}

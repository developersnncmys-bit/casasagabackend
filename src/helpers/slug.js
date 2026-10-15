const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A slug not yet used by `Model` — "tulum", then "tulum-2", "tulum-3"… */
async function uniqueSlug(Model, value, fallback) {
  const base = slugify(value) || fallback;
  let id = base;
  for (let n = 2; await Model.exists({ _id: id }); n++) id = `${base}-${n}`;
  return id;
}

module.exports = { slugify, uniqueSlug };

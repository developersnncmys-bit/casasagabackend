/**
 * Every model is sent to clients with `id` instead of `_id` and without `__v`,
 * so the panel and the website see the same shape as the old data.js.
 */
module.exports = function toJSON(schema, hidden = []) {
  const transform = (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    hidden.forEach((k) => delete ret[k]);
    return ret;
  };
  schema.set('toJSON', { virtuals: false, transform });
  schema.set('toObject', { virtuals: false, transform });
};

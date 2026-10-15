const ApiError = require('./ApiError');
const catchAsync = require('./catchAsync');

// Fields clients may send back but must never overwrite
const PROTECTED = ['_id', 'id', '__v', 'createdAt', 'updatedAt'];
const clean = (body) => {
  const out = { ...body };
  PROTECTED.forEach((k) => delete out[k]);
  return out;
};

/**
 * The list / get / create / update / delete handlers every content model shares.
 * `beforeCreate` and `beforeSave` let a controller fill server-owned fields.
 */
function crud(Model, { name, sort = { order: 1, createdAt: 1 }, beforeCreate, beforeSave } = {}) {
  const label = name || Model.modelName;

  const list = catchAsync(async (req, res) => {
    const rows = await Model.find().sort(sort);
    res.json({ success: true, data: rows });
  });

  const getOne = catchAsync(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${label} not found`);
    res.json({ success: true, data: doc });
  });

  const create = catchAsync(async (req, res) => {
    let data = clean(req.body || {});
    if (Model.schema.path('order') && data.order == null) {
      const last = await Model.findOne().sort({ order: -1 }).select('order');
      data.order = (last?.order || 0) + 1;
    }
    if (beforeCreate) data = await beforeCreate(data, req);
    if (beforeSave) data = await beforeSave(data, req);
    const doc = await Model.create(data);
    res.status(201).json({ success: true, data: doc });
  });

  const update = catchAsync(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`${label} not found`);
    let data = clean(req.body || {});
    if (beforeSave) data = await beforeSave({ ...doc.toObject(), ...data }, req, doc);
    doc.set(clean(data));
    await doc.save();
    res.json({ success: true, data: doc });
  });

  const remove = catchAsync(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) throw ApiError.notFound(`${label} not found`);
    res.json({ success: true, data: { id: req.params.id } });
  });

  return { list, getOne, create, update, remove };
}

module.exports = { crud };

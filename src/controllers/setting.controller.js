const Setting = require('../models/Setting');
const catchAsync = require('../helpers/catchAsync');

const FIELDS = ['contact', 'policies', 'occasions', 'values', 'galleryCategories', 'invoice', 'locations', 'reels', 'refundPolicy'];

exports.get = catchAsync(async (req, res) => {
  res.json({ success: true, data: await Setting.get() });
});

exports.update = catchAsync(async (req, res) => {
  const settings = await Setting.get();
  for (const k of FIELDS) if (req.body?.[k] !== undefined) settings[k] = req.body[k];
  // "All" is the gallery's own filter, not a category
  settings.galleryCategories = (settings.galleryCategories || []).filter((c) => c && c !== 'All');
  await settings.save();
  res.json({ success: true, data: settings });
});

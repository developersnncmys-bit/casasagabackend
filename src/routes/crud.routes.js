const express = require('express');
const { protect } = require('../middleware/auth');

/** Standard admin-only REST routes for a controller with list/getOne/create/update/remove. */
module.exports = function crudRoutes(controller) {
  const router = express.Router();
  router.use(protect);
  router.route('/').get(controller.list).post(controller.create);
  router.route('/:id').get(controller.getOne).put(controller.update).patch(controller.update).delete(controller.remove);
  return router;
};

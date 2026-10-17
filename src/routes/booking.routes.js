const express = require('express');
const ctrl = require('../controllers/booking.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/availability', ctrl.availability);
router.route('/').get(ctrl.list).post(ctrl.create);
router.route('/:id').get(ctrl.getOne).put(ctrl.update).patch(ctrl.update).delete(ctrl.remove);
router.post('/:id/invoice', ctrl.invoice);
router.post('/:id/email', ctrl.emailConfirmation);
// confirm | check-in | check-out | cancel | reopen
router.post('/:id/:action', ctrl.transition);

module.exports = router;

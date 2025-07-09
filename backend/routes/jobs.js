const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/jobs');
router.get('/',            ctrl.getAll);
router.post('/', auth,     ctrl.create);
router.delete('/:id', auth, ctrl.delete);
router.post('/:id/bookmark', auth, ctrl.bookmark);
module.exports = router;
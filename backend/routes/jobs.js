// jobportal/backend/routes/jobs.js
import { Router } from 'express';
import auth from '../middleware/auth.js';
import { getAll, create, remove, bookmark } from '../controllers/jobs.js';

const router = Router();

router.get('/',             getAll);
router.post('/',    auth,   create);
router.delete('/:id', auth, remove);
router.post('/:id/bookmark', auth, bookmark);

export default router;

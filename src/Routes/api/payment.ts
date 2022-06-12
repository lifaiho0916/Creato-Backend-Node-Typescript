import express from "express";
import auth from "../../middleware/auth";
const router = express.Router();

import { 
    buyDonuts 
} from "../../controllers/paymentController";

router.post('/buy', auth , buyDonuts);
 
export default router;
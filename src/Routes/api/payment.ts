import express from "express";
import auth from "../../middleware/auth";
const router = express.Router();

import {
    buyDonuts, getStripeID
} from "../../controllers/paymentController";

router.post('/buy', auth, buyDonuts);
router.get('/stripeId', auth, getStripeID);

export default router;
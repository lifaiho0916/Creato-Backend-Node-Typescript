import express from "express";
import auth from "../../middleware/auth";
const router = express.Router();

import {
    buyDonuts,
    getStripeID,
    connectStripe,
    disconnectStripe,
    getPaymentInfo
} from "../../controllers/paymentController";

router.post('/buy', auth, buyDonuts)
router.get('/stripeId', auth, getStripeID)
router.post('/connect_stripe', auth, connectStripe)
router.post('/disconnect_stripe', auth, disconnectStripe)
router.get('/payment_info', auth, getPaymentInfo)

export default router;
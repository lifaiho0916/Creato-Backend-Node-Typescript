import express from "express";
// import auth from "../../middleware/auth";
const router = express.Router();

//import Controller
import {
    tipUser,
    buyDonutForTip
} from '../../controllers/tipController';

router.post("/", tipUser);
router.post("/buy", buyDonutForTip)

export default router;
import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";
import {
    saveFanwall, 
    uploadFile, 
    fanwallGetByDareMeId, 
    fanwallGetByFundMeId,
    getPostDetail, 
    getFanwallsByPersonalUrl,
    likeFanwall,
    unlockFanwall,
    deleteFanwall
} from '../../controllers/fanwallController';

router.post('/personalUrl', getFanwallsByPersonalUrl)
router.post('/like', auth, likeFanwall);
router.post('/unlock', auth, unlockFanwall);
router.get('/dareme/:daremeId', fanwallGetByDareMeId);
router.get('/fundme/:fundmeId', fanwallGetByFundMeId);
router.get('/getById/:fanwallId', getPostDetail);
router.post('/upload', auth, uploadFile);
router.post('/save', auth, saveFanwall);
router.delete('/:fanwallId', auth, deleteFanwall);
export default router;
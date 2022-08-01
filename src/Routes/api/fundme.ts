import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";

//import Controller
import {
    getDraftFundme,
    publishFundme,
    getfundmesByPersonalUrl,
    saveFundme,
    fundCreator,
    checkFundMeFinished,
    getFundmeDetails,
    getFundmeResult,
    deleteFundme,
    getFundmeOptions,
    getFundMeList,
    setFundMeShow,
    updateFundMe,
    deleteFundMe
} from '../../controllers/fundmeController'

router.post("/draft", auth, getDraftFundme);
router.post("/save", auth, saveFundme);
router.post('/publish', auth, publishFundme);
router.get('/delete/:fundmeId', auth, deleteFundme);
router.post('/personalUrl', getfundmesByPersonalUrl);
router.get('/check/finished/:fundmeId', checkFundMeFinished);
router.get('/details/:fundmeId', getFundmeDetails);
router.get('/result/:fundmeId', getFundmeResult);
router.post('/fund/creator', auth, fundCreator);
// //admin
router.post('/fundmes', auth, getFundMeList);
router.post('/fundmes/:fundmeId', auth, setFundMeShow);
router.delete('/fundmes/:fundmeId', auth, deleteFundMe);
router.put('/fundmes/:fundmeId', auth, updateFundMe);
router.get('/voters/:fundmeId', auth, getFundmeOptions)
export default router;
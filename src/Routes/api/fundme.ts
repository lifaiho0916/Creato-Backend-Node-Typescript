import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";

//import Controller
import {
    getDraftFundme,
    // uploadFile,
    publishFundme,
    // getfundmesByPersonalUrl,
    // getFundmesOngoing,
    saveFundme,
    // supportCreator,
    fundCreator,
    // declineFundOption,
    // acceptFundOption,
    // winFundOption,
    checkFundMeFinished,
    getFundmeDetails,
    // getFundmeResult,
    // getOptionDetails,
    // getFundCreatorDetails,
    // checkFundMeRequests,
    // getFundMeRequests,
    deleteFundme,
    // selectCover,
    // getFundMeList,
    // setFundMeShow,
    // deleteFundMe,
    // updateFundMe,
    // deleteOption,
    // getFundmeOptions
} from '../../controllers/fundmeController'

router.post("/draft", auth, getDraftFundme);
router.post("/save", auth, saveFundme);
// router.post('/save/upload', auth, uploadFile);
router.post('/publish', auth, publishFundme);
router.get('/delete/:fundmeId', auth, deleteFundme);
// router.post('/save/cover', auth, selectCover);

// router.get('/ongoingFundmes', getFundmesOngoing);
// router.post('/personalUrl', getfundmesByPersonalUrl);
router.get('/check/finished/:fundmeId', checkFundMeFinished);
router.get('/details/:fundmeId', getFundmeDetails);
// router.get('/result/:fundmeId', getFundmeResult);
// router.get('/:fundmeId/details/:optionId', getOptionDetails);
// router.post('/support', auth, supportCreator);
// router.get('/fund/:fundmeId', getFundCreatorDetails);
router.post('/fund/creator', auth, fundCreator);
// router.get('/check/requests/:fundmeId', checkFundMeRequests);
// router.get('/requests/:fundmeId', getFundMeRequests);
// router.post('/decline', auth, declineFundOption);
// router.post('/accept', auth, acceptFundOption);
// router.post('/win/option', auth, winFundOption);
// router.get('/:fundmeId/options', auth, getFundmeOptions);

// //admin
// router.post('/fundmes', auth, getFundMeList);
// router.post('/fundmes/:fundmeId', auth, setFundMeShow);
// router.delete('/fundmes/:fundmeId', auth, deleteFundMe);
// router.put('/fundmes/:fundmeId', auth, updateFundMe);
// router.delete('/fundmes/:fundmeId/options/:optionId', auth, deleteOption);

export default router;
import express from 'express';
const router = express.Router();
import auth from "../../middleware/auth";

//import Controller
import {
    getDraftDareme,
    uploadFile,
    publishDareme,
    getDaremesByPersonalUrl,
    getDaremesOngoing,
    saveDareme,
    supportCreator,
    dareCreator,
    declineDareOption,
    acceptDareOption,
    winDareOption,
    checkDareMeFinished,
    getDaremeDetails,
    getDaremeResult,
    getOptionDetails,
    getDareCreatorDetails,
    checkDareMeRequests,
    getDareMeRequests,
    deleteDareme,
    selectCover,
    getDareMeList,
    setDareMeShow,
    deleteDareMe,
    updateDareMe,
    deleteOption,
    getDaremeOptions,
    checkRefundPossible
} from '../../controllers/daremeController'

router.post("/draft", auth, getDraftDareme);
router.post("/save", auth, saveDareme);
router.post('/save/upload', auth, uploadFile);
router.post('/publish', auth, publishDareme);
router.get('/delete/:daremeId', auth, deleteDareme);
router.post('/save/cover', auth, selectCover);

router.get('/ongoingDaremes', getDaremesOngoing);
router.post('/personalUrl', getDaremesByPersonalUrl);
router.get('/check/finished/:daremeId', checkDareMeFinished);
router.get('/details/:daremeId', getDaremeDetails);
router.get('/result/:daremeId', getDaremeResult);
router.get('/:daremeId/details/:optionId', getOptionDetails);
router.post('/support', auth, supportCreator);
router.get('/dare/:daremeId', getDareCreatorDetails);
router.post('/dare/creator', auth, dareCreator);
router.get('/check/requests/:daremeId', checkDareMeRequests);
router.get('/requests/:daremeId', getDareMeRequests);
router.post('/decline', auth, declineDareOption);
router.post('/accept', auth, acceptDareOption);
router.post('/win/option', auth, winDareOption);
router.get('/:daremeId/options', auth, getDaremeOptions);
router.get('/:daremeId/refund_possible', checkRefundPossible);

//admin
router.post('/daremes', auth, getDareMeList);
router.post('/daremes/:daremeId', auth, setDareMeShow);
router.delete('/daremes/:daremeId', auth, deleteDareMe);
router.put('/daremes/:daremeId', auth, updateDareMe);
router.delete('/daremes/:daremeId/options/:optionId', auth, deleteOption);

export default router;
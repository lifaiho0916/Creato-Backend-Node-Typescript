import express from "express";
import auth from "../../middleware/auth";
const router = express.Router();

//import Controller
import { 
    googleSignin, 
    googleSignup,
    facebookSignin,
    facebookSignup,
    getAuthData,
    editAvatar,
    saveProfileInfo,
    setLanguage,
    getUsersList,
    getExistName,
    getExistURL
} from '../../controllers/authController';

router.post("/googleSignin", googleSignin);
router.post("/googleSignup", googleSignup);
router.post("/facebookSignin", facebookSignin);
router.post("/facebookSignup", facebookSignup);
router.get("/get", auth, getAuthData);
router.post("/avatar/upload", auth, editAvatar);
router.post('/profile/save', auth ,saveProfileInfo);
router.post('/setting/lang', auth, setLanguage);
router.post('/exist_name', auth ,getExistName);
router.post('/exist_url', auth ,getExistURL);

router.post('/users', auth, getUsersList);

export default router;
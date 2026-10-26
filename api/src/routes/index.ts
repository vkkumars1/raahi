import { Router } from "express";
import auth from "./auth.routes";
import me from "./me.routes";
import rides from "./rides.routes";
import misc from "./misc.routes";

const router = Router();
router.use(auth, me, rides, misc);
export default router;

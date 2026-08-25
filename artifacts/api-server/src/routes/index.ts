import { Router, type IRouter } from "express";
import healthRouter from "./health";
import missionControlRouter from "./mission-control";

const router: IRouter = Router();

router.use(healthRouter);
router.use(missionControlRouter);

export default router;

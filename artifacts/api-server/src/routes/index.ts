import { Router, type IRouter } from "express";
import healthRouter from "./health";
import missionControlRouter from "./mission-control";
import runtimeRouter from "./runtime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(missionControlRouter);
router.use(runtimeRouter);

export default router;

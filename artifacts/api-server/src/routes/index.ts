import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inboxRouter from "./inbox";
import missionControlRouter from "./mission-control";
import personalTodosRouter from "./personal-todos";
import runtimeRouter from "./runtime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(missionControlRouter);
router.use(runtimeRouter);
router.use(personalTodosRouter);
router.use(inboxRouter);

export default router;

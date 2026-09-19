import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inboxRouter from "./inbox";
import missionControlRouter from "./mission-control";
import modelsRouter from "./models";
import personalTodosRouter from "./personal-todos";
import projectDetailRouter from "./project-detail";
import runtimeRouter from "./runtime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(missionControlRouter);
router.use(runtimeRouter);
router.use(personalTodosRouter);
router.use(inboxRouter);
router.use(projectDetailRouter);
router.use(modelsRouter);

export default router;

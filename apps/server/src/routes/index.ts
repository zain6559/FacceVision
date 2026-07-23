import { Router } from "express";
import healthRouter from "./health.js";
import personsRouter from "./persons.js";
import recognitionRouter from "./recognition.js";
import learningRouter from "./learning.js";
import statsRouter from "./stats.js";

import datasetRouter from "./dataset.js";
import experimentsRouter from "./experiments.js";
import enterpriseRouter from "./enterprise.js";
import intelligenceRouter from "./intelligence.js";
import socialRouter from "./social.js";
import queueRouter from "./queue.js";
import pluginsRouter from "./plugins.js";

const router = Router();

router.use("/healthz", healthRouter);
router.use("/persons", personsRouter);
router.use("/recognition", recognitionRouter);
router.use("/learning", learningRouter);
router.use("/stats", statsRouter);
router.use("/dataset", datasetRouter);
router.use("/experiments", experimentsRouter);
router.use("/enterprise", enterpriseRouter);
router.use("/intelligence", intelligenceRouter);
router.use("/social", socialRouter);
router.use("/queue", queueRouter);
router.use("/", pluginsRouter);

export default router;

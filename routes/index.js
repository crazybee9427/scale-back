import express from "express";
import {
  getAllWorkspacesBasicData,
  getAllWorkspacesDetailedStats,
  getAllWorkspaceReplyRatesByProvider,
} from "../api-test.js";

const router = express.Router();

router.post("/dashboard/basic", async (req, res) => {
  const stats = await getAllWorkspacesBasicData();
  res.json(stats);
});

router.post("/dashboard/details", async (req, res) => {
  const stats = await getAllWorkspacesDetailedStats();
  res.json(stats);
});

router.post("/dashboard/reply-rates", async (req, res) => {
  const stats = await getAllWorkspaceReplyRatesByProvider();
  res.json(stats);
});

export default router;

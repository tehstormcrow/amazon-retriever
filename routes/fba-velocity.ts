import express from "express";
const router = express.Router();

import { isLoggedIn } from "../middleware";
import weeklyFN from "../controllers/weekly.controller";
import Product from "../models/Product";

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const weeklyMap = await weeklyFN.getWeeklyMap();
    const products = await Product.find({})
      .sort({ SKU: 1 })
      .exec();
    res.render("fba-velocity", {
      products,
      weeklyMap
    });
  } catch (err) {
    res.send(err);
  }
});

export default router;

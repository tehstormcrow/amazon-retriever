import express from "express";
const router = express.Router();
import moment from "moment-timezone";

import { isLoggedIn } from "../middleware";
import DailyTotal from "../models/dailyTotals";
import DailyOrder from "../models/dailyOrders";

router.get("/", isLoggedIn, async (req, res) => {
  const day = moment()
    .format()
    .substring(0, 10);

  try {
    const dailyOrders = await DailyOrder.find({ day })
      .sort({ SKU: 1 })
      .exec();

    const totals = await DailyTotal.find({})
      .sort({ day: -1 })
      .exec();

    res.render("fba-daily-orders", {
      dailyOrders,
      totals,
      day
    });
  } catch (err) {
    res.send(err);
  }
});

router.get("/:day", isLoggedIn, async (req, res) => {
  try {
    const dailyOrders = await DailyOrder.find({ day: req.params.day })
      .sort({ SKU: 1 })
      .exec();

    const totals = await DailyTotal.find({})
      .sort({ day: -1 })
      .exec();

    res.render("fba-daily-orders", {
      dailyOrders,
      totals,
      day: req.params.day
    });
  } catch (err) {
    res.send(err);
  }
});

export default router;

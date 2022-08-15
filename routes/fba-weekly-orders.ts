import express from "express";
const router = express.Router();
import moment from "moment-timezone";

import { isLoggedIn } from "../middleware";
import WeeklyOrder from "../models/weeklyOrders";
import WeeklyTotal from "../models/weeklyTotals";

moment.tz.setDefault("America/New_York");

router.get("/", isLoggedIn, async (req, res) => {
  // isoweek gives monday, start of week is Monday on the project
  const startOfWeek = moment()
    .startOf("isoWeek")
    .format()
    .substring(0, 10);

  try {
    const weeklyOrders = await WeeklyOrder.find({ week: startOfWeek })
      .sort({ SKU: 1 })
      .exec();
    const totals = await WeeklyTotal.find({})
      .sort({ week: -1 })
      .exec();
    res.render("fba-weekly-orders", {
      weeklyOrders,
      totals,
      week: startOfWeek
    });
  } catch (err) {
    console.log(err);
  }
});

router.get("/:day", isLoggedIn, async (req, res) => {
  const startOfWeek = moment(req.params.day)
    .startOf("isoWeek")
    .format()
    .substring(0, 10);

  try {
    const weeklyOrders = await WeeklyOrder.find({ week: startOfWeek })
      .sort({ SKU: 1 })
      .exec();
    const totals = await WeeklyTotal.find({})
      .sort({ week: -1 })
      .exec();
    res.render("fba-weekly-orders", {
      weeklyOrders,
      totals,
      week: startOfWeek
    });
  } catch (err) {
    console.log(err);
  }
});

export default router;

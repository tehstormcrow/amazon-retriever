import express from "express";
const router = express.Router();
import moment from "moment-timezone";

import { isLoggedIn } from "../middleware";
import MonthlyOrders from "../models/monthlyOrders";
import MonthlyTotals from "../models/monthlyTotals";

moment.tz.setDefault("America/New_York");

router.get("/", isLoggedIn, async (req, res) => {
  const themonth = moment()
    .startOf("month")
    .format()
    .substring(0, 7);
  try {
    const monthlyOrders = await MonthlyOrders.find({ month: themonth })
      .sort({ SKU: 1 })
      .exec();

    const totals = await MonthlyTotals.find({})
      .sort({ month: -1 })
      .exec();

    res.render("fba-monthly-orders", {
      monthlyOrders,
      totals,
      month: themonth
    });
  } catch (err) {
    console.log(err);
  }
});

router.get("/:month", isLoggedIn, async (req, res) => {
  const themonth = moment(req.params.month)
    .startOf("month")
    .format()
    .substring(0, 7);

  try {
    const monthlyOrders = await MonthlyOrders.find({ month: themonth })
      .sort({ SKU: 1 })
      .exec();

    const totals = await MonthlyTotals.find({})
      .sort({ month: -1 })
      .exec();

    res.render("fba-monthly-orders", {
      monthlyOrders,
      totals,
      month: themonth
    });
  } catch (err) {
    console.log(err);
  }
});

export default router;

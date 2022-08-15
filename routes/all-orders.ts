import express from "express";

const router = express.Router();

import Order from "../models/Order";
import { isLoggedIn } from "../middleware";

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ "purchase-date": -1 })
      .limit(100)
      .exec();
    res.render("all-orders", { orders });
  } catch (err) {
    res.send(err);
  }
});

export default router;

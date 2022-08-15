import express from "express";
const router = express.Router();

import { isLoggedIn } from "../middleware";
import Product from "../models/Product";

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const products = await Product.find({})
      .sort({ SKU: 1 })
      .exec();
    res.render("inventory", { products });
  } catch (err) {
    console.log(err);
  }
});

export default router;


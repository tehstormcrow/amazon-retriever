import express from "express";
const router = express.Router();

import { isLoggedIn } from "../middleware";
import Product from "../models/Product";
import MerchantShippingRate from "../models/merchantShippingRate";

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ SKU: 1 }).exec();
    const rates = await getAvarageShippingRates();
    res.render("products/index", { products, rates });
  } catch (err) {
    console.log(err);
  }
});

const getAvarageShippingRates = async () => {
  const shippingRates = await MerchantShippingRate.aggregate([
    {
      $group: {
        _id: "$SKU",
        "m-customer": {
          $avg: "$m-customer",
        },
      },
    },
  ]);

  const res = {};
  shippingRates.forEach((rate) => {
    res[rate._id] = rate["m-customer"];
  });

  console.log(res);
  return res;
};

// Edit products
router.get("/edit", isLoggedIn, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ SKU: 1 }).exec();

    res.render("products/edit", { products });
  } catch (err) {
    console.log(err);
  }
});

// Update products
router.put("/", isLoggedIn, async (req, res) => {
  try {
    const items = req.body;
    const products = await Product.find({}).sort({ SKU: -1 }).exec();

    const operations = [];

    products.forEach((product) => {
      const newCost = items[product.SKU].cost;
      const newNgAmz = items[product.SKU]["ng-amz"];
      const unused = items[product.SKU].unused;
      let changed = false;

      if (newCost !== product.cost && newCost !== "") {
        product.cost = newCost;
        changed = true;
      }

      if (newNgAmz !== product["ng-amz"] && newNgAmz !== "") {
        product["ng-amz"] = newNgAmz;
        changed = true;
      }

      if (unused !== product.unused) {
        unused ? (product.unused = true) : (product.unused = false);
        changed = true;
      }

      if (changed) {
        operations.push({
          updateOne: {
            filter: { SKU: product.SKU },
            update: product.toObject(),
            upsert: true,
          },
        });
      }
    });
    if (operations.length > 0) {
      await Product.bulkWrite(operations);
    }
    res.redirect("/products");
  } catch (err) {
    console.log(err);
  }
});

export default router;

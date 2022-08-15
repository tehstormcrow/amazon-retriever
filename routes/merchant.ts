import express from "express";

const router = express.Router();

import Order from "../models/Order";
import MerchantShippingRate from "../models/merchantShippingRate";
import updateController from "../controllers/update.controller";
import { isLoggedIn } from "../middleware";

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const orders = await MerchantShippingRate.find({
      "m-customer": { $exists: false },
    })
      .sort({ "purchase-date": -1 })
      .limit(100)
      .exec();
    res.render("merchant", { orders });
  } catch (err) {
    res.send(err);
  }
});

router.put("/", isLoggedIn, async (req, res) => {
  try {
    const formData = req.body;
    const ops = [];

    Object.keys(formData).map((dataId) => {
      const [orderId, itemSKU] = dataId.split("/");
      const merchantShipmentRate = formData[dataId];

      if (!orderId || !itemSKU || !merchantShipmentRate) {
        return;
      }

      ops.push({
        updateOne: {
          filter: { "amazon-order-id": orderId, SKU: itemSKU },
          update: {
            "amazon-order-id": orderId,
            SKU: itemSKU,
            "m-customer": merchantShipmentRate,
          },
          upsert: true,
        },
      });
    });

    if (ops.length > 0) {
      await MerchantShippingRate.bulkWrite(ops);
    }

    // produce the reports with new data
    await updateController.produceReports(31);

    res.redirect("/merchant");
  } catch (err) {
    res.send(err);
  }
});

export default router;

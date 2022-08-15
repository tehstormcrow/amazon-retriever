import express from "express";
const router = express.Router();

import { isLoggedIn } from "../middleware";
import Product from "../models/Product";
import summaryFN from "../controllers/summary.controller";

import moment from "moment-timezone";
moment.tz.setDefault("America/New_York");

router.get("/", isLoggedIn, (req, res) => {
  let year = moment()
    .startOf("year")
    .format()
    .substring(0, 7);

  let years = [];
  let thisYear = parseInt(
    moment()
      .startOf("year")
      .format()
      .substring(0, 4)
  );

  while (thisYear >= 2017) {
    years.push(thisYear);
    thisYear--;
  }

  summaryFN
    .getSummaryMap(year)
    .then(summaryMap => {
      Product.find({})
        .sort({ SKU: 1 })
        .exec((err, products) => {
          if (err) console.log(err);
          else {
            res.render("summary", {
              year,
              years,
              products,
              summaryMap
            });
          }
        });
    })
    .catch(err => console.log(err));
});

router.get("/:year", isLoggedIn, (req, res) => {
  let year = moment(req.params.year)
    .add(10, "hours")
    .format()
    .substring(0, 7);

  let years = [];
  let thisYear = parseInt(
    moment()
      .startOf("year")
      .format()
      .substring(0, 4)
  );

  while (thisYear >= 2017) {
    years.push(thisYear);
    thisYear--;
  }

  summaryFN
    .getSummaryMap(year)
    .then(summaryMap => {
      Product.find({})
        .sort({ SKU: 1 })
        .exec((err, products) => {
          if (err) console.log(err);
          else {
            res.render("summary", {
              year,
              years,
              products,
              summaryMap
            });
          }
        });
    })
    .catch(err => console.log(err));
});

export default router;

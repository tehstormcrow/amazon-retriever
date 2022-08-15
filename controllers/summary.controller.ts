import MonthlyOrders from "../models/monthlyOrders";
import Product from "../models/Product";

import moment from "moment-timezone";
moment.tz.setDefault("America/New_York");

const getSummaryProductMap = (year): Promise<Map<string, object>> => {
  let summaryProductMap = new Map();
  return new Promise((resolve, reject) => {
    Product.find({}).exec((err, products) => {
      if (err)
        reject({
          path: "[summaryFN - getSummaryProductMap - product.find]",
          msg: err,
        });
      else {
        products.forEach((product) => {
          let nSummaryMonthsObj = getNSummaryMonthsObj(11, year);
          summaryProductMap.set(product.SKU, nSummaryMonthsObj);
        });
        resolve(summaryProductMap);
      }
    });
  });
};

const getNSummaryMonthsObj = (n, year) => {
  let endOfYear = moment(year).endOf("year");
  let nSummaryMonthsObj = {};

  for (let i = 0; i < n + 1; i++) {
    let iMonthsBefore = endOfYear
      .clone()
      .subtract(i, "month")
      .format()
      .substring(0, 7);

    nSummaryMonthsObj[iMonthsBefore] = {
      total: 0,
      profit: 0,
      quantity: 0,
      ratio: 0,
      month: "-",
    };
  }
  return nSummaryMonthsObj;
};

const getSummaryMap = (year) => {
  let beginningOfNextYear = moment(year)
    .add(1, "year")
    .format()
    .substring(0, 7);
  let endOfLastYear = moment(year)
    .subtract(1, "year")
    .endOf("year")
    .format()
    .substring(0, 7);

  return new Promise((resolve, reject) => {
    MonthlyOrders.find({})
      .where("month")
      //@ts-ignore
      .gt(endOfLastYear)
      //@ts-ignore
      .lt(beginningOfNextYear)
      .sort({ month: -1 })
      .exec((err, monthlyOrders) => {
        if (err)
          reject({
            path: "[summaryFN - getSummaryMap - MonthlyOrders.find]",
            msg: err,
          });
        else {
          let cost, total, profit;
          getSummaryProductMap(year).then((summaryProductMap) => {
            monthlyOrders.forEach((monthlyOrder) => {
              total = monthlyOrder.price;
              cost =
                monthlyOrder["amz-customer"] +
                monthlyOrder["m-customer"] +
                monthlyOrder["commision"] +
                monthlyOrder["cost"] +
                monthlyOrder["ng-amz"];
              profit = total - cost;
              summaryProductMap.get(monthlyOrder.SKU)[monthlyOrder.month] = {
                total,
                profit,
                cost: monthlyOrder["cost"],
                quantity: monthlyOrder.quantity,
                ratio: (profit / total) * 100,
                costRatio: (profit / monthlyOrder["cost"]) * 100,
                month: monthlyOrder.month,
              };
            });
            resolve(summaryProductMap);
          });
        }
      });
  });
};

export default {
  getSummaryMap,
};

import DailyOrder from "../models/dailyOrders";
import Product from "../models/Product";
import WeeklyOrder from "../models/weeklyOrders";
import WeeklyTotal from "../models/weeklyTotals";
import helpers from "../utils/helpers";

const { nWeeksBefore } = helpers;

// Moment time
const moment = require("moment-timezone");
moment.tz.setDefault("America/New_York");

//TODO: think about weeklyFN

const calcWeeklyOrders = (day) => {
  let startOfWeek = moment(day).startOf("isoweek");
  // Construct a map of monthly totals for each sku
  let orderItems = new Map();
  return new Promise((resolve, reject) => {
    DailyOrder.find({})
      .where("day")
      //@ts-ignore
      .gt(startOfWeek.clone().subtract(1, "day").format().substring(0, 10))
      //@ts-ignore
      .lt(startOfWeek.clone().add(7, "day").format().substring(0, 10))
      .sort({ day: -1 })
      .exec((err, orders) => {
        orders.forEach((item) => {
          let amzToCustomer = item["amz-customer"] ? item["amz-customer"] : 0;
          let mToCustomer = item["m-customer"] ? item["m-customer"] : 0;
          let commision = item["commision"] ? item["commision"] : 0;
          let oldItem = orderItems.get(item.SKU);
          let itemPrice = item.price ? item.price : 0;
          if (!oldItem) {
            let newItem = {
              week: startOfWeek.format().substring(0, 10),
              SKU: item.SKU,
              orders: item.orders,
              quantity: item.quantity,
              price: itemPrice,
              "amz-customer": amzToCustomer,
              "m-customer": mToCustomer,
              commision: commision,
              cost: item["cost"],
              "ng-amz": item["ng-amz"],
            };
            orderItems.set(item.SKU, newItem);
          } else {
            oldItem.orders += item.orders;
            oldItem.quantity += item.quantity;
            oldItem.price += itemPrice;
            oldItem["amz-customer"] += amzToCustomer;
            oldItem["m-customer"] += mToCustomer;
            oldItem["commision"] += commision;
            oldItem["cost"] += item["cost"];
            oldItem["ng-amz"] += item["ng-amz"];
          }
        });
        let bulkOps = [];
        orderItems.forEach((weeklyItem) => {
          bulkOps.push({
            updateOne: {
              filter: {
                week: startOfWeek.format().substring(0, 10),
                SKU: weeklyItem.SKU,
              },
              update: weeklyItem,
              upsert: true,
            },
          });
        });
        if (bulkOps.length > 0) {
          WeeklyOrder.bulkWrite(bulkOps, {}, (err) => {
            if (err)
              reject({
                path: "[weeklyFn - calcWeeklyOrders - weeklyOrder.bulkwrite]",
                msg: err,
              });
            console.log(
              "[weeklyFn - calcWeeklyOrders - weeklyOrder.bulkwrite] weekly was updated"
            );
            resolve();
          });
        }
        resolve();
      });
  });
};

const calcWeeklyTotal = async (day) => {
  const startOfWeek = moment(day).startOf("isoweek").format().substring(0, 10);

  try {
    const weeklyOrders = await WeeklyOrder.find({ week: startOfWeek });
    const totals = {
      week: startOfWeek,
      products: weeklyOrders.length,
      orders: 0,
      units: 0,
      total: 0,
      totalcost: 0,
      totalPP: 0,
      profit: 0,
    };
    weeklyOrders.forEach((weeklyOrder) => {
      totals.orders += weeklyOrder.orders;
      totals.units += weeklyOrder.quantity;
      totals.total += weeklyOrder.price;

      const mCustomer = weeklyOrder["m-customer"]
        ? weeklyOrder["m-customer"]
        : 0;
      totals.totalcost +=
        weeklyOrder["amz-customer"] +
        mCustomer +
        weeklyOrder["commision"] +
        weeklyOrder["cost"] +
        weeklyOrder["ng-amz"];
      totals.totalPP += weeklyOrder["cost"];
    });
    totals.profit = totals.total - totals.totalcost;

    await WeeklyTotal.updateOne({ week: startOfWeek }, totals, {
      upsert: true,
    });
  } catch (err) {
    throw new Error(err);
  }
};

const getWeeklyProductMap = (): Promise<Map<string, object>> => {
  let weeklyProductMap = new Map();
  return new Promise((resolve, reject) => {
    Product.find({}).exec((err, products) => {
      if (err)
        reject({
          path: "[weeklyFN - getWeeklyProductMap - Product.find]",
          msg: err,
        });
      else {
        products.forEach((product) => {
          let nWeeksObj = getNWeeksObj(32);
          weeklyProductMap.set(product.SKU, nWeeksObj);
        });
        resolve(weeklyProductMap);
      }
    });
  });
};

const getNWeeksObj = (n) => {
  let startOfWeek = moment().startOf("isoweek");
  let nWeeksObj = {};

  for (let i = 0; i < n + 1; i++) {
    let iWeeksBefore = startOfWeek
      .clone()
      .subtract(i, "week")
      .format()
      .substring(0, 10);
    nWeeksObj[iWeeksBefore] = 0;
  }
  return nWeeksObj;
};

const getWeeklyMap = () => {
  return new Promise((resolve, reject) => {
    WeeklyOrder.find({})
      .where("week")
      //@ts-ignore
      .gt(nWeeksBefore(33))
      .sort({ week: -1 })
      .exec((err, weeklyOrders) => {
        if (err)
          reject({ path: "[weeklyFN - getWeeklyMap - WeeklyOrder]", msg: err });
        else {
          getWeeklyProductMap().then((weeklyProductMap) => {
            weeklyOrders.forEach((weeklyOrder) => {
              weeklyProductMap.get(weeklyOrder.SKU)[weeklyOrder.week] =
                weeklyOrder.quantity;
              // weekly[weeklyOrder.week] = weeklyOrder.quantity;
            });
            resolve(weeklyProductMap);
          });
        }
      });
  });
};

export default {
  calcWeeklyOrders,
  calcWeeklyTotal,
  getWeeklyMap,
};

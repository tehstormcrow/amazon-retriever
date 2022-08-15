import DailyOrder from "../models/dailyOrders";
import MonthlyOrder from "../models/monthlyOrders";
import MonthlyTotal from "../models/monthlyTotals";

// Moment time
import moment from "moment-timezone";
moment.tz.setDefault("America/New_York");

const calcMonthlyOrders = (day) => {
  let startOfMonth = moment(day).startOf("month");
  let startOfNextMonth = startOfMonth
    .clone()
    .add(1, "month")
    .startOf("month")
    .format()
    .substring(0, 10);

  // Construct a map of monthly totals for each sku
  let orderItems = new Map();
  return new Promise((resolve, reject) => {
    DailyOrder.find({})
      .where("day")
      //@ts-ignore
      .gt(startOfMonth.clone().subtract(1, "day").format().substring(0, 10))
      //@ts-ignore
      .lt(startOfNextMonth)
      .sort({ day: -1 })
      .exec((err, orders) => {
        if (err)
          reject({
            path: "[mothlyFN - calcMonthlyOrders, dailyOrder.find]",
            msg: err,
          });
        orders.forEach((item) => {
          let amzToCustomer = item["amz-customer"] ? item["amz-customer"] : 0;
          let mToCustomer = item["m-customer"] ? item["m-customer"] : 0;
          let commision = item["commision"] ? item["commision"] : 0;
          let oldItem = orderItems.get(item.SKU);
          let itemPrice = item.price ? item.price : 0;
          if (!oldItem) {
            let newItem = {
              month: startOfMonth.format().substring(0, 7),
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
        orderItems.forEach((monthlyItem) => {
          bulkOps.push({
            updateOne: {
              filter: {
                month: startOfMonth.format().substring(0, 7),
                SKU: monthlyItem.SKU,
              },
              update: monthlyItem,
              upsert: true,
            },
          });
        });
        if (bulkOps.length > 0) {
          MonthlyOrder.bulkWrite(bulkOps, {}, (err, res) => {
            if (err)
              reject({
                path: "[mothlyFN - calcMonthlyOrders, monthlyOrder.bulkwrite]",
                msg: err,
              });
            console.log(
              "[monthlyFN - calcMonthlyOrder - monthlyOrder.bulkwrite] monthly was updated"
            );
            resolve();
          });
        }
        resolve();
      });
  });
};

const calcMonthlyTotal = async (day) => {
  const theMonth = moment(day).startOf("month").format().substring(0, 7);

  try {
    const monthlyOrders = await MonthlyOrder.find({ month: theMonth });
    const totals = {
      month: theMonth,
      products: monthlyOrders.length,
      orders: 0,
      units: 0,
      total: 0,
      totalcost: 0,
      totalPP: 0,
      profit: 0,
    };

    monthlyOrders.forEach((monthlyOrder) => {
      totals.orders += monthlyOrder.orders;
      totals.units += monthlyOrder.quantity;
      totals.total += monthlyOrder.price;

      const mCustomer = monthlyOrder["m-customer"]
        ? monthlyOrder["m-customer"]
        : 0;
      totals.totalcost +=
        monthlyOrder["amz-customer"] +
        mCustomer +
        monthlyOrder["commision"] +
        monthlyOrder["cost"] +
        monthlyOrder["ng-amz"];
      totals.totalPP += monthlyOrder["cost"];
    });
    totals.profit = totals.total - totals.totalcost;

    await MonthlyTotal.updateOne({ month: theMonth }, totals, { upsert: true });
  } catch (err) {
    throw new Error(err);
  }
};

export default {
  calcMonthlyTotal,
  calcMonthlyOrders,
};

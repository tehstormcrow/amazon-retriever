import Order from "../models/Order";
import MerchantShippingRate from "../models/merchantShippingRate";
import DailyOrder from "../models/dailyOrders";
import DailyTotal from "../models/dailyTotals";

import moment from "moment-timezone";
moment.tz.setDefault("America/New_York");

const getMerchantShippingRates = async (day) => {
  const data = {};
  const result = await MerchantShippingRate.find({
    "purchase-date": day,
  });

  result.forEach((rate) => {
    const customId = rate["amazon-order-id"] + "/" + rate.SKU;
    data[customId] = rate["m-customer"];
  });

  return data;
};

const getMerchantShippingRateOfItem = (rates, orderId, sku) => {
  return rates[orderId + "/" + sku] ? rates[orderId + "/" + sku] : 0;
};

/**
 * updates daily order totals by item.
 * @param {String} day : Day string formatted 2018-01-28
 * @returns void
 */
const calcDailyOrder = async (day: string) => {
  let orderItems = new Map();

  try {
    const orders = await Order.find({ "purchase-date": day });
    const merchantShippingRates = await getMerchantShippingRates(day);

    //Handle each order
    orders.forEach((order) => {
      order.items.forEach((item) => {
        let amzToCustomer = item["amz-customer"] ? item["amz-customer"] : 0;
        let mToCustomer = getMerchantShippingRateOfItem(
          merchantShippingRates,
          order["amazon-order-id"],
          item.SKU
        );
        let commision = item["commision"] ? item["commision"] : 0;
        let itemPrice = item.price ? item.price : 0;
        let oldItem = orderItems.get(item.SKU);
        if (!oldItem) {
          let newItem = {
            day: day,
            SKU: item.SKU,
            orders: 1,
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
          oldItem.orders += 1;
          oldItem.quantity += item.quantity;
          oldItem.price += itemPrice;
          oldItem["amz-customer"] += amzToCustomer;
          oldItem["m-customer"] += mToCustomer;
          oldItem["commision"] += commision;
          oldItem["cost"] += item["cost"];
          oldItem["ng-amz"] += item["ng-amz"];
        }
      });
    });

    let bulkOps = [];
    orderItems.forEach((dailyItem) => {
      bulkOps.push({
        updateOne: {
          filter: {
            day: dailyItem.day,
            SKU: dailyItem.SKU,
          },
          update: dailyItem,
          upsert: true,
        },
      });
    });

    if (bulkOps.length <= 0) {
      return Promise.resolve();
    }

    const data = await DailyOrder.bulkWrite(bulkOps);
    console.log(
      "[dailyFN - calcDailyOrder - dailyOrder.bulkWrite] daily was updated"
    );
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
};

const calcDailyTotal = async (day: string) => {
  try {
    const dailyOrders = await DailyOrder.find({ day: day });

    const totals = {
      day: day,
      dayOfWeek: moment(day).format("ddd"),
      products: dailyOrders.length,
      orders: 0,
      units: 0,
      total: 0,
      totalcost: 0,
      totalPP: 0,
      profit: 0,
    };

    dailyOrders.forEach((dailyOrder) => {
      totals.orders += dailyOrder.orders;
      totals.units += dailyOrder.quantity;
      totals.total += dailyOrder.price;

      const mCustomer = dailyOrder["m-customer"] ? dailyOrder["m-customer"] : 0;
      totals.totalcost +=
        dailyOrder["amz-customer"] +
        mCustomer +
        dailyOrder["commision"] +
        dailyOrder["cost"] +
        dailyOrder["ng-amz"];
      totals.totalPP += dailyOrder["cost"];
    });

    totals.profit = totals.total - totals.totalcost;

    await DailyTotal.updateOne({ day: day }, totals, { upsert: true });

    console.log(
      "[dailyFN - calcDailyTotal - dailyTotal.bulkWrite] dailyTotal was updated"
    );
    return Promise.resolve();
  } catch (err) {
    return Promise.reject(err);
  }
};

export default {
  calcDailyOrder,
  calcDailyTotal,
};

import orderController from "./order.controller";
import helpers from "../utils/helpers";
import productController from "./product.controller";
import dailyController from "./daily.controller";
import weeklyController from "./weekly.controller";
import monthlyController from "./monthly.controller";

const { nDaysBefore, nMonthBefore, nWeeksBefore } = helpers;

// Moment time
const moment = require("moment-timezone");
moment.tz.setDefault("America/New_York");

const oneYearPull = async () => {
  const days = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360,
  ].reverse();
  // let days = [0, 30, 60, 90, 120, 150, 180].reverse();
  const today = moment();
  for (let i = 0; i < days.length - 1; i++) {
    setTimeout(async () => {
      await orderController.handleOrders({
        delay: 60000,
        startDate: nDaysBefore(days[i]),
        endDate: nDaysBefore(days[i + 1]),
      });
      await orderController.updateOrdersFinancial(
        nDaysBefore(days[i]),
        nDaysBefore(days[i + 1])
      );
    }, 120000 * i);
  }
};

// let oneYearUpdate = () => {
//   orderFN.updateOrdersFinancial(nDaysBefore(360), nDaysBefore(180));
//   setTimeout(() => {
//     orderFN.updateOrdersFinancial(nDaysBefore(180));
//   }, 30000);
// }

const dailiesOfN = async (nDays: number) => {
  const promises = [];
  for (let i = 0; i < nDays + 1; i++) {
    promises.push(dailyController.calcDailyOrder(nDaysBefore(i)));
  }
  return await Promise.all(promises);
};

const dailyTotalsofN = async (nDays: number) => {
  const promises = [];
  for (let i = 0; i < nDays + 1; i++) {
    promises.push(dailyController.calcDailyTotal(nDaysBefore(i)));
  }
  return await Promise.all(promises);
};

const weekliesOfN = async (nWeeks: number) => {
  const promises = [];
  for (let i = 0; i < nWeeks + 1; i++) {
    promises.push(weeklyController.calcWeeklyOrders(nWeeksBefore(i)));
  }
  return await Promise.all(promises);
};

const weeklyTotalsofN = async (nWeeks: number) => {
  const promises = [];
  for (let i = 0; i < nWeeks + 1; i++) {
    promises.push(weeklyController.calcWeeklyTotal(nWeeksBefore(i)));
  }
  return await Promise.all(promises);
};

const monthliesOfN = (nMonths: number) => {
  const promises = [];
  for (let i = 0; i < nMonths + 1; i++) {
    promises.push(monthlyController.calcMonthlyOrders(nMonthBefore(i)));
  }
  return Promise.all(promises);
};

const monthlyTotalsOfN = async (nMonths: number) => {
  const promises = [];
  for (let i = 0; i < nMonths + 1; i++) {
    promises.push(monthlyController.calcMonthlyTotal(nMonthBefore(i)));
  }
  return await Promise.all(promises);
};

// 15 min update
// productGetCurrentPrice
// getOrder, orderFinancial = make a single unit
// daily, dailytotal, weekly, weeklytotal, monthly, monthlyTotal = make a single unit
const updateOrder = async (delay: number, startDate = "", endDate = "") => {
  console.log('will handle orders')
  await orderController.handleOrders({ delay, startDate, endDate });
  console.log('handled orders')
  await orderController.updateOrdersFinancial(startDate, endDate);
};

/**
 *
 * @param {Number} n : days
 */
const produceReports = async (n: number) => {
  const days = n;
  const weeks = Math.ceil(n / 7) + 1;
  const months = Math.ceil(n / 30);
  await dailiesOfN(days);
  await dailyTotalsofN(days);
  await weekliesOfN(weeks);
  await weeklyTotalsofN(weeks);
  await monthliesOfN(months);
  await monthlyTotalsOfN(months);
};

/**
 *
 * @param {String} day : day in string
 */
const produceReportsforDate = async (day: string) => {
  await dailyController.calcDailyOrder(day);
  await dailyController.calcDailyTotal(day);
  await weeklyController.calcWeeklyOrders(day);
  await weeklyController.calcWeeklyTotal(day);
  await monthlyController.calcMonthlyOrders(day);
  await monthlyController.calcMonthlyTotal(day);
};

const quarterlyUpdate = async () => {
  try {
    console.log('inside quarterly')
    await updateOrder(20001);
    await produceReports(31);
  } catch (err) {
    console.log(err);
    console.log("[quarterlyUpdate] " + err.msg + err.path);
  }
};

const dailyUpdate = async () => {
  try {
    await productController.handleProducts();
    await productController.getMyPrice();
    await orderController.cleanBadData();
  } catch (err) {
    console.log(err);
  }
};

// daily update
// Quantity, incoming, getInventory

export default {
  oneYearPull,
  produceReports,
  quarterlyUpdate,
  updateOrder,
  dailyUpdate,
  produceReportsforDate,
};

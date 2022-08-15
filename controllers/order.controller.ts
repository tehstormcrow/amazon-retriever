import axios from "axios";
import MerchantShippingRate from "../models/merchantShippingRate";
import Product from "../models/Product";
import updateController from "./update.controller";
import Order from "../models/Order";

// Moment time
const moment = require("moment-timezone");
moment.tz.setDefault("America/New_York");

// Custom Functions
import helpers from "../utils/helpers";

interface IHandleOrderOptions {
  delay: number;
  startDate: string;
  endDate: string;
}

const handleOrders = async (options: IHandleOrderOptions) => {
  const ordersData = await getOrders(options);
  const orders = helpers.txtToArray(ordersData);
  return await addAllOrders(orders);
};

/**
 * Get orders with order report,
 * @param {IHandleOrderOptions}
 * @returns {OrdersReport} : amazon formatted data
 */
const getOrders = async (options: IHandleOrderOptions) => {
  const reqParams: string[] = [
    "ReportType=_GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_",
  ];

  const startDate =
    options.startDate === ""
      ? moment().subtract(30, "day").toISOString()
      : moment(options.startDate).toISOString();
  reqParams.push("StartDate=" + encodeURIComponent(startDate));

  if (options.endDate !== "") {
    reqParams.push(
      "EndDate=" + encodeURIComponent(moment(options.endDate).toISOString())
    );
  }

  return await helpers.requestAndGetReport(reqParams, options.delay);
};

/**
 * Add orders to database
 * @param {Order Array}: orders to be added
 */
const addAllOrders = async (orders) => {
  const allOrders = new Map();
  const operations = [];
  const productOperations = [];
  const productsNotInInventory = {};
  const merchantShippingRatesOperations = [];
  const products = await helpers.getProductMap();

  // removes Cancelled orders, updates orders, product lowest-price
  orders.forEach(async (order) => {
    if (!order["amazon-order-id"] || order["amazon-order-id"] === "") {
      return;
    }

    if (order["order-status"] === "Cancelled") {
      operations.push({
        deleteOne: {
          filter: { "amazon-order-id": order["amazon-order-id"] },
        },
      });

      if (order["fulfillment-channel"] === "Merchant") {
        merchantShippingRatesOperations.push({
          deleteOne: {
            filter: {
              "amazon-order-id": order["amazon-order-id"],
              SKU: order["sku"],
            },
          },
        });
      }
      return;
    }

    if (!order["item-price"] || parseInt(order["item-price"]) === 0) {
      return;
    }

    const quantity = order["quantity"];
    const purchaseDate = moment(order["purchase-date"])
      .format()
      .substring(0, 10);
    // Set product info based on previous orders | amazon doesn't give data on pending orders
    const product = products.get(order["sku"]);

    if (!product && !productsNotInInventory[order["sku"]]) {
      productsNotInInventory[order["sku"]] = {
        sku: order["sku"],
        asin: order["asin"],
      };
    }

    let cost = product && product["cost"] ? product["cost"] * quantity : 0;
    let ngAmz = product && product["ng-amz"] ? product["ng-amz"] * quantity : 0;
    let amzCust =
      product && product["amz-customer"]
        ? product["amz-customer"] * quantity
        : 0;
    let commision =
      product && product["ratio"] ? order["item-price"] * product["ratio"] : 0;

    // add shipping price for the products which has it, before it was showing lost
    let price = Number.parseFloat(order["item-price"]);
    if(Number.parseFloat(order['shipping-price'])) {
      price += Number.parseFloat(order['shipping-price']);
    }

    // Checks if same order exits before, adds new items to oldOrder or make new
    if (!allOrders.get(order["amazon-order-id"])) {
      // Make a new entry
      let newOrder = {
        "amazon-order-id": order["amazon-order-id"],
        "purchase-date": purchaseDate,
        "order-status": order["item-status"],
        items: [
          {
            SKU: order["sku"],
            quantity: order["quantity"],
            price: price,
            "amz-customer": amzCust,
            commision: commision,
            cost: cost,
            "ng-amz": ngAmz,
          },
        ],
      };

      allOrders.set(order["amazon-order-id"], newOrder);
    } else {
      const oldOrder = allOrders.get(order["amazon-order-id"]);

      oldOrder.items.push({
        SKU: order["sku"],
        quantity: order["quantity"],
        price: price,
        "amz-customer": amzCust,
        commision: commision,
        cost: cost,
        "ng-amz": ngAmz,
      });
    }

    // Handle lowest unit price update
    let unitPrice = price / order["quantity"];
    let updateToMake = {
      fulfillment: order["fulfillment-channel"],
    };

    if (
      (unitPrice && !product) ||
      (unitPrice &&
        (unitPrice < product["lowest-price"] || !product["lowest-price"]))
    ) {
      updateToMake["lowest-price"] = unitPrice;
    }

    productOperations.push({
      updateOne: {
        filter: { SKU: order["sku"] },
        update: updateToMake,
        upsert: true,
      },
    });

    if (order["fulfillment-channel"] === "Merchant") {
      merchantShippingRatesOperations.push({
        updateOne: {
          filter: {
            "amazon-order-id": order["amazon-order-id"],
            SKU: order["sku"],
          },
          update: {
            "amazon-order-id": order["amazon-order-id"],
            SKU: order["sku"],
            "purchase-date": purchaseDate,
          },
          upsert: true,
        },
      });
    }
  });

  // merchant fullfilment inventory doesn't get fetched, so when it is encountered for the first time we need save it to
  // products
  if (Object.keys(productsNotInInventory).length > 0) {
    const ops = [];
    (
      Object.values(productsNotInInventory) as { sku: string; asin: string }[]
    ).forEach((p) => {
      ops.push({
        updateOne: {
          filter: { SKU: p.sku },
          update: {
            SKU: p.sku,
            ASIN: p.asin,
          },
          upsert: true,
        },
      });
    });

    try {
      const result = await Product.bulkWrite(ops);
      console.log(
        "[orderController - AddAllOrders - Product.bulkWrite] Bulk write of not in inventory products was successfull with matched: " +
          result.matchedCount +
          " modified: " +
          result.modifiedCount
      );
    } catch (err) {
      console.log(err);
    }
  }

  // produce bulkwrite operations list
  allOrders.forEach((order) => {
    operations.push({
      updateOne: {
        filter: { "amazon-order-id": order["amazon-order-id"] },
        update: order,
        upsert: true,
      },
    });
  });

  return new Promise((resolve, reject) => {
    if (merchantShippingRatesOperations.length > 0) {
      MerchantShippingRate.bulkWrite(
        merchantShippingRatesOperations,
        {},
        (err, data) => {
          if (err) {
            reject({
              path: "[orderController - AddAllOrders - MerchantShippingRate.bulkWrite]",
              msg: err,
            });
          } else {
            console.log(
              "[orderController - AddAllOrders - MerchantShippingRate.bulkWrite] Bulk write was successfull with matched: " +
                data.matchedCount +
                " modified: " +
                data.modifiedCount
            );
          }
        }
      );
    }

    if (productOperations.length > 0) {
      Product.bulkWrite(productOperations, {}, (err, data) => {
        if (err) {
          reject({
            path: "[orderController - AddAllOrders - Product.bulkWrite]",
            msg: err,
          });
        } else {
          console.log(
            "[orderController - AddAllOrders - Product.bulkWrite] Bulk write was successfull with matched: " +
              data.matchedCount +
              " modified: " +
              data.modifiedCount
          );
        }
      });
    }

    if (operations.length > 0) {
      Order.bulkWrite(operations, {}, (err, data) => {
        if (err) {
          reject({
            path: "[orderController - AddAllOrders - Order.bulkWrite]",
            msg: err,
          });
        } else {
          console.log(
            "[orderController - AddAllOrders - Order.bulkWrite] Bulk write was successfull with matched: " +
              data.matchedCount +
              " modified: " +
              data.modifiedCount
          );
          resolve();
        }
      });
    }
  });
};

/**
 * Update cost of orders by date
 * @param {String} startDate: formatted 2018-10-05
 * @param {String} endDate: formatted 2018-10-05
 */
const updateOrdersFinancial = async (startDate = "", endDate = "") => {
  //Adjust request parameters
  const reqParams = [];
  startDate =
    startDate === ""
      ? moment().subtract(30, "day").toISOString()
      : moment(startDate).toISOString();
  reqParams.push("PostedAfter=" + encodeURIComponent(startDate));
  if (endDate != "")
    reqParams.push(
      "PostedBefore=" + encodeURIComponent(moment(endDate).toISOString())
    );
  reqParams.push("MaxResultsPerPage=100");

  try {
    /* tslint:disable */
    const financialEventsReport = await axios.post(
      helpers.buildURL(
        "ListFinancialEvents",
        reqParams,
        "Finances",
        "2015-05-01"
      )
    );
    const financialEvents = await helpers.xmlToObject(
      financialEventsReport.data
    );
    return await financialHandler(financialEvents);
  } catch (err) {
    console.log(err);
    throw new Error(`[orderController - updateOrdersFinancial] ${err}`);
  }
};

/**
 * Updates database with financial Event List
 * @param {Promise} data : Financial event List
 */
const financialHandler = async (data) => {
  let hasNext = false;
  let nextToken, result;

  // Gets result data, response is different based upon being requested from event or next token
  if (data.ListFinancialEventsResponse) {
    result = data.ListFinancialEventsResponse.ListFinancialEventsResult[0];
  } else {
    result =
      data.ListFinancialEventsByNextTokenResponse
        .ListFinancialEventsByNextTokenResult[0];
  }

  // Gets next token for recursive call
  if (result.NextToken) {
    hasNext = true;
    nextToken = result.NextToken[0];
  }

  let shipmentEvents =
    result.FinancialEvents[0].ShipmentEventList[0].ShipmentEvent;

  // Goes through each shipmentEvent then bulkWrites objects into Order
  if (shipmentEvents) {
    await updateFinancialAndProducts(shipmentEvents);
  }

  if (hasNext) {
    try {
      const financialEventsByNextTokenReport = await axios.post(
        helpers.buildURL(
          "ListFinancialEventsByNextToken",
          ["NextToken=" + encodeURIComponent(nextToken)],
          "Finances",
          "2015-05-01"
        )
      );
      const financialEventsByNextToken = await helpers.xmlToObject(
        financialEventsByNextTokenReport.data
      );
      await financialHandler(financialEventsByNextToken);
    } catch (err) {
      throw new Error("err from hasNExt" + err);
    }
  }
};

/**
 * formats Amazon financial shipment report items into Order items.
 * @param {Array} items : Array of Amazon shipment items as returned from api
 * @returns {Array} : Array of items formatted same as Order.items
 */
const updateFinancialAndProducts = async (shipmentEvents) => {
  const productsData = new Map();
  const products = await helpers.getProductMap();
  const updates = [];
  shipmentEvents.forEach((event) => {
    let amazonOrderId = event.AmazonOrderId[0];
    let items = event.ShipmentItemList[0].ShipmentItem;
    let orderItems = [];
    items.forEach((item) => {
      let itemFound = false;
      let amzToCustomer = 0;
      let commision = 0;
      let itemSKU = item.SellerSKU[0];
      let itemPrice = parseFloat(
        item.ItemChargeList[0].ChargeComponent[0].ChargeAmount[0]
          .CurrencyAmount[0]
      );
      let itemQuantity = parseInt(item.QuantityShipped[0]);
      let product = products.get(itemSKU);

      if (!product) {
        return;
      }

      let cost = product["cost"] ? parseFloat(product["cost"]) : 0;
      let ngAmz = product["ng-amz"] ? parseFloat(product["ng-amz"]) : 0;

      if (item.ItemFeeList) {
        item.ItemFeeList[0].FeeComponent.forEach((fee) => {
          let feeType = fee.FeeType[0];
          if (feeType === "FBAPerUnitFulfillmentFee") {
            let feeAmount = Math.abs(
              parseFloat(fee.FeeAmount[0].CurrencyAmount[0])
            );
            amzToCustomer = feeAmount;
          }
          if (feeType === "Commission") {
            let feeAmount = Math.abs(
              parseFloat(fee.FeeAmount[0].CurrencyAmount[0])
            );
            commision = feeAmount;
          }
        });
      }

      if (item.ItemChargeList) {
        item.ItemChargeList[0].ChargeComponent.forEach((charge) => {
          if (charge.ChargeType[0] === "ShippingCharge") {
            itemPrice += parseFloat(charge.ChargeAmount[0].CurrencyAmount[0]);
          }
        })
      }

      // Add item to orderItems
      // Sometimes 2 same sku item is presented with 2 different entries. This loop is a solution for such.
      orderItems.forEach((orderItem) => {
        if (orderItem.SKU === item.SellerSKU[0]) {
          itemFound = true;
          orderItem.quantity += itemQuantity;
          orderItem.price += itemPrice;
          orderItem["amz-customer"] += amzToCustomer;
          orderItem["commision"] += commision;
          orderItem["cost"] += cost * itemQuantity;
          orderItem["ng-amz"] += ngAmz * itemQuantity;
        }
      });
      if (!itemFound) {
        orderItems.push({
          SKU: itemSKU,
          quantity: itemQuantity,
          price: itemPrice,
          "amz-customer": amzToCustomer,
          commision: commision,
          cost: cost * itemQuantity,
          "ng-amz": ngAmz * itemQuantity,
        });
      }
    });

    // Sometimes amz-customer data is avail but not the commision,
    // and also sometimes previous order has commision but not the new one
    orderItems.forEach((orderItem) => {
      const productUpdate = {
        SKU: orderItem.SKU,
        commision: orderItem.commision / orderItem.quantity,
        ratio: orderItem.commision / orderItem.price,
      };

      if (orderItem["amz-customer"] !== 0) {
        productUpdate["amz-customer"] =
          orderItem["amz-customer"] / orderItem.quantity;
      }

      if (productUpdate.commision !== 0) {
        productsData.set(orderItem.SKU, productUpdate);
      }
    });

    updates.push({
      updateOne: {
        filter: { "amazon-order-id": amazonOrderId },
        update: {
          items: orderItems,
        },
      },
    });
  });
  Order.bulkWrite(updates, {}, (err, res) => {
    if (err)
      return Promise.reject({
        path: "[orderController - updateFinancialAndProducts - Order.bulkWrite]",
        msg: err,
      });
    else
      console.log(
        "[orderController - updateFinancialAndProducts - Order.bulkWrite] updated order prices"
      );
  });

  // For Product Data
  let bulkOps = [];
  productsData.forEach((productData) => {
    bulkOps.push({
      updateOne: {
        filter: { SKU: productData.SKU },
        update: productData,
      },
    });
  });
  Product.bulkWrite(bulkOps, {}, (err, res) => {
    if (err)
      return Promise.reject({
        path: "[orderController - updateFinancialAndProducts - Product.bulkWrite]",
        msg: err,
      });
    else
      console.log(
        "[orderController - updateFinancialAndProducts - Product.bulkWrite] updated product pricings"
      );
  });
};

const cleanBadData = () => {
  let today = moment().startOf("day");
  Order.find({ "order-status": "Unshipped" })
    .where("purchase-date")
    .lt(today.subtract(1, "month").format().substring(0, 10))
    .exec((err, cancelledOrders) => {
      if (err)
        return Promise.reject({
          path: "[orderController - cleanBadData - Order.find]",
          msg: err,
        });
      else {
        cancelledOrders.forEach((order) => {
          Order.deleteOne(
            { "amazon-order-id": order["amazon-order-id"] },
            (err) => {
              if (err)
                return Promise.reject({
                  path: "[orderController - cleanBadData - Order.deleteOne]",
                  msg: err,
                });
              else {
                updateController.produceReportsforDate(order["purchase-date"]);
              }
            }
          );
        });
      }
    });
};

export default {
  updateOrdersFinancial,
  handleOrders,
  cleanBadData,
};

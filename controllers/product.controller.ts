import axios from "axios";
import Order from "../models/Order";
import Product from "../models/Product";

// Moment time
import moment from "moment-timezone";
moment.tz.setDefault("America/New_York");

// Custom Functions
import helpers from "../utils/helpers";

// ******************************
// GET PRODUCTS & HELPERS
// ******************************
// TODO: catch error handlers to be added

// ******************************
// HANDLE PRODUCTS
// ******************************

// gets reserved items,
// gets inbound items
// gets products
// makes updates to products 
const handleProducts = async () => {
  try {
    const [products, reservedItems, inboundItems] = await Promise.all([
      getProducts(),
      getReservedItems(),
      getInbound(),
    ]);

    // Adjust inventory quantities with reserved items by adding items in transfer || sold items are disregarded.
    reservedItems.forEach((reservedItem) => {
      let product = products.get(reservedItem.sku);
      if (product) {
        product.quantity += reservedItem.reservedTransferQuantity;
        products.set(product.sku, product);
      } else {
        console.log(
          "[productFN - HANDLEPRODUCTS - reservedItems.foreach] ",
          reservedItem.sku,
          ": wasn't found in the list"
        );
        products.set(reservedItem.sku, {
          SKU: reservedItem.sku,
          ASIN: reservedItem.asin,
          quantity: reservedItem.reservedTransferQuantity,
          inbound: 0,
        });
      }
    });

    // Adjust inbound inventory quantities | inbounditem[0] is sku and inboundItem[1] is quantity
    inboundItems.forEach((inboundItem) => {
      let product = products.get(inboundItem.sku);
      if (product) {
        product.inbound = inboundItem.Quantity;
      } else {
        console.log(
          "[ProductFN - HANDLEPRODUCTS - inboundItems.forEach] ",
          inboundItem.sku,
          ": inbound wasn't found in the reserved list"
        );
        products.set(inboundItem.sku, {
          SKU: inboundItem.sku,
          quantity: 0,
          inbound: inboundItem.Quantity,
        });
      }
    });

    // Put products into bulk operation array
    let bulkops = [];
    products.forEach((product) => {
      bulkops.push({
        updateOne: {
          filter: { SKU: product.SKU },
          update: product,
          upsert: true,
        },
      });
    });
    return new Promise((resolve, reject) => {
      Product.bulkWrite(bulkops, {}, (err, data) => {
        if (err)
          reject({
            path: "[ProductFN - handleProducts - Product.Bulkwrite ]",
            msg: err,
          });
        else {
          console.log(
            "[ProductFN - handleProducts - Product.Bulkwrite ] Bulk write was successfull with matched: " +
              data.matchedCount +
              " modified: " +
              data.modifiedCount
          );
          resolve();
        }
      });
    });
  } catch (err) {
    console.log(`[productController - handleProducts] ${err}`);
    // return helpers.normalizeErr(err, "[productFN - handleProducts - mainBlock]");
  }
};

/**
 * gets products and handles the report
 * @returns {Map}
 * */
const getProducts = async (): Promise<Map<any, any>> => {
  try {
    let today = moment().startOf("day");
    let queryStartTime = today.subtract(1, "year").toISOString();
    const inventorySupplyList = await listInventorySupply(queryStartTime);
    const inventorySupplyListFormatted = await helpers.xmlToObject(
      inventorySupplyList
    );
    return await handleProductsReport(inventorySupplyListFormatted);
  } catch (err) {
    throw new Error(`[productFN - getProducts] ${err}`);
  }
};

// Put the products into proper form
const handleProductsReport = async (xmlResponse): Promise<Map<any, any>> => {
  return new Promise(async (resolve, reject) => {
    let ListInventorySupplyResult =
      xmlResponse.ListInventorySupplyResponse.ListInventorySupplyResult[0];
    let inventory = ListInventorySupplyResult.InventorySupplyList[0].member;
    let items = new Map();
    inventory.forEach((product) => {
      items.set(product.SellerSKU[0], {
        SKU: product.SellerSKU[0],
        ASIN: product.ASIN[0],
        quantity: parseInt(product.InStockSupplyQuantity[0]),
        inbound: 0,
      });
    });

    let nextToken = ListInventorySupplyResult.NextToken;
    if (nextToken) {
      nextToken = nextToken[0];
    }
    while (nextToken) {
      try {
        const resp = await listInventorySupplyByNextToken(nextToken).then(
          helpers.xmlToObject
        );
        const [newNextToken, nextItems] = handleNextInventorySupplyItems(resp);
        nextToken = newNextToken;
        nextItems.forEach((product) => {
          items.set(product.SellerSKU[0], {
            SKU: product.SellerSKU[0],
            ASIN: product.ASIN[0],
            quantity: parseInt(product.InStockSupplyQuantity[0]),
            inbound: 0,
          });
        });
      } catch (err) {
        return reject({
          path: "[productFN - getProducts - nextLoop]",
          msg: err,
        });
      }
    }
    return resolve(items);
  });
};

const listInventorySupply = async (queryStartTime) => {
  const res = await axios.post(
    helpers.buildURL(
      "ListInventorySupply",
      ["QueryStartDateTime=" + encodeURIComponent(queryStartTime)],
      "FulfillmentInventory",
      "2010-10-01"
    )
  );

  return res.data;
};

const listInventorySupplyByNextToken = async (nextToken) => {
  const res = await axios.post(
    helpers.buildURL(
      "ListInventorySupplyByNextToken",
      ["NextToken=" + encodeURIComponent(nextToken)],
      "FulfillmentInventory",
      "2010-10-01"
    )
  );

  return res.data;
};

const handleNextInventorySupplyItems = (resp) => {
  const ListInventorySupplyByNextTokenResult =
    resp.ListInventorySupplyByNextTokenResponse
      .ListInventorySupplyByNextTokenResult[0];
  const nextItems =
    ListInventorySupplyByNextTokenResult.InventorySupplyList[0].member;
  let nextToken = ListInventorySupplyByNextTokenResult.NextToken;
  if (!nextToken) {
    nextToken = false;
  } else {
    nextToken = nextToken[0];
  }

  return [nextToken, nextItems];
};

// ******************************
// GETRESERVEDITEMS & HELPERS
// ******************************

interface IReservedItem {
  sku: string;
  asin: string;
  reservedTransferQuantity: number;
}
const getReservedItems = async (): Promise<Map<string, IReservedItem>> => {
  try {
    const params = [];
    params.push("ReportType=_GET_RESERVED_INVENTORY_DATA_");
    const res = await helpers.requestAndGetReport(params, 30000);
    const reservedInventoryData = await helpers.txtToArray(res);
    return handleReservedItemsResponse(reservedInventoryData);
  } catch (err) {
    throw new Error(`[productFN - getReservedItems] ${err}`);
  }
};

const handleReservedItemsResponse = (
  reservedItemsResponse
): Map<string, IReservedItem> => {
  let reservedItems = new Map();
  reservedItemsResponse.forEach((item) => {
    const reservedTransferQuantity = parseInt(item["reserved_fc-transfers"]);
    if (reservedTransferQuantity > 0) {
      reservedItems.set(item.sku, {
        sku: item.sku,
        asin: item.asin,
        reservedTransferQuantity,
      });
    }
  });
  return reservedItems;
};

// ******************************
// GETINBOUND & HELPERS
// ******************************

interface IInboundItem {
  sku: string;
  Quantity: number;
}

export const getInbound = async (): Promise<Map<string, IInboundItem>> => {
  try {
    const inboundShipmentsReport = await axios.post(
      helpers.buildURL(
        "ListInboundShipments",
        [
          "ShipmentStatusList.member.1=IN_TRANSIT",
          "ShipmentStatusList.member.2=DELIVERED",
          "ShipmentStatusList.member.3=CHECKED_IN",
          "ShipmentStatusList.member.4=SHIPPED",
          // "ShipmentStatusList.member.4=RECEIVING",
          // "ShipmentStatusList.member.5=SHIPPED"
        ],
        "FulfillmentInboundShipment",
        "2010-10-01"
      )
    );
    const inboundShipments = (await helpers.xmlToObject(
      inboundShipmentsReport.data
    )) as any;
    const reportResult =
      inboundShipments.ListInboundShipmentsResponse
        .ListInboundShipmentsResult[0];
    const InboundQuantities = await handleInboundItems(reportResult);

    let nextToken = reportResult.NextToken;

    while (nextToken) {
      await new Promise((res) => setTimeout(res, 15000));

      let nextResult = await getInboundByNextToken(nextToken);
      nextToken = nextResult.nextToken;

      if (nextResult.inboundItems) {
        nextResult.inboundItems.forEach((i) => {
          let oldInbound = InboundQuantities.get(i.sku);
          if (oldInbound) {
            InboundQuantities.set(i.sku, {
              sku: i.sku,
              Quantity: oldInbound.Quantity + i.Quantity,
            });
            return;
          }
          InboundQuantities.set(i.sku, { sku: i.sku, Quantity: i.Quantity });
        });
      }
    }

    return InboundQuantities;
  } catch (err) {
    console.log(err);
    throw new Error(`[productFN - getInbound] ${err}`);
  }
};

interface getInboundByNextTokenResult {
  inboundItems: Map<string, IInboundItem>;
  nextToken: string;
}

const getInboundByNextToken = async (
  nextToken: string
): Promise<getInboundByNextTokenResult> => {
  const inboundShipmentsReportByNextToken = await axios.post(
    helpers.buildURL(
      "ListInboundShipmentsByNextToken",
      ["NextToken=" + encodeURIComponent(nextToken)],
      "FulfillmentInboundShipment",
      "2010-10-01"
    )
  );

  const inboundShipmentsResponse = (await helpers.xmlToObject(
    inboundShipmentsReportByNextToken.data
  )) as any;
  const reportResult =
    inboundShipmentsResponse.ListInboundShipmentsByNextTokenResponse
      .ListInboundShipmentsByNextTokenResult[0];
  const inboundItems = await handleInboundItemsByNextToken(reportResult);

  nextToken = reportResult.NextToken;
  return {
    inboundItems,
    nextToken,
  };
};

const handleInboundItemsByNextToken = async (
  inboundData
): Promise<Map<string, IInboundItem>> => {
  let itemPromise;
  let InboundQuantities = new Map();
  let items = inboundData.ShipmentData[0].member;

  if (!items || items == null || items == []) {
    return InboundQuantities;
  }
  let itemRequestPromises = [];

  // For each item request seperate more detailed ListInboundShipmentItems report
  items.forEach((item) => {
    itemPromise = axios
      .post(
        helpers.buildURL(
          "ListInboundShipmentItems",
          ["ShipmentId=" + item.ShipmentId[0]],
          "FulfillmentInboundShipment",
          "2010-10-01"
        )
      )
      .then((res) => helpers.xmlToObject(res.data));
    itemRequestPromises.push(itemPromise);
  });

  // Wait for all ListInboundShipmentItems to complete and then process into InboundQuantities Array
  try {
    let itemRequestResponses = await Promise.all(itemRequestPromises);
    itemRequestResponses.forEach((itemRequest) => {
      // @ts-ignore
      let itemResult =
        itemRequest.ListInboundShipmentItemsResponse
          .ListInboundShipmentItemsResult[0];
      let itemQuantity = parseInt(
        itemResult.ItemData[0].member[0].QuantityShipped[0],
        10
      );
      let itemSKU = itemResult.ItemData[0].member[0].SellerSKU[0];

      let oldInbound = InboundQuantities.get(itemSKU);
      if (oldInbound) {
        InboundQuantities.set(itemSKU, {
          sku: itemSKU,
          Quantity: oldInbound.Quantity + itemQuantity,
        });
        return;
      }
      InboundQuantities.set(itemSKU, { sku: itemSKU, Quantity: itemQuantity });
    });
  } catch (err) {
    return Promise.reject({
      path: "[productsFN - handleInboundItems - itemRequestResponses]",
      msg: err,
    });
  }

  return Promise.resolve(InboundQuantities);
};

const handleInboundItems = async (
  inboundData
): Promise<Map<string, IInboundItem>> => {
  let itemPromise;
  let InboundQuantities = new Map();
  let items = inboundData.ShipmentData[0].member;

  if (!items || items == null || items == []) {
    return InboundQuantities;
  }
  let itemRequestPromises = [];

  // For each item request seperate more detailed ListInboundShipmentItems report
  items.forEach((item) => {
    itemPromise = axios
      .post(
        helpers.buildURL(
          "ListInboundShipmentItems",
          ["ShipmentId=" + item.ShipmentId[0]],
          "FulfillmentInboundShipment",
          "2010-10-01"
        )
      )
      .then((res) => helpers.xmlToObject(res.data));
    itemRequestPromises.push(itemPromise);
  });

  // Wait for all ListInboundShipmentItems to complete and then process into InboundQuantities Array
  try {
    let itemRequestResponses = await Promise.all(itemRequestPromises);
    itemRequestResponses.forEach((itemRequest) => {
      // @ts-ignore
      let itemResult =
        itemRequest.ListInboundShipmentItemsResponse
          .ListInboundShipmentItemsResult[0];
      let itemQuantity = parseInt(
        itemResult.ItemData[0].member[0].QuantityShipped[0],
        10
      );
      let itemSKU = itemResult.ItemData[0].member[0].SellerSKU[0];

      let oldInbound = InboundQuantities.get(itemSKU);
      if (oldInbound) {
        InboundQuantities.set(itemSKU, {
          sku: itemSKU,
          Quantity: oldInbound.Quantity + itemQuantity,
        });
        return;
      }
      InboundQuantities.set(itemSKU, { sku: itemSKU, Quantity: itemQuantity });
    });
  } catch (err) {
    return Promise.reject({
      path: "[productsFN - handleInboundItems - itemRequestResponses]",
      msg: err,
    });
  }

  return Promise.resolve(InboundQuantities);
};

// Can only request for 20 items at a time.
const getMyPrice = async () => {
  let params = ["MarketplaceId=" + process.env.MARKETPLACE];
  let innerParam = [];
  const promises = [];

  try {
    const products = await Product.find({});
    let j = 0;
    let recurseNumber = 0;
    for (let i = 1; i < products.length + 1; i++) {
      j += 1;
      let param = "SellerSKUList.SellerSKU." + j;
      innerParam.push(param);

      if (j % 20 == 0) {
        innerParam.sort();
        for (let k = 0; k < innerParam.length; k++) {
          innerParam[k] +=
            "=" + encodeURIComponent(products[k + recurseNumber * 20].SKU);
        }
        params.push(innerParam.join("&"));

        promises.push(
          axios
            .post(
              helpers.buildURL(
                "GetMyPriceForSKU",
                params,
                "Products",
                "2011-10-01"
              )
            )
            .then((res) => helpers.xmlToObject(res.data))
            .then(myPriceHandler)
        );
        params = ["MarketplaceId=" + process.env.MARKETPLACE];
        innerParam = [];
        j = 0;
        recurseNumber += 1;
      }
    }

    if (innerParam.length != 0) {
      innerParam.sort();
      for (let k = 0; k < innerParam.length; k++) {
        innerParam[k] +=
          "=" + encodeURIComponent(products[k + recurseNumber * 20].SKU);
      }
      params.push(innerParam.join("&"));
      promises.push(
        axios
          .post(
            helpers.buildURL(
              "GetMyPriceForSKU",
              params,
              "Products",
              "2011-10-01"
            )
          )
          .then((res) => helpers.xmlToObject(res.data))
          .then(myPriceHandler)
      );
    }

    return await Promise.all(promises);
  } catch (err) {
    throw new Error(err);
  }
};


const myPriceHandler = (myPriceResult) => {
  let items = myPriceResult.GetMyPriceForSKUResponse.GetMyPriceForSKUResult;
  let bulkOps = [];
  return new Promise((resolve, reject) => {
    items.forEach((item) => {
      let SKU = item["$"].SellerSKU;
      let status = item["$"].status;
      if (status == "Success") {
        let offer = item.Product[0].Offers[0].Offer;
        if (offer) {
          const listingPrice = parseFloat(
            offer[0].BuyingPrice[0].ListingPrice[0].Amount[0]
          );
          let update = {
            "current-price": listingPrice,
          };
          bulkOps.push({
            updateOne: {
              filter: { SKU: SKU },
              update: update,
            },
          });
        }
      }
    });
    if (bulkOps.length > 0) {
      Product.bulkWrite(bulkOps, {}, (err, res) => {
        if (err) {
          return reject({
            path: "[productFN - myPriceHandler - product.bulkWrite]",
            msg: err,
          });
        } else {
          console.log(
            "[productFN - myPriceHandler - product.bulkWrite] updated My Prices"
          );
          return resolve();
        }
      });
    }
  });
};

export default {
  handleProducts,
  getInbound,
  getMyPrice,
};

import mongoose from "mongoose";

interface IMerchantShippingRate extends mongoose.Document {
  "amazon-order-id": string;
  "purchase-date": string;
  SKU: string;
  "m-customer": number;
}

const schema = new mongoose.Schema({
  "amazon-order-id": String,
  "purchase-date": String,
  SKU: String,
  "m-customer": Number,
});

const merchantShippingRateModel = mongoose.model<IMerchantShippingRate>(
  "MerchantShippingRate",
  schema
);
export default merchantShippingRateModel;

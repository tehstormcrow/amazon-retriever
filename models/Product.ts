import mongoose from "mongoose";

interface IProductModel extends mongoose.Document {
  SKU: string;
  ASIN: string;
  fulfillment: string;
  quantity: number;
  inbound: number;
  cost: number;
  "ng-amz": number;
  "current-price": number;
  "lowest-price": number;
  "amz-customer": number;
  commision: number;
  ratio: number;
  unused: boolean;
}

const schema = new mongoose.Schema({
  SKU: String,
  ASIN: String,
  fulfillment: String,
  quantity: Number,
  inbound: Number,
  cost: Number,
  "ng-amz": Number,
  "current-price": Number,
  "lowest-price": Number,
  "amz-customer": Number,
  commision: Number,
  ratio: Number,
  unused: Boolean,
});

export default mongoose.model<IProductModel>("Product", schema);

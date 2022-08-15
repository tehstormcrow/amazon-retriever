import mongoose from "mongoose";

interface IMonthlyOrderModel extends mongoose.Document {
  month: string;
  SKU: string;
  orders: number;
  quantity: number;
  price: number;
  "amz-customer": number;
  "m-customer": number;
  commision: number;
  cost: number;
  "ng-amz": number;
}

const schema = new mongoose.Schema({
  month: String,
  SKU: String,
  orders: Number,
  quantity: Number,
  price: Number,
  "amz-customer": Number,
  "m-customer": Number,
  commision: Number,
  cost: Number,
  "ng-amz": Number,
});

schema.virtual("profit").get(function () {
  const mCustomer = this["m-customer"] ? this["m-customer"] : 0;
  return (
    this.price -
    this["amz-customer"] -
    this["commision"] -
    this["cost"] -
    mCustomer -
    this["ng-amz"]
  );
});

const monthlyOrderSchema = mongoose.model<IMonthlyOrderModel>(
  "MonthlyOrder",
  schema
);
export default monthlyOrderSchema;

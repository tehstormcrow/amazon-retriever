import mongoose from "mongoose";

interface IOrderModel extends mongoose.Document {
  "amazon-order-id": string;
  "purchase-date": string;
  "order-status": string;
  items: [
    {
      SKU: string;
      quantity: number;
      price: number;
      "amz-customer": number;
      commision: number;
      cost: number;
      "ng-amz": number;
    }
  ];
}

const schema = new mongoose.Schema({
  "amazon-order-id": String,
  "purchase-date": String,
  "order-status": String,
  items: [
    {
      SKU: String,
      quantity: Number,
      price: Number,
      "amz-customer": Number,
      commision: Number,
      cost: Number,
      "ng-amz": Number,
    },
  ],
});

const orderSchema = mongoose.model<IOrderModel>("Order", schema);
export default orderSchema;

import mongoose from "mongoose";

interface IMonthlyTotalModel extends mongoose.Document {
  month: string;
  products: number;
  orders: number;
  units: number;
  total: number;
  totalPP: number;
  profit: number;
}

const schema = new mongoose.Schema({
  month: String,
  products: Number,
  orders: Number,
  units: Number,
  total: Number,
  totalPP: Number,
  profit: Number,
});

const monthlyTotalSchema = mongoose.model<IMonthlyTotalModel>(
  "MonthlyTotal",
  schema
);
export default monthlyTotalSchema;

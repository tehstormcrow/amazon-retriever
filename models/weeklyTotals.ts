import mongoose from "mongoose";

interface IWeeklyTotalModel extends mongoose.Document {
  week: string;
  products: number;
  orders: number;
  units: number;
  total: number;
  totalPP: number;
  profit: number;
}

const schema = new mongoose.Schema({
  week: String,
  products: Number,
  orders: Number,
  units: Number,
  total: Number,
  totalPP: Number,
  profit: Number,
});

const weeklyTotalSchema = mongoose.model<IWeeklyTotalModel>(
  "WeeklyTotal",
  schema
);
export default weeklyTotalSchema;

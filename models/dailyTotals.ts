import mongoose from "mongoose";

interface IDailyTotalModel extends mongoose.Document {
  day: string;
  dayOfWeek: string;
  products: number;
  orders: number;
  units: number;
  total: number;
  totalPP: number;
  profit: number;
}

const schema = new mongoose.Schema({
  day: String,
  dayOfWeek: String,
  products: Number,
  orders: Number,
  units: Number,
  total: Number,
  totalPP: Number,
  profit: Number,
});

const dailyTotalSchema = mongoose.model<IDailyTotalModel>("DailyTotal", schema);
export default dailyTotalSchema;

import express from "express";
import methodOverride from "method-override";
import * as bodyParser from "body-parser";
import mongoose, { Document, PassportLocalModel } from "mongoose";
import passport from "passport";
import * as LocalStrategy from "passport-local";
import * as path from "path";

// Setting up the node env
if (process.env.NODE_ENV === "production") {
  require("dotenv").config();
} else if (process.env.NODE_ENV === "prodtest") {
  require("dotenv").config({
    path: path.resolve(process.cwd(), ".env.prodtest"),
  });
} else {
  require("dotenv").config({
    path: path.resolve(process.cwd(), ".env.development"),
  });
}

// Custom Functions
import * as moment from "moment-timezone";

import productController from "./controllers/product.controller";
import updateController from "./controllers/update.controller";
import orderController from "./controllers/order.controller";

// Mongoose Models
import User from "./models/user";

moment.tz.setDefault("America/New_York");

mongoose.connect(process.env.MONGODB_URL as string);

const app = express();

app.set("view engine", "ejs");
app.use(express.static(`${__dirname}/public`));
app.use(methodOverride("_method"));
app.use(
  require("express-session")({
    secret: "There has never been a better way to look amazon data my friend",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.currentUser = req.user;

    next();
  }
);

const port = process.env.PORT || 5000;

passport.use(new LocalStrategy.Strategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ //

// PROCEDURE FOR FIRST DATA AT NEW DATABASE

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ //

// // Due to complexity I couldn't merge all this into single function.
// // At first run first getProducts and buildApiParam,
// // then manually enter Product prices in browser

// productController.handleProducts();
// productController.getMyPrice();

// This makes one year pull of orders then cleans up some bad data.
// // It takes around 15 mins, hence requires a lot of wait time.

// updateController.oneYearPull();
// orderController.cleanBadData();

// // This produces daily , weekly, monthly reports for one year.
// updateController.produceReports(365);
// updateController.updateOrder(20000, "2018-03-01", "2018-04-01");

if (process.env.NODE_ENV === "production") {
  try {
    updateController.quarterlyUpdate();
    setTimeout(updateController.dailyUpdate, 1000 * 60);
  
    setInterval(updateController.quarterlyUpdate, 8 * 60 * 1000);
    setInterval(updateController.dailyUpdate, 40 * 60 * 1000);
  } catch (err) {
    console.log(err);
  }
} else if (process.env.NODE_ENV === "prodtest") {
  // no updates run on the main server
  //
  // updateController.produceReports(62);
} else {
  // productController.getInbound();
  // productController.handleProducts();
  updateController.quarterlyUpdate();
  // updateController.dailyUpdate();
}

import fbaMonthlyOrders from "./routes/fba-monthly-orders";
import fbaWeeklyOrders from "./routes/fba-weekly-orders";
import fbaDailyOrders from "./routes/fba-daily-orders";
import fbaVelocityRouter from "./routes/fba-velocity";
import allOrdersRouter from "./routes/all-orders";
import merchantRouter from "./routes/merchant";
import productRouter from "./routes/products";
import summaryRouter from "./routes/summary";
import inventoryRouter from "./routes/inventory";
import indexRouter from "./routes";

// ROUTES
app.use("/fba-monthly-orders", fbaMonthlyOrders);
app.use("/fba-weekly-orders", fbaWeeklyOrders);
app.use("/fba-daily-orders", fbaDailyOrders);
app.use("/fba-velocity", fbaVelocityRouter);
app.use("/all-orders", allOrdersRouter);
app.use("/merchant", merchantRouter);
app.use("/products", productRouter);
app.use("/summary", summaryRouter);
app.use("/inventory", inventoryRouter);
app.use("/", indexRouter);

app.listen(port, () => console.log(`amazon retriever started on port ${port}`));

process.on('uncaughtException', function (err) {
  console.error(err);
});
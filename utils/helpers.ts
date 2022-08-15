import { parseString } from "xml2js";
import axios from "axios";
import * as fs from "fs";
import CryptoJS, { HmacSHA256 } from "crypto-js";
import Product from "../models/Product";
import {
  handleErrorWithAbort,
  handleErrorWithCallback,
  normalizeErr,
} from "./errorUtil";

// Amazon verification constants
const MarketPlace = process.env.MARKETPLACE;
const Merchant = process.env.MERCHANT;
const MWSAuthToken = process.env.MWSAUTHTOKEN;
const AWSAccessKeyId = process.env.AWSACCESSKEYID;
const SecretKey = process.env.SECRETKEY;
const SignatureMethod = "HmacSHA256";

// Amazon request options
const OPTIONS = {
  Host: "mws.amazonservices.com",
  reqHeaders: {
    "x-amazon-user-agent": "ngAR/1.0(Language=Nodejs)",
    "content-type": "text/xml",
  },
};

//TODO: checkStatus  error loggin needs to get better
//TODO: go deeper into understanding, how to handleCatch with callbacks, and what happens to job queue while on it

// Moment time
const moment = require("moment-timezone");
moment.tz.setDefault("America/New_York");

/**
 *
 *@param reqParams : parameters needed for request
 *@param delaytime : delaytime before requesting report result
 */
const requestAndGetReport = async (reqParams: string[], delaytime: number) => {
  try {
    const reqId = await requestReport(reqParams);
    const repId = await waitUntilReportDone(reqId, delaytime);
    return await getReport(repId);
  } catch (err) {
    // throw new Error(err);
    handleErrorWithAbort(err);
  }
};

/**
 * @param reqParams : parameters needed for request
 */
const requestReport = async (reqParams: string[]) => {
  try {
    // const reportResult = await axios.post(buildURL("RequestReport", reqParams), OPTIONS);
    const reportResult = await axios.post(buildURL("RequestReport", reqParams));
    const repRequestResponse: any = await xmlToObject(reportResult.data);
    const reqId =
      repRequestResponse.RequestReportResponse.RequestReportResult[0]
        .ReportRequestInfo[0].ReportRequestId[0];
    return reqId;
  } catch (err) {
    // throw new Error(err);
    handleErrorWithCallback(err, requestReport, [reqParams]);
  }
};

const waitUntilReportDone = async (reqId, delaytime: number) => {
  try {
    console.log("[HELPERS - waitUntilReportDone] reqId: ", reqId);
    await delay(delaytime);
    const reportRequestXMLList = await axios.post(
      buildURL("GetReportRequestList", ["ReportRequestIdList.Id.1=" + reqId])
    );
    const statusReport = await xmlToObject(reportRequestXMLList.data);
    return await checkStatus(statusReport, reqId, delaytime);
  } catch (err) {
    // throw new Error(err);
    handleErrorWithAbort(normalizeErr(err, "[helpers - waitUntilReportDone]"));
  }
};

const checkStatus = async (statusReport, reqId, delaytime) => {
  const requestData =
    statusReport.GetReportRequestListResponse.GetReportRequestListResult[0]
      .ReportRequestInfo[0];
  const processStatus = requestData.ReportProcessingStatus[0];
  console.log(requestData);
  if (processStatus !== "_DONE_" && processStatus !== "_CANCELLED_") {
    console.log(
      "[helpers - checkStatus] wasn't done yet, status: " + processStatus
    );
    return await waitUntilReportDone(reqId, delaytime * 1.2);
  } else {
    console.log(JSON.stringify(requestData, null, 2));
    console.log(processStatus);
    if (processStatus === "_DONE_") {
      const repID = requestData.GeneratedReportId;
      console.log("[helpers - checkstatus] Status is DONE, repID: " + repID);
      return repID;
    } else {
      console.log("[helpers - checkstatus] there was a problem");
    }
  }
};

const getReport = async (repID: string) => {
  try {
    console.log("[helpers - getReport] getting the report with repId: ", repID);
    const report = await axios.post(
      buildURL("GetReport", ["ReportId=" + repID])
    );
    return report.data;
  } catch (err) {
    throw new Error(err);
    // handleErrorWithCallback(err, getReport, [repID]);
  }
};

const delay = (t) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
};

/**
 * Gets xml string and parses it into Js Obj
 * @param {String} data : xml String
 * @returns {Object}
 */
const xmlToObject = (data) => {
  return new Promise((resolve, reject) => {
    parseString(data, (err, xml) => {
      if (err) {
        console.log(data);
        console.log(err);
        reject({ path: "[xmlToObject]", msg: err });
      }
      return resolve(xml);
    });
  });
};

/**
 * @param {String} action : Action for mws api call
 * @param {Array String} params : Extra paramaters for call
 * @param {String} section : Section of api call
 * @param {String} version : Version of api call
 * @returns {String}: return api call url
 */
const buildURL = (
  action,
  params = [],
  section = "",
  version = "2009-01-01"
) => {
  const timestamp = new Date().toISOString();
  const unsignedURL = getUnsignedURL(
    action,
    timestamp,
    params,
    section,
    version
  );
  const signature = getSignature(unsignedURL);
  const signedURL = getSignedUrl(
    signature,
    action,
    timestamp,
    params,
    section,
    version
  );
  return signedURL;
};

/**
 * Combines and sorts to produce URL String ready for Signing
 * @param {String} action : api action
 * @param {String} timestamp : Timestamp String in format 2009-02-10T05:30:20Z
 * @param {Array} params : Array of extra params requested
 * @param {String} section : Api section to use
 * @param {String} version : Version of api section
 * @returns {String} URL string ready for Signing with Crypto Functions
 */
const getUnsignedURL = (action, timestamp, params, section, version) => {
  let apiSelectionString =
    section != "" ? section + "/" + version + "\n" : "\n";
  let urlParts = [];
  let unsignedURL =
    "POST\n" + "mws.amazonservices.com\n" + "/" + apiSelectionString;

  // Puts every Param to url then sorts it
  urlParts.push("AWSAccessKeyId=" + AWSAccessKeyId);
  urlParts.push("Action=" + action);
  urlParts.push("MWSAuthToken=" + MWSAuthToken);
  urlParts.push("SellerId=" + Merchant);
  urlParts.push("SignatureMethod=" + SignatureMethod);
  urlParts.push("SignatureVersion=2");
  urlParts.push("Timestamp=" + encodeURIComponent(timestamp));
  urlParts.push("Version=" + version);
  if (params.length != 0) params.forEach((param) => urlParts.push(param));
  urlParts.sort();
  return unsignedURL + urlParts.join("&");
};

/**
 *
 * @param {String} unsignedURL : url string to signature be produced from
 * @returns : signature String
 */
const getSignature = (unsignedURL) => {
  let signature = HmacSHA256(unsignedURL, SecretKey);
  return CryptoJS.enc.Base64.stringify(signature);
};

/**
 * Returns the final url string
 * @param {String} signature : HmacSHA256 signed and base64 encoded signature string
 * @param {String} action : api action
 * @param {String} timestamp : Timestamp String in format 2009-02-10T05:30:20Z
 * @param {Array} params : Array of extra params requested
 * @param {String} section : Api section to use
 * @param {String} version : Version of api section
 * @returns {String} signed URL
 */
const getSignedUrl = (
  signature,
  action,
  timestamp,
  params,
  section,
  version
) => {
  let urlParts = [];
  let signedURL = section !== "" ? "/" + section + "/" + version : "";
  signedURL += "?AWSAccessKeyId=" + AWSAccessKeyId;

  urlParts.push("Action=" + action);
  urlParts.push("SellerId=" + Merchant);
  urlParts.push("MWSAuthToken=" + MWSAuthToken);
  urlParts.push("SignatureVersion=2");
  urlParts.push("Timestamp=" + encodeURIComponent(timestamp));
  urlParts.push("Version=" + version);
  urlParts.push("Signature=" + encodeURIComponent(signature));
  urlParts.push("SignatureMethod=" + SignatureMethod);
  urlParts.sort();
  if (params.length != 0) params.forEach((param) => urlParts.push(param));
  return (
    "https://mws.amazonservices.com/" + signedURL + "&" + urlParts.join("&")
  );
};

const txtToArray = (data) => {
  const fileArray = [];
  const line = data.split("\n");
  const objKeys = line.splice(0, 1).toString().split("\t");
  line.forEach(function (val) {
    let item = {};
    let itemLine = val.split("\t");
    for (let i = 0; i < itemLine.length; i++) {
      item[objKeys[i]] = itemLine[i];
    }
    fileArray.push(item);
  });
  return fileArray;
};

const fileToArray = (filepath) => {
  const data = fs.readFileSync(filepath);
  return txtToArray(data.toString());
};

const readJsonFile = (filepath: string) => {
  const data = fs.readFileSync(filepath);

  return JSON.parse(data.toString());
};

const writeToFile = (filename, txt) => {
  // @ts-ignore
  let jsoned = JSON.stringify(txt, 0, 2);
  fs.writeFileSync(filename, jsoned);
};

const getProductMap = async () => {
  try {
    const productMap = new Map();
    const products = await Product.find({}).exec();

    products.forEach((product) => {
      productMap.set(product.SKU, product);
    });

    return productMap;
  } catch (err) {
    throw new Error(`[Helpers - getProductMap - ProductFind] ${err}`);
  }
};

const nDaysBefore = (n) => {
  return moment().subtract(n, "day").format().substring(0, 10);
};

const nWeeksBefore = (n) => {
  return moment().subtract(n, "week").format().substring(0, 10);
};

const nMonthBefore = (n) => {
  return moment().subtract(n, "month").format().substring(0, 7);
};

export default {
  xmlToObject,
  delay,
  requestAndGetReport,
  buildURL,
  OPTIONS,
  fileToArray,
  readJsonFile,
  txtToArray,
  writeToFile,
  getProductMap,
  nDaysBefore,
  nWeeksBefore,
  nMonthBefore,
  normalizeErr,
  handleErrorWithAbort,
  handleErrorWithCallback,
};

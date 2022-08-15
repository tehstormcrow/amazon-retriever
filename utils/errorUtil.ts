import helpers from "./helpers";

export const normalizeErr = (err, path) => {
  if (err.msg || err.path) {
    return { path: path + err.path, msg: err.msg };
  }
  return { path, msg: err };
};

export const handleErrorWithCallback = (err, callback, Params) => {
  console.log("error path: " + err.path);
  console.log("Callbacked error msg: " + err.msg);
  return helpers.delay(Params.delaytime * 2).then(callback(...Params));
};

export const handleErrorWithAbort = err => {
  console.log("error path: " + err.path);
  console.log("Aborted error msg: " + err.msg);
  return Promise.reject({ path: "Propageted from : " + err.path, msg: "Propageted message" });
};

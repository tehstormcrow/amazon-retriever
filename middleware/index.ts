import { isOnProduction } from "../utils/isOnProduction";

export const isLoggedIn = (req, res, next) => {
  if (!isOnProduction()) {
    return next();
  }

  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect("/login");
};

export default { isLoggedIn };

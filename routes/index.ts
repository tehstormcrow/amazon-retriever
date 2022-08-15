import express from "express";
const router = express.Router();

import passport from "passport";

router.get("/", (req, res) => {
  res.render("main");
});

router.get("/login", (req, res) => {
  res.render("login");
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/fba-velocity",
    failureRedirect: "/login"
  }),
  (req, res) => {}
);

router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

// router.get('/signup', (req, res) => {
//   res.render('signup');
// })

// router.post('/signup', (req, res) => {
//   User.register(new User({username: req.body.username}), req.body.password,
//   (err, user) => {
//     if(err) {
//       console.log(err);
//       return res.render('signup');
//     }
//     passport.authenticate('local')(req, res, () => {
//       res.redirect('/');
//     });
//   })
// })

export default router;

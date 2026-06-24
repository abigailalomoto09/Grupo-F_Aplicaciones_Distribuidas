const express = require("express");
const passport = require("passport");

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/"
  }),
  (req, res) => {

    res.redirect("/lobby");
  }
);

router.get("/me", (req, res) => {

  if (!req.isAuthenticated()) {
    return res.status(401).json({
      authenticated: false
    });
  }

  res.json({
    authenticated: true,
    username: req.user.username,
    email: req.user.email,
    photo: req.user.photo
  });
});

router.get("/logout", (req, res) => {

  req.logout(() => {
    res.redirect("/");
  });
});

module.exports = router;
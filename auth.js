const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const Jugador = require("./models/Jugador");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {

      try {

        let jugador = await Jugador.findOne({
          googleId: profile.id
        });

        if (!jugador) {
          // Generar username único usando parte del googleId como sufijo
          const baseUsername = profile.displayName.replace(/\s+/g, "_").slice(0, 20);
          const suffix = profile.id.slice(-4);
          const username = `${baseUsername}_${suffix}`;

          jugador = await Jugador.create({
            googleId: profile.id,
            username,
            email: profile.emails?.[0]?.value,
            photo: profile.photos?.[0]?.value
          });
        }
        return done(null, jugador);

      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {

  try {

    const jugador = await Jugador.findById(id);

    done(null, jugador);

  } catch (error) {

    done(error, null);
  }
});
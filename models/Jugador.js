const mongoose = require("mongoose");

const JugadorSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    default: null
  },
  email: {
    type: String,
    default: null
  },
  photo: {
    type: String,
    default: null
  },
  socketId: {
    type: String,
    default: ""
  },
  online: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    default: 0
  },
  ultimoAcceso: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Jugador", JugadorSchema);

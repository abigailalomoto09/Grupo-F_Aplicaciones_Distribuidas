const mongoose = require("mongoose");

const JugadorSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
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

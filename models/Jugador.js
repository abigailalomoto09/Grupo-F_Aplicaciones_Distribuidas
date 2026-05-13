const mongoose = require("mongoose");

const JugadorSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  socketId: { 
    type: String 
  },
  online: { 
    type: Boolean, 
    default: false 
  },
  ultimoAcceso: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model("Jugador", JugadorSchema);

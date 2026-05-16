const mongoose = require("mongoose");

const PartidaSchema = new mongoose.Schema({

    codigo: {
        type: String,
        default: "PARTIDA-1"
    },

    jugadores: [{
        type: String
    }],

    estado: {
        type: String,
        default: "esperando"
    },

    tiempoRonda: {
        type: Number,
        default: 20
    }

});

module.exports = mongoose.model("Partida", PartidaSchema);
const mongoose = require("mongoose");
const { info } = require("./logger");

const conectarDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado");
    info("DB_CONNECTED", "MongoDB conectado correctamente");
  } catch (error) {
    throw error;
  }
};

module.exports = conectarDB;

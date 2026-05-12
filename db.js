const mongoose = require("mongoose");

const conectarDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado");
  } catch (error) {
    console.log(error);
  }
};

module.exports = conectarDB;
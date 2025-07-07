const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const routes = require("./routes");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", routes);

const PORT = process.env.PORT || 5000;

mongoose
  .connect("	mongodb+srv://Salman:pr7vl29nrek87fL0@cluster0.sqkwm.mongodb.net/ecommerce?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.log(err));

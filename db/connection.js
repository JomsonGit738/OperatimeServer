const mongoose = require("mongoose");

const connectionString = process.env.DATABASE;

if (!connectionString) {
  console.error("❌ DATABASE env var is not set. Add it to your .env file.");
  process.exit(1);
}

mongoose
  .connect(connectionString, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then((data) => {
    console.log("MongoDB connection successful!");
  })
  .catch((error) => {
    console.log(error, "MongoDB connection error!");
  });


const mongoose = require('mongoose')

const connectionString = process.env.DATABASE

mongoose.connect(connectionString,{
    useUnifiedTopology:true,
    useNewUrlParser:true
}).then((data)=>{
    console.log("MongoDB connection successful!");
}).catch((error)=>{
    console.log(error,"MongoDB connection error!");
})
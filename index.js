require("dotenv").config();

const dns = require("node:dns");
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')

require('./db/connection')

const router = require('./Routers/router')

const server = express()

const PORT = process.env.PORT || 3000
const allowedOrigins = (process.env.FRONTEND_ORIGINS ||
  'http://localhost:4200,https://operatimebooking.netlify.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

//server usages
server.use(cors({
  origin(origin, callback) {
    // Requests without Origin include same-origin proxy traffic and server-side tools.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Origin is not allowed by CORS'))
  },
  credentials: true,
}))
server.use(express.json())
server.use(cookieParser())
server.use('/api', router)

server.listen(PORT,()=>{
    console.log(`Server started at PORT: ${PORT}`);
})

server.get('/',(request,response)=>{
    response.send("<h3>server is Online...</h3>")
})

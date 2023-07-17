
require('dotenv').config()
const express = require('express')
const cors = require('cors')

require('./db/connection')

const router = require('./Routers/router')

const server = express()

const PORT = 3000 || process.env.PORT

//server usages
server.use(cors())
server.use(express.json())
server.use(router)

server.listen(PORT,()=>{
    console.log(`Server started at PORT: ${PORT}`);
})

server.get('/',(request,response)=>{
    response.send("<h3>server is Online...</h3>")
})
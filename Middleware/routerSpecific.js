
const jwt = require('jsonwebtoken')

const loginMiddleware = (req,res,next)=>{

    const authHeader = req.headers['authorization']
    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({message:'Missing or invalid authorization header'})
    }

    const token = authHeader.replace('Bearer ','').trim()

    try{
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "supersecreatkey12345")
        req.userEmail = decoded.userEmail
        next()
    }catch(error){
        res.status(401).json({message:'Please log in to continue'})
    }
}

module.exports = {
    loginMiddleware
}

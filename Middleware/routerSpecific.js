
const jwt = require('jsonwebtoken')

const loginMiddleware = (req,res,next)=>{

    const token = req.headers['access-token']

    try{
        const jwtresponse = jwt.verify(token,"supersecreatkey12345")
        //console.log(jwtresponse.userEmail);
        next()
    }catch(error){
        res.status(401).json('Please log in to continue')
    }
}

module.exports = {
    loginMiddleware
}
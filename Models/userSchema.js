const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    username:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        // Google-only accounts do not receive a shared placeholder password.
        required:false
    },
    googleSub:{
        type:String,
        unique:true,
        sparse:true
    },
    photo:{
        type:String,
        default:""
    },
    tickets:{
        type:Array,
        required:true
    }
})

const users = mongoose.model("users",userSchema)

module.exports = users

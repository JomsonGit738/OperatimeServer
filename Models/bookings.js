const mongoose = require('mongoose')

const bookingSchema = mongoose.Schema({
    date:{
        type:String,
        required:true
    },
    movietitle:{
        type:String,
        required:true
    },
    operaId:{
        type:String,
        required:true,
        unique:true
    },
    userseats:{
        type:Array,
        required:true
    }
})
//only one movie a day

const bookings = mongoose.model("bookings",bookingSchema)

module.exports = bookings
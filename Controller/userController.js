const users = require('../Models/userSchema')
const bookings = require('../Models/bookings')


//Sign Up
exports.signup = async (request,response)=>{

    const {username,email,password} = request.body

    //if any inputs are empty
    if(!username || !email || !password){
        response.status(403).json("all inputs are required...")
    }

    try{
        //if a user exitst in the same email ID
        const existingUser = await users.findOne({email})
        if(existingUser){
            response.status(406).json("A user already used this Email, try with another email id")
        }
        else{
            //if new User sign-Up
            const newuser = new users({
                username,
                email,
                password,
                tickets:[]
            })
            await newuser.save()
            response.status(200).json(newuser)
        }
    }
    catch(error){
        response.status(401).json(error)
    }
}

//LogIn
exports.login = async (request,response)=>{
    // console.log(request.body);
    const {email,password} = request.body

    try{

        const existingUser = await users.findOne({email,password})
        if(existingUser){
            response.status(200).json(existingUser)
        } else {
            response.status(404).json("Email & password are not matching, check again...")
        }

    }catch(error){
        response.status(401).json(error)
    }
}

//Google Sign In
exports.GoogleSignIn = async (request,response)=>{
    const {email,username} = request.body
    try{

        const existingGoogleUser = await users.findOne({email,username})
        if(existingGoogleUser){
            response.status(200).json(existingGoogleUser)
        } else {
            //if new User sign-Up
            const newuser = new users({
                username,
                email,
                password:'#23Gsin',
                tickets:[]
            })
            await newuser.save()
            response.status(200).json(newuser)
        }

    }catch(error){

    }
}

//get current User Details
exports.getUserDetails = async (request,response)=>{
    const {email} = request.body
    try{
        const user = await users.findOne({email})
        if(user){
            response.status(200).json(user)
        } else {
            response.status(402).json("No such a user data with this email")
        }
    }catch(error){
        response.status(401).json(error)
    }
}

//seatbooking
exports.seatBooking = async (request,response)=>{
    console.log(request.body);
    const {date,operaId,movietitle,seats,email,time,mimage} = request.body
    if(!date || !movietitle || !seats || !email || !time || !mimage){
        response.status(403).json("all inputs not reached...")
    }
    try{
        //checking movie data is expired
        //if movie has existing data in DB
        const booked = await bookings.findOne({movietitle})
        if(booked && booked.operaId == operaId){
            //pushing to userSeats to movie:
            booked.userseats.push({
                    "date":date,
                    "seats":seats,
                    "time":time,
                    "email":email 
            })
            await booked.save()
            //pushing seat details to the user who booked 
            const end_user = await users.findOne({email})
            if(end_user){
                end_user.tickets.push({
                    "date":date,
                    "seats":seats,
                    "time":time,
                    "operaId":operaId,
                    "movietitle":movietitle,
                    "mimage":mimage
                })
            }
            await end_user.save()
            //console.log("updated existing movie booking");
            response.status(200).json("updating existing movie booking")
        } else{
            //first time creating movie data
            const newbookings = new bookings({
                date,
                movietitle,
                operaId,
                userseats:[{
                    "date":date,
                    "seats":seats,
                    "time":time,
                    "email":email    
                }]
            })
            await newbookings.save()
            //pushing seat details to the user who booked 
            const end_user = await users.findOne({email})
            if(end_user){
                end_user.tickets.push({
                    "date":date,
                    "seats":seats,
                    "time":time,
                    "operaId":operaId,
                    "movietitle":movietitle,
                    "mimage":mimage
                })
            }
            await end_user.save()
            
            response.status(200).json(newbookings)
        }


        //response.status(200).json(request.body)

    }catch(error){
        console.log(error)
        response.status(401).json(error)
    }    
}

//getBookedseats for today
exports.getBookedSeats = async (request,response)=>{
    const movietitle = request.params.id
    let newDate = new Date();
    try{
        const movie = await bookings.find({movietitle})
        //en-GB british format day/month/year
        let data = movie.find((item)=>item.date == newDate.toLocaleDateString('en-GB'))
        if(data){
            response.status(200).json(data)
        } else {
            response.status(204).json('movie data not found')
        }
    }catch(error){
        response.status(401).json(error)
    }

}
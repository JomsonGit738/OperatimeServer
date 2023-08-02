const express = require('express')

const router = new express.Router()

const middleware = require('../Middleware/routerSpecific')

const userController =  require('../Controller/userController')


//router for signUp
router.post('/user/signup',userController.signup)

//router for login
router.post('/user/login',userController.login)

//router for Google Sign In
router.post('/user/gosin',userController.GoogleSignIn)

//get user details
router.post('/user/details',userController.getUserDetails)

//router for seatBooking
router.post('/booking',middleware.loginMiddleware,userController.seatBooking)

//router for getBookedSeats
router.get('/getseats/:id',userController.getBookedSeats)


module.exports = router
const express = require('express')

const router = new express.Router()

const middleware = require('../Middleware/routerSpecific')

const userController =  require('../Controller/userController')
const movieController = require('../Controller/movieController')


//router for signUp
router.post('/user/signup',userController.signup)

//router for login
router.post('/user/login',userController.login)

//router for Google Sign In
router.post('/user/gosin',userController.GoogleSignIn)

// The session cookie, not a browser-supplied email, identifies the current user.
router.get('/user/me',middleware.loginMiddleware,userController.getCurrentUser)

// Public pages use this endpoint to discover a session without producing a guest 401.
router.get('/user/session',middleware.optionalLoginMiddleware,userController.getOptionalSession)

router.post('/user/logout',userController.logout)

//router for seatBooking
router.post('/booking',middleware.loginMiddleware,userController.seatBooking)

//router for getBookedSeats
router.get('/getseats/:id',userController.getBookedSeats)

// Explicit proxy routes prevent the backend from becoming an arbitrary URL proxy.
router.get('/movies/popular',movieController.getPopular)
router.get('/movies/genres',movieController.getGenres)
router.get('/movies/now-playing',movieController.getNowPlaying)
router.get('/movies/search',movieController.search)
router.get('/movies/:id/full',movieController.getFullMovie)
router.get('/movies/:id',movieController.getMovie)

module.exports = router

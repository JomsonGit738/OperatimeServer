const users = require("../Models/userSchema");
const bookings = require("../Models/bookings");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "dev-access-secret";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const issueAccessToken = (email) =>
  jwt.sign({ userEmail: email }, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const sanitizeUser = (user) => ({
  username: user.username,
  email: user.email,
  tickets: user.tickets,
});

//Sign Up
exports.signup = async (request, response) => {
  const { username, email, password } = request.body;

  //if any inputs are empty
  if (!username || !email || !password) {
    response.status(403).json("all inputs are required...");
  }

  try {
    //if a user exitst in the same email ID
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      response
        .status(406)
        .json("A user already used this Email, try with another email id");
    } else {
      //if new User sign-Up
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const newuser = new users({
        username,
        email,
        password: hashedPassword,
        tickets: [],
      });
      await newuser.save();
      response.status(200).json({ user: sanitizeUser(newuser) });
    }
  } catch (error) {
    response.status(401).json(error);
  }
};

//LogIn
exports.login = async (request, response) => {
  // console.log(request.body);
  const { email, password } = request.body;

  try {
    const existingUser = await users.findOne({ email });
    if (!existingUser) {
      return response
        .status(404)
        .json("Email & password are not matching, check again...");
    }

    const isHashed = existingUser.password.startsWith("$2");
    const passwordMatches = isHashed
      ? await bcrypt.compare(password, existingUser.password)
      : existingUser.password === password;

    if (!passwordMatches) {
      return response
        .status(404)
        .json("Email & password are not matching, check again...");
    }

    if (!isHashed) {
      // upgrade legacy plain-text passwords
      existingUser.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await existingUser.save();
    }

    const token = issueAccessToken(email);

    response.status(200).json({ user: sanitizeUser(existingUser), token });
  } catch (error) {
    response.status(401).json(error);
  }
};

//Google Sign In
exports.GoogleSignIn = async (request, response) => {
  const { email, username } = request.body;
  try {
    let existingUser = await users.findOne({ email });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash("#23Gsin", BCRYPT_ROUNDS);
      existingUser = new users({
        username,
        email,
        password: hashedPassword,
        tickets: [],
      });
      await existingUser.save();
    }

    const token = issueAccessToken(email);
    response.status(200).json({ user: sanitizeUser(existingUser), token });
  } catch (error) {
    response.status(401).json(error);
  }
};

//get current User Details
exports.getUserDetails = async (request, response) => {
  const { email } = request.body;
  try {
    const user = await users.findOne({ email });
    if (user) {
      response.status(200).json(user);
    } else {
      response.status(402).json("No such a user data with this email");
    }
  } catch (error) {
    response.status(401).json(error);
  }
};

//seatbooking
exports.seatBooking = async (request, response) => {
  //console.log(request.body);
  const { date, operaId, movietitle, seats, email, time, mimage } =
    request.body;
  const userEmail = request.userEmail || email;
  if (!date || !movietitle || !seats || !userEmail || !time || !mimage) {
    response.status(403).json("all inputs not reached...");
  }
  try {
    //checking movie data is expired
    //if movie has existing data in DB
    const booked = await bookings.findOne({ movietitle });
    if (booked && booked.operaId == operaId) {
      //pushing to userSeats to movie:
      booked.userseats.push({
        date: date,
        seats: seats,
        time: time,
        email: userEmail,
      });
      await booked.save();
      //pushing seat details to the user who booked
      const end_user = await users.findOne({ email: userEmail });
      if (end_user) {
        end_user.tickets.push({
          date: date,
          seats: seats,
          time: time,
          operaId: operaId,
          movietitle: movietitle,
          mimage: mimage,
        });
      }
      await end_user.save();
      //console.log("updated existing movie booking");
      response.status(200).json("updating existing movie booking");
    } else {
      //first time creating movie data
      const newbookings = new bookings({
        date,
        movietitle,
        operaId,
        userseats: [
          {
            date: date,
            seats: seats,
            time: time,
            email: userEmail,
          },
        ],
      });
      await newbookings.save();
      //pushing seat details to the user who booked
      const end_user = await users.findOne({ email: userEmail });
      if (end_user) {
        end_user.tickets.push({
          date: date,
          seats: seats,
          time: time,
          operaId: operaId,
          movietitle: movietitle,
          mimage: mimage,
        });
      }
      await end_user.save();

      response.status(200).json(newbookings);
    }

    //response.status(200).json(request.body)
  } catch (error) {
    console.log(error);
    response.status(401).json(error);
  }
};

//getBookedseats for today
// exports.getBookedSeats = async (request, response) => {
//   const movietitle = request.params.id;
//   let newDate = new Date();
//   try {
//     console.log(movietitle);
//     const movie = await bookings.find({ movietitle });
//     //en-GB british format day/month/year
//     let data = movie.find(
//       (item) => item.date == newDate.toLocaleDateString("en-GB")
//     );
//     if (data) {
//       response.status(200).json(data);
//     } else {
//       response.status(204).json("movie data not found");
//     }
//   } catch (error) {
//     response.status(401).json(error);
//   }
// };

exports.getBookedSeats = async (request, response) => {
  const movietitle = request.params.id;
  const today = new Date().toLocaleDateString("en-GB"); // dd/mm/yyyy

  try {
    console.log(movietitle);

    const movies = await bookings.find({ movietitle });
    console.log(movies);
    const data = movies.find((item) => item.date === today);

    if (data) {
      return response
        .status(200)
        .json({ status: 200, message: "ok", data: data });
    }

    return response
      .status(200)
      .json({ status: 204, message: "not found", data: null });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: "server error", error });
  }
};

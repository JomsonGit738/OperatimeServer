const users = require("../Models/userSchema");
const bookings = require("../Models/bookings");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const {
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  GOOGLE_CLIENT_ID,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} = require("../config/security");

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const issueAccessToken = (user) =>
  jwt.sign({ userEmail: user.email }, ACCESS_TOKEN_SECRET, {
    subject: user.id,
    audience: "operatime-web",
    issuer: "operatime-server",
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

const sanitizeUser = (user) => ({
  username: user.username,
  email: user.email,
  tickets: user.tickets,
  photo: user.photo || "",
});

const hasLegacyGooglePassword = async (password) =>
  Boolean(
    password &&
      (password === "#23Gsin" ||
        (password.startsWith("$2") &&
          (await bcrypt.compare("#23Gsin", password))))
  );

const startSession = (response, user) => {
  response.cookie(
    SESSION_COOKIE_NAME,
    issueAccessToken(user),
    sessionCookieOptions()
  );
};

//Sign Up
exports.signup = async (request, response) => {
  const { username, password } = request.body;
  const email = request.body.email?.trim().toLowerCase();

  //if any inputs are empty
  if (!username || !email || !password) {
    return response.status(400).json("all inputs are required...");
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
      return response.status(201).json({ user: sanitizeUser(newuser) });
    }
  } catch (error) {
    return response.status(500).json({ message: "Unable to create user" });
  }
};

//LogIn
exports.login = async (request, response) => {
  // console.log(request.body);
  const { password } = request.body;
  const email = request.body.email?.trim().toLowerCase();

  try {
    const existingUser = await users.findOne({ email });
    if (!existingUser) {
      return response
        .status(404)
        .json("Email & password are not matching, check again...");
    }

    if (!password || !existingUser.password) {
      return response
        .status(401)
        .json("This account uses Google sign-in.");
    }

    // Older Google accounts used this shared placeholder; never accept it as a login.
    const isLegacyGooglePassword = await hasLegacyGooglePassword(
      existingUser.password
    );
    if (isLegacyGooglePassword) {
      return response
        .status(401)
        .json("This account uses Google sign-in.");
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

    startSession(response, existingUser);
    return response.status(200).json({ user: sanitizeUser(existingUser) });
  } catch (error) {
    return response.status(500).json({ message: "Unable to log in" });
  }
};

//Google Sign In
exports.GoogleSignIn = async (request, response) => {
  const { idToken } = request.body;
  if (!idToken) {
    return response.status(400).json({ message: "Google ID token is required" });
  }
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    return response
      .status(503)
      .json({ message: "Google sign-in is not configured" });
  }

  try {
    // Only Google can sign this token; browser-supplied email/name fields are not trusted.
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified || !payload.sub) {
      return response
        .status(401)
        .json({ message: "Google email is not verified" });
    }

    const email = payload.email.toLowerCase();
    const username = payload.name || email.split("@")[0];
    let existingUser = await users.findOne({ email });
    if (!existingUser) {
      existingUser = new users({
        username,
        email,
        tickets: [],
        photo: payload.picture || "",
        googleSub: payload.sub,
      });
      await existingUser.save();
    } else {
      if (
        existingUser.googleSub &&
        existingUser.googleSub !== payload.sub
      ) {
        return response
          .status(409)
          .json({ message: "Google identity does not match this account" });
      }

      existingUser.googleSub = payload.sub;
      if (payload.picture) {
        existingUser.photo = payload.picture;
      }

      // Upgrade accounts created by the old shared-placeholder implementation.
      if (
        await hasLegacyGooglePassword(existingUser.password)
      ) {
        existingUser.password = undefined;
      }
      await existingUser.save();
    }

    startSession(response, existingUser);
    return response.status(200).json({ user: sanitizeUser(existingUser) });
  } catch (error) {
    return response.status(401).json({ message: "Google sign-in failed" });
  }
};

//get current User Details
exports.getCurrentUser = async (request, response) => {
  try {
    const user = await users.findById(request.userId);
    if (user) {
      return response.status(200).json(sanitizeUser(user));
    } else {
      return response.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    return response.status(500).json({ message: "Unable to load user" });
  }
};

exports.getOptionalSession = async (request, response) => {
  if (!request.userId) {
    return response.status(200).json(null);
  }

  try {
    const user = await users.findById(request.userId);
    return response.status(200).json(user ? sanitizeUser(user) : null);
  } catch {
    // Session discovery must not make public pages fail for guests.
    return response.status(200).json(null);
  }
};

exports.logout = (_request, response) => {
  const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
  response.clearCookie(SESSION_COOKIE_NAME, clearOptions);
  return response.status(204).send();
};

//seatbooking
exports.seatBooking = async (request, response) => {
  //console.log(request.body);
  const { date, operaId, movietitle, seats, time, mimage } = request.body;
  const userEmail = request.userEmail;
  if (
    !date ||
    !operaId ||
    !movietitle ||
    !Array.isArray(seats) ||
    seats.length === 0 ||
    !time ||
    !mimage
  ) {
    return response.status(400).json("all inputs not reached...");
  }
  try {
    const end_user = await users.findById(request.userId);
    if (!end_user) {
      return response.status(404).json({ message: "User not found" });
    }

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
      end_user.tickets.push({
        date: date,
        seats: seats,
        time: time,
        operaId: operaId,
        movietitle: movietitle,
        mimage: mimage,
      });
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
      end_user.tickets.push({
        date: date,
        seats: seats,
        time: time,
        operaId: operaId,
        movietitle: movietitle,
        mimage: mimage,
      });
      await end_user.save();

      response.status(200).json(newbookings);
    }

    //response.status(200).json(request.body)
  } catch (error) {
    console.log(error);
    response.status(500).json({ message: "Unable to save booking" });
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
    const movies = await bookings.find({ movietitle });
    const data = movies.find((item) => item.date === today);

    if (data) {
      // Seat availability is public, but customer emails are not.
      const safeData = {
        date: data.date,
        movietitle: data.movietitle,
        operaId: data.operaId,
        userseats: data.userseats.map(({ seats }) => ({ seats })),
      };
      return response
        .status(200)
        .json({ status: 200, message: "ok", data: safeData });
    }

    return response
      .status(200)
      .json({ status: 204, message: "not found", data: null });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: "server error" });
  }
};

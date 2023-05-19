const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// authenticate jwtToken

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ganeshgajarla", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        // request.username = payload.username;
        next();
      }
    });
  }
};

// API 1 register
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const isUserExists = `SELECT  *  FROM  user  WHERE  username = "${username}";`;
  const dbResponse = await db.get(isUserExists);

  if (dbResponse === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createNewUserQuery = `INSERT INTO user(username,password,name,gender) VALUES ("${username}","${hashedPassword}","${name}","${gender}");`;
      await db.run(createNewUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API 2 log in and generate jwt token
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const isUserExists = `SELECT *  FROM  user  WHERE  username = "${username}";`;
  const dbResponse = await db.get(isUserExists);

  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrect = await bcrypt.compare(password, dbResponse.password);
    if (isCorrect === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "ganeshgajarla");
      response.status(200);
      response.send({ jwtToken: jwtToken });
    }
  }
});

// API-3 GET
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  //   let { username } = request;
  //   console.log(username);
  const getUserId = ` select T.username,T.tweet,T.date_time from (user inner join tweet on user.user_id=tweet.user_id )as T inner join follower on T.user_id = follower.following_user_id order by T.date_time desc limit 4;`;
  const dbResponse = await db.all(getUserId);
  response.send(dbResponse);
});

// API-4 GET
app.get("/user/following/", authenticateToken, async (request, response) => {
  const getFollowingList = `select user.name as name from user inner join follower on user.user_id = follower.follower_user_id;`;
  const dbResponse = await db.all(getFollowingList);
  response.send(dbResponse);
});

// API-5 /user/followers/

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getFollowerList = `select user.name as name from user inner join follower on user.user_id = follower.following_user_id;`;
  const dbResponse = await db.all(getFollowerList);
  response.send(dbResponse);
});

// API-6 GET
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const requestTweet = `select t.tweet as tweet,count(like.like_id) as likes, count(reply.reply_id) as replies, T.date_time as dateTime from (tweet inner join follower on tweet.user_id = follower.follower_user_id) as t inner join like on t.tweet_id=like.tweet_id inner join reply on t.tweet_id = reply.tweet_id where tweet.tweet_id = ${tweetId}`;
  const dbResponse = await db.get(requestTweet);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid Request");
  } else {
    response.send(dbResponse);
  }
});

//API-9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getTweet = `select  t.tweet, count(t.like_id) as likes, count(reply.reply_id) as replies, t.date_time as dateTime from (tweet inner join like on tweet.tweet_id= like.tweet_id) as t inner join reply on t.tweet_id = reply.tweet_id;`;
  const dbResponse = await db.all(getTweet);
  response.send(dbResponse);
});

// API-11 /tweets/:tweetId/
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
    const dbResponse = await db.run(deleteQuery);
    response.send("Tweet Removed");
  }
);

// API-10 /user/tweets/
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const createTweetQuery = `INSERT INTO tweet(tweet)VALUES("${tweet}");`;
  const dbResponse = await db.run(createTweetQuery);
  response.send("Created a Tweet");
});
module.exports = app;

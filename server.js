const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const Post = require("./models/Post");
const bcrypt = require("bcryptjs");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");
// app.use(cors());
app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
const uploadMiddleware = multer({ dest: "uploads/" });
const { resourceUsage } = require("process");

const salt = bcrypt.genSaltSync(10);
const secret = "asdfe45we45w345wegw345werjktjwertkj";
// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(
  "mongodb+srv://dushyantist:Z9i1WxjJMtb9J8Sh@cluster0.fp93jzi.mongodb.net/?retryWrites=true&w=majority"
);

app.get("/", (req, res) => {
  res.send("backend is running...");
});
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      // res.cookie("token", token).json({
      res.cookie("token", token, { domain: 'http://localhost:3000', httpOnly: true, secure: true }).json({
        id: userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json("wrong credentials");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      likes: [],
      author: info.id,
    });
    res.json(postDoc);
  });
});

app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("you are not the author");
    }
    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });

    res.json(postDoc);
  });
});

app.get("/post", async (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      res.status(400).json([]);
    } else {
      res
        .status(200)
        .json(
          await Post.find()
            .populate("author", ["username"])
            .sort({ createdAt: -1 })
            .limit(20)
        );
    }
  });
});

app.get("/post/:id", async (req, res) => {
  const { token } = req.cookies;
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate("author", ["username"]);
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) {
      res.status(400).json([]);
    } else {
      res.status(200).json(postDoc);
    }
  });
});

app.post("/post/:postId/like", async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.body.userInfo.id; // Assuming you're using a user authentication middleware and storing user info in req.user

    const post = await Post.findById(postId);
    
    const alreadyLiked = post.likes.includes(userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((like) => like !== userId);
    } else {
      post.likes.push(userId);
    }
    await post.save();
    
    res.status(200).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.listen(4000);
//
module.exports = app;

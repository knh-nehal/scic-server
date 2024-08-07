const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;
const app = express();
require("dotenv").config();
const bcrypt = require("bcrypt");

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
// Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.talr0yk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // collections
    const usersCollection = client.db("mfsDB").collection("users");

    // Verify JWT token
    const verifyToken = (req, res, next) => {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).send({ message: "Access Denied" });
      }
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Authorization Denied" });
        }
        req.user = decoded;
        next();
      });
    };

    // APIs

    // register user
    app.post("/register", async (req, res) => {
      const saltRounds = 10;
      let userData = req.body;
      const { email, pin } = userData;
      // check if user exists
      const user = await usersCollection.findOne({ email });
      if (user) {
        return res.status(400).send({ message: "User already exists" });
      }
      const hash = bcrypt.hashSync(pin, saltRounds);
      userData.pin = hash;
      // create user
      const newUser = await usersCollection.insertOne(userData);
      res.send(newUser);
    });

    // login user
    app.post("/login", async (req, res) => {
      const { id, pin } = await req.body;
      const user = await usersCollection.findOne({
        $or: [{ email: id }, { number: id }],
      });
      if (!user) {
        return res.status(400).send({ message: "User not found" });
      }
      const match = bcrypt.compareSync(pin, user.pin);
      if (!match) {
        return res.status(400).send({ message: "Invalid credentials" });
      }
      const token = jwt.sign(
        {
          id,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "365d",
        }
      );
      res.send({ token, user });
    });

    // get user
    app.get("/userInfo", verifyToken, async (req, res) => {
      const userId = await req.user;
      //   console.log(userId);
      const user = await usersCollection.findOne({
        $or: [{ email: userId.id }, { number: userId.id }],
      });
      res.send(user);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

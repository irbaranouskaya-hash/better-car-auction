import express, { type Request, type Response } from "express";
import { config } from "./config.js";
import connectDB from "./db.js";
import routes from "./routes/index.js";

const app = express();
const PORT = config.port;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Better Car Auction! Visit /api for API endpoints.");
});

app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  connectDB();
});
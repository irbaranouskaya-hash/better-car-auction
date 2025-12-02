import express, { type Request, type Response } from "express";
import { config } from "./config.js";
import { initDatabase } from "./db/index.js";
import { connectRedis } from "./redis.js";
import routes from "./routes/index.js";
import cors from "cors";

const app = express();
const PORT = config.port;

app.use(cors({
  origin: config.clientUrl,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from Better Car Auction! Visit /api for API endpoints.");
});

app.use("/api", routes);

app.listen(PORT, async () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  await initDatabase();
  await connectRedis();
});
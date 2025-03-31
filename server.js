import express from "express";
import bodyParser from "body-parser";
import routes from "./routes/index.js";
import cors from "cors";
import { getAllWorkspacesDetailedStats } from "./api-test.js";

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use("/api", routes);

app.listen(7777, async () => {
  console.log(`Server is running on port 7777.`);
  await getAllWorkspacesDetailedStats();
});

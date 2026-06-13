import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).send("live");
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.all("/webhooks/answer", (req, res) => {
  console.log("ANSWER HIT", req.method, req.query, req.body);
  res.status(200).json([
    {
      action: "talk",
      text: "Hello. This is a test call. Your Vonage connection is working."
    }
  ]);
});

app.all("/webhooks/events", (req, res) => {
  console.log("EVENT HIT", req.method, req.query, req.body);
  res.status(200).send("ok");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "./app.js";
import { readFoam } from "./oracle.js";

const client = new Anthropic();
const port = Number(process.env.PORT ?? 3000);

createApp({ readFoam: (image) => readFoam(client, image) }).listen(port, () => {
  console.log(`Foam Oracle server listening on http://localhost:${port}`);
});

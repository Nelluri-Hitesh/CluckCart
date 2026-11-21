import "dotenv/config";
import { runSeed } from "../src/db/seed";

runSeed()
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

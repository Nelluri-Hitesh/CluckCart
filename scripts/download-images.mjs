import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const IMAGES = {
  "whole.jpg": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&auto=format&fit=crop&q=80",
  "fry-cut.jpg": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=80",
  "curry-cut.jpg": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=800&auto=format&fit=crop&q=80",
  "boneless.jpg": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&auto=format&fit=crop&q=80",
  "breast.jpg": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&auto=format&fit=crop&q=80",
  "legs.jpg": "https://images.unsplash.com/photo-1527477378408-1bc128217777?w=800&auto=format&fit=crop&q=80",
  "thighs.jpg": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&auto=format&fit=crop&q=80",
  "wings.jpg": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&auto=format&fit=crop&q=80",
  "liver.jpg": "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80",
};

const dir = path.join(process.cwd(), "public", "images");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  for (const [name, url] of Object.entries(IMAGES)) {
    const dest = path.join(dir, name);
    try {
      console.log(`Downloading ${name}...`);
      await download(url, dest);
      console.log(`Saved ${name}`);
    } catch (err) {
      console.error(`Error downloading ${name}:`, err.message);
    }
  }
  console.log("All images downloaded successfully.");
}

main();

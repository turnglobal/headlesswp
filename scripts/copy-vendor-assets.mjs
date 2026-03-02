import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceJs = path.join(root, "node_modules", "swiper", "swiper-bundle.min.js");
const sourceCss = path.join(root, "node_modules", "swiper", "swiper-bundle.min.css");
const outputDir = path.join(root, "public", "assets");
const outputJs = path.join(outputDir, "swiper-bundle.min.js");
const outputCss = path.join(outputDir, "swiper-bundle.min.css");

await mkdir(outputDir, { recursive: true });
await copyFile(sourceJs, outputJs);
await copyFile(sourceCss, outputCss);

console.info("Copied vendor assets: swiper-bundle.min.js and swiper-bundle.min.css");

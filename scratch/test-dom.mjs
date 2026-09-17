import fs from "fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM(fs.readFileSync("scratch/dom.html", "utf-8"));
console.log(dom.window.document.querySelector("[data-testid='office-landing-drop']").textContent);

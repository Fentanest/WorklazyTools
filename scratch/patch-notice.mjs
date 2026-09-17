import fs from "fs";
let content = fs.readFileSync("src/components/UtilitySurface.tsx", "utf-8");

content = content.replace(/role=\{role \|\| \(announce === "off" \? undefined : \(announce === "assertive" \? "alert" : "status"\)\)\}/, 
`data-slot="notice"
      data-ui-component="UtilityNotice"
      role={role || (announce !== "off" ? (announce === "assertive" ? "alert" : "status") : (actualKind === "error" || actualKind === "warning" ? "alert" : (actualKind === "progress" || actualKind === "success" ? "status" : undefined)))}`);

fs.writeFileSync("src/components/UtilitySurface.tsx", content);

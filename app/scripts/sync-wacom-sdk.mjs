import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const candidateDirs = ["", "dist", "build", "lib"];
const candidateBases = ["signature_sdk", "signature-sdk"];

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const findSdkFiles = async (pkgRoot) => {
  for (const base of candidateBases) {
    for (const dir of candidateDirs) {
      const baseDir = path.join(pkgRoot, dir);
      const jsPath = path.join(baseDir, `${base}.js`);
      const wasmPath = path.join(baseDir, `${base}.wasm`);
      if (await fileExists(jsPath)) {
        const hasWasm = await fileExists(wasmPath);
        if (hasWasm) {
          return { base, jsPath, wasmPath };
        }
      }
    }
  }
  return null;
};

const main = async () => {
  let pkgRoot;
  try {
    const pkgJsonPath = require.resolve("@wacom/signature-sdk/package.json");
    pkgRoot = path.dirname(pkgJsonPath);
  } catch {
    const fallback = path.join(process.cwd(), "node_modules", "@wacom", "signature-sdk");
    if (await fileExists(fallback)) {
      pkgRoot = fallback;
    } else {
      console.log("Wacom SDK not installed. Skip copy.");
      return;
    }
  }
  const sdkFiles = await findSdkFiles(pkgRoot);
  if (!sdkFiles) {
    console.log("Wacom SDK files not found in the package.");
    return;
  }

  const destDir = path.join(process.cwd(), "public", "wacom");
  await fs.mkdir(destDir, { recursive: true });

  const destJs = path.join(destDir, path.basename(sdkFiles.jsPath));
  const destWasm = path.join(destDir, path.basename(sdkFiles.wasmPath));

  await fs.copyFile(sdkFiles.jsPath, destJs);
  await fs.copyFile(sdkFiles.wasmPath, destWasm);

  console.log(`Copied ${path.basename(destJs)} and ${path.basename(destWasm)} to public/wacom.`);
};

main().catch((error) => {
  console.error("Wacom SDK sync failed:", error);
  process.exitCode = 1;
});

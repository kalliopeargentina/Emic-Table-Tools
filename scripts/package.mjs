/**
 * Package script for Obsidian plugin distribution.
 * Reads version from manifest.json, runs production build, copies artifacts to dist/<id>/,
 * creates dist/<id>-<version>.zip, then removes the temporary folder.
 * Supports Windows (PowerShell) and Linux/macOS (zip).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const projectRoot = process.cwd();
const manifestPath = path.join(projectRoot, "manifest.json");

// 1. Read manifest
if (!fs.existsSync(manifestPath)) {
	console.error("manifest.json not found at project root.");
	process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const { id, version } = manifest;
if (!id || !version) {
	console.error("manifest.json must contain 'id' and 'version'.");
	process.exit(1);
}

// 2. Run production build
console.log("Running production build...");
execSync("npm run build", { stdio: "inherit", cwd: projectRoot });

const mainJsPath = path.join(projectRoot, "main.js");
if (!fs.existsSync(mainJsPath)) {
	console.error("Build did not produce main.js. Aborting.");
	process.exit(1);
}

// 3. Create dist/ and dist/<id>/
const distDir = path.join(projectRoot, "dist");
const distPluginDir = path.join(distDir, id);
fs.mkdirSync(distPluginDir, { recursive: true });

// 4. Copy artifacts
const manifestDest = path.join(distPluginDir, "manifest.json");
fs.copyFileSync(manifestPath, manifestDest);
fs.copyFileSync(mainJsPath, path.join(distPluginDir, "main.js"));
const stylesPath = path.join(projectRoot, "styles.css");
if (fs.existsSync(stylesPath)) {
	fs.copyFileSync(stylesPath, path.join(distPluginDir, "styles.css"));
}

// 5. Create ZIP
const zipName = `${id}-${version}.zip`;
const zipPath = path.join(distDir, zipName);
const isWindows = process.platform === "win32";

if (isWindows) {
	execSync(
		`powershell -NoProfile -Command "Set-Location -LiteralPath '${distDir.replace(/'/g, "''")}'; Compress-Archive -Path '${id}' -DestinationPath '${zipName}' -Force"`,
		{ stdio: "inherit" }
	);
} else {
	execSync(`zip -r "${zipName}" "${id}"`, {
		cwd: distDir,
		stdio: "inherit",
	});
}

// 6. Remove temporary folder
fs.rmSync(distPluginDir, { recursive: true });

console.log(`Created ${zipPath}`);

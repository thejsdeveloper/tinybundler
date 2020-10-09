const path = require("path");
const fs = require("fs");
const EXTENSIONS = ["", "js", "json", "node"];

const isRelativePath = (filePath) =>
  filePath.startsWith("./") || filePath.startsWith("../");

const isDirectory = (filePath) => {
  try {
    const is = fs.lstatSync(filePath).isDirectory();
    return is;
  } catch (e) {
    return false;
  }
};

const isFile = (filePath) => fs.statSync(filePath).isFile();

const isFileExist = (filePath) => fs.existsSync(filePath);

function resolveFilePath(filePath) {
  // when path is directory
  if (isDirectory(filePath)) {
    const packageJsonPath = path.join(filePath, "package.json");
    if (isFileExist(packageJsonPath)) {
      const fileContent = fs.readFileSync(packageJsonPath);
      const main = JSON.parse(fileContent).main || "index.js";
      const resolvedPath = path.join(filePath, main);
      return isFileExist(resolvedPath) ? resolvedPath : null;
    }

    const indexJsPath = path.join(filePath, "index.js");
    if (isFileExist(indexJsPath)) {
      return indexJsPath;
    }
  }

  // *If it is a file and with extension then check exist and return
  if (isFileExist(filePath)) {
    return filePath;
  }
  // *If No extension then try for EXTENSION
  for (const ext of EXTENSIONS) {
    const jsPath = `${filePath}.${ext}`;
    if (isFileExist(jsPath)) {
      return jsPath;
    }
  }

  return null;
}

function resolveModule(requestorDir, entryDirectory, requestedPath) {
  let currDirectory = requestorDir;

  while (currDirectory.startsWith(entryDirectory)) {
    const scriptPath = resolveFilePath(
      `${currDirectory}/node_modules/${requestedPath}`
    );

    if (scriptPath) return scriptPath;
    currDirectory = path.dirname(currDirectory);
  }
  return null;
}

module.exports = (requesterPath, requestedPath, entryDirectory) => {
  const dirName = path.dirname(requesterPath);
  if (isRelativePath(requestedPath)) {
    const absolutePath = path.join(dirName, requestedPath);
    return resolveFilePath(absolutePath);
  } else {
    return resolveModule(dirName, entryDirectory, requestedPath);
  }
};

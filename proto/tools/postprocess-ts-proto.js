const fs = require("fs");
const path = require("path");

const pbDir = path.resolve(__dirname, "../../assets/pb");

function addNameFieldToMessageFns(fileContent) {
  const interfacePattern = /export interface MessageFns<T> \{\r?\n/;
  if (!interfacePattern.test(fileContent) || /readonly name: string;/.test(fileContent)) {
    return fileContent;
  }

  return fileContent.replace(
    interfacePattern,
    (match) => `${match}  readonly name: string;\n`,
  );
}

function addNamePropertyToExports(fileContent) {
  return fileContent.replace(
    /export const (\w+): MessageFns<[^>]+> = \{\r?\n/g,
    (match, exportName) => {
      if (match.includes("name:")) {
        return match;
      }
      return `${match}  name: "${exportName}",\n`;
    },
  );
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let updated = addNameFieldToMessageFns(original);
  updated = addNamePropertyToExports(updated);

  if (updated === original) {
    return false;
  }

  fs.writeFileSync(filePath, updated, "utf8");
  return true;
}

function collectTsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

function main() {
  if (!fs.existsSync(pbDir)) {
    throw new Error(`pb directory not found: ${pbDir}`);
  }

  const files = collectTsFiles(pbDir);
  const updatedFiles = files.filter(processFile);
  console.log(`postprocess-ts-proto: updated ${updatedFiles.length} file(s)`);
  for (const filePath of updatedFiles) {
    console.log(` - ${path.relative(process.cwd(), filePath)}`);
  }
}

main();

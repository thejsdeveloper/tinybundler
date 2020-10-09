const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");
const resolvePath = require("./resolver");

const {
  IMPORT_DECLARATION,
  IMPORT_DEFAULT_SPECEFIER,
  IMPORT_NAMESPACE_SPECIFIER,
  IMPORT_SPECIFIER,
  EXPORT_ALL_DECLARATION,
  EXPORT_NAMED_DECLARATION,
  EXPORT_SPECIFIER,
} = require("./constants");

const MODULE_CHACHE = new Map();
/*

interface Module {
  filepath: string;
  isEntryFile: boolean;
  dependencies: Array<Dependency>;
}

interface Dependency {
  module: Module;
  exports: Array<string>;
}

*/

function buildDependencyGraph(entryFile) {
  const entryFullFilepath = path.resolve(entryFile);
  const entryDirectoryName = path.dirname(entryFullFilepath);
  return createModule(entryFile, entryDirectoryName, true);
}

/**
 *
 * @param {string} filepath
 * @param {string} entryDirectoryName
 * @param {string} isEntryFile
 * @return {filepath,isEntryFile, dependencies: [{ module, exports: [] }], }
 */
function createModule(filepath, entryDirectoryName, isEntryFile = false) {
  if (MODULE_CHACHE.has(filepath)) {
    return MODULE_CHACHE.get(filepath);
  }

  const module = {
    filepath,
    isEntryFile,
    dependencies: [],
  };
  MODULE_CHACHE.set(filepath, module);

  module.dependencies = getModuleDependency(filepath, entryDirectoryName);
  return module;
}

/**
 * @param {string} fileName
 * @param {string} entryDirectoryName
 * *@return [{ module, exports: [] }]
 */
function getModuleDependency(fileName, entryDirectoryName) {
  const content = fs.readFileSync(fileName, "utf-8");
  const ast = acorn.parse(content, { ecmaVersion: 2020, sourceType: "module" });
  const dependencies = getDependencies(ast, fileName, entryDirectoryName);

  return dependencies.map((dependency) => {
    const { filePath, exports } = dependency;
    const module = createModule(filePath, entryDirectoryName);
    return {
      module,
      exports,
    };
  });
}
/**
 *
 * @param {ast} ast
 * @param {string} fileName
 * @param {string} entryDirectoryName
 * * @return [{ absoluteFilePath, exports: [] }]
 */

function getDependencies(ast, fileName, entryDirectoryName) {
  const dependencies = [];
  walk.full(ast, (node) => {
    if (
      node.type === IMPORT_DECLARATION ||
      node.type === EXPORT_ALL_DECLARATION ||
      node.type === EXPORT_NAMED_DECLARATION
    ) {
      const importPath = node.source && node.source.value;
      if (!importPath) {
        return;
      }
      const resolvedFilePath = resolvePath(
        fileName,
        importPath,
        entryDirectoryName
      );

      if (!resolvedFilePath) {
        throw new Error(`Unable to resolve "${importPath}" from "${fileName}"`);
      }

      if (node.type === IMPORT_DECLARATION) {
        const dependency = {
          filePath: resolvedFilePath,
          exports: node.specifiers.map((specifier) => {
            if (specifier.type === IMPORT_DEFAULT_SPECEFIER) {
              return "default";
            }
            if (specifier.type === IMPORT_NAMESPACE_SPECIFIER) {
              return "*";
            }

            if (specifier.type === IMPORT_SPECIFIER) {
              return specifier.local.name;
            }
          }),
        };
        dependencies.push(dependency);
      }

      if (node.type === EXPORT_ALL_DECLARATION) {
        dependencies.push({
          filePath: resolvedFilePath,
          exports: ["*"],
        });
      }

      if (node.type === EXPORT_NAMED_DECLARATION) {
        const dependency = {
          filePath: resolvedFilePath,
          exports: node.specifiers.map((node) => {
            if (node.type === EXPORT_SPECIFIER) {
              return node.local.name;
            }
            return "";
          }),
        };

        dependencies.push(dependency);
      }
    }
  });

  return dependencies;
}

module.exports = {
  buildDependencyGraph,
};

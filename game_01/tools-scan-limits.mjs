import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const kMaxFnLines = 50;
const kMaxClassLines = 500;

function walk(d, acc = []) {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, n.name);
        if (n.isDirectory()) {
            if (n.name === 'node_modules') continue;
            walk(p, acc);
        } else if (/\.tsx?$/.test(n.name)) acc.push(p);
    }
    return acc;
}

function lineSpan(sf, node) {
    const { line: start } = sf.getLineAndCharacterOfPosition(node.getFullStart());
    const { line: end } = sf.getLineAndCharacterOfPosition(node.getEnd());
    return { startLine: start + 1, endLine: end + 1, lines: end - start + 1 };
}

const longFns = [];
const longClasses = [];

function visit(sf, fileRel) {
    const scan = (node) => {
        if (ts.isClassDeclaration(node) && node.name) {
            const span = lineSpan(sf, node);
            if (span.lines > kMaxClassLines) {
                longClasses.push({ file: fileRel, ...span, name: node.name.text });
            }
        }
        if (
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isConstructorDeclaration(node) ||
            ts.isArrowFunction(node) ||
            ts.isGetAccessor(node) ||
            ts.isSetAccessor(node)
        ) {
            if (!node.getSourceFile()) return;
            const span = lineSpan(sf, node);
            if (span.lines > kMaxFnLines) {
                let name = '(anonymous)';
                if (ts.isFunctionDeclaration(node) && node.name) name = node.name.text;
                else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) name = node.name.text;
                else if (ts.isConstructorDeclaration(node)) name = 'constructor';
                else if (ts.isGetAccessor(node) && ts.isIdentifier(node.name)) name = `get ${node.name.text}`;
                else if (ts.isSetAccessor(node) && ts.isIdentifier(node.name)) name = `set ${node.name.text}`;
                else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
                    const maybe = node.parent;
                    if (ts.isVariableDeclaration(maybe) && ts.isIdentifier(maybe.name)) name = maybe.name.text;
                }
                longFns.push({ file: fileRel, ...span, lines: span.lines, name });
            }
        }
        ts.forEachChild(node, (c) => scan(c));
    };
    scan(sf);
}

const cwd = process.cwd();
const assets = path.join(cwd, 'assets');
for (const file of walk(assets)) {
    const text = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    visit(sf, path.relative(cwd, file));
}

longFns.sort((a, b) => b.lines - a.lines);
longClasses.sort((a, b) => b.lines - a.lines);

console.log(JSON.stringify({ longFns, longClasses }, null, 2));
console.error(`functions>${kMaxFnLines}: ${longFns.length}, classes>${kMaxClassLines}: ${longClasses.length}`);

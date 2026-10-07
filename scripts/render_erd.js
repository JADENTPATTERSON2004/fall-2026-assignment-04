#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default paths as defined in the specification
const defaultInput = 'docs/architecture/schema.mmd';
const defaultOutput = 'docs/architecture/erd.svg';

const inputArg = process.argv[2] || defaultInput;
const outputArg = process.argv[3] || defaultOutput;

// Locate project root by ascending until package.json is found
function findProjectRoot() {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'package.json'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();

// Resolve input path with fallback to project root
let inputPath = path.isAbsolute(inputArg) ? inputArg : path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  const fallbackPath = path.resolve(projectRoot, inputArg);
  if (fs.existsSync(fallbackPath)) {
    inputPath = fallbackPath;
  }
}

// Verify input file existence
if (!fs.existsSync(inputPath)) {
  console.error(`SYNTAX_ERROR:\nInput file not found at ${inputArg}`);
  process.exit(1);
}

// Resolve output path relative to projectRoot or CWD
let outputPath = path.isAbsolute(outputArg) ? outputArg : path.resolve(process.cwd(), outputArg);
if (!path.isAbsolute(outputArg) && inputPath.startsWith(projectRoot)) {
  outputPath = path.resolve(projectRoot, outputArg);
}

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Execute mermaid-cli (mmdc) via npx
const mmdcArgs = ['--silent', 'mmdc', '-i', inputPath, '-o', outputPath];
const result = spawnSync('npx', mmdcArgs, {
  encoding: 'utf-8',
  cwd: projectRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

// Helper to filter out npm notice noise from stderr
function cleanStderr(rawStderr) {
  if (!rawStderr) return '';
  return rawStderr
    .split('\n')
    .filter((line) => !line.trim().startsWith('npm notice'))
    .join('\n')
    .trim();
}

const cleanedStderr = cleanStderr(result.stderr);
const cleanedStdout = (result.stdout || '').trim();

if (result.status === 0 && fs.existsSync(outputPath)) {
  console.log('SUCCESS');
  process.exit(0);
} else {
  let errorTrace = cleanedStderr;
  if (!errorTrace && cleanedStdout && cleanedStdout.toLowerCase().includes('error')) {
    errorTrace = cleanedStdout;
  }
  if (!errorTrace && result.error) {
    errorTrace = result.error.message;
  }
  if (!errorTrace) {
    errorTrace = `mmdc compilation failed with exit code ${result.status ?? 1}`;
  }

  console.error(`SYNTAX_ERROR:\n${errorTrace}`);
  process.exit(1);
}

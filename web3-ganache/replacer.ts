import * as fs from 'fs';
import * as path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, 'contracts', 'erc20-token-flattened.sol'), 'utf8');

const replacedSource = source.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/"/g, '\\"');

console.log('sourceee', replacedSource);
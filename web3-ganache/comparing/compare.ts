import * as fs from "fs";
import * as path from "path";

const txt1 = fs.readFileSync(path.resolve(__dirname, '1.txt'), 'utf8');
const txt2 = fs.readFileSync(path.resolve(__dirname, '2.txt'), 'utf8');

const message = `The two files are ${txt1 === txt2 ? 'the same' : 'different'}`;
console.log(message);
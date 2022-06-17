import { promises } from 'fs';
import minimist = require('minimist');
import { resolve } from 'path';
import { CustomException } from '../src/classes/exceptions/CustomException';
import { IImport, parse, sort, stringify } from './libs';
const { lstat, readdir, readFile, writeFile } = promises;

const argv = minimist(process.argv.slice(2));

// eslint-disable-next-line prefer-const
let [path = 'src', ...order] = argv._;
if (!order.length) {
  order = [
    '<TYPE_MODULES>',
    '<SEPARATOR>',
    '<THIRD_PARTY_MODULES>',
    '<SEPARATOR>',
    '^src/(.*)$',
    '^[./]',
  ];
}
if (order.indexOf('<THIRD_PARTY_MODULES>') === -1) {
  order.unshift('<THIRD_PARTY_MODULES>');
}

async function fix(path: string): Promise<void> {
  const stat = await lstat(path);
  if (stat.isDirectory()) {
    const files = await readdir(path);
    await Promise.all(files.map((f) => fix(resolve(path, f))));
  } else if (stat.isFile()) {
    try {
      const content = await readFile(path, 'utf-8');
      let lines = content.split('\n');

      const imports: IImport[] = [],
        codes: string[] = [];

      let index = 0,
        start = -1,
        end = -1,
        flag = false;
      while (index < lines.length) {
        if (!flag) {
          if (start === -1 && lines[index].startsWith('import ')) {
            start = index;
          }
          if (end === -1 && lines[index].endsWith(';')) {
            end = index;
          }
          if (start !== -1 && end !== -1) {
            imports.push(parse(lines.slice(start, end + 1)));
          }
        }
        if (flag || (flag = start === -1 && lines[index].trim() !== '')) {
          codes.push(lines[index]);
        }
        if (start !== -1 && end !== -1) {
          start = end = -1;
        }
        index += 1;
      }

      lines = [
        ...sort(order, imports).map((i) =>
          typeof i === 'string' ? '' : stringify(i),
        ),
        '',
        ...codes,
      ];

      await writeFile(path, lines.join('\n'), 'utf-8');
      console.log(`- sort '${path}'`);
    } catch (e) {
      CustomException.throw(e);
    }
  }
}

fix(path);

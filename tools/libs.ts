export interface IImport {
  type?: boolean;
  asterisk?: boolean;
  allAs?: string;
  imports: string[];
  fallback?: boolean;
  module: string;
}

export function stringify({
  type,
  asterisk,
  allAs,
  imports,
  fallback,
  module,
}: IImport) {
  const import_ = `import${type ? ' type' : ''}`;
  let imports_ = '';
  if (asterisk) {
    imports_ = `* as ${allAs}`;
  } else if (imports.length) {
    imports_ = `${allAs ? `${allAs}, ` : ''}{ ${imports.join(', ')} }`;
  } else {
    imports_ = allAs || '';
  }
  const module_ = fallback ? `= require('${module}')` : `from '${module}'`;
  return `${import_} ${imports_} ${module_};`;
}

export function parse(lines: string[]): IImport {
  const line = lines.map((l) => l.trim()).join('');

  const type = line.startsWith('import type '),
    asIndex = line.indexOf(' * as '),
    asterisk = asIndex > -1,
    imports: string[] = [];
  let allAs: string | undefined,
    fallback = false,
    module: string;

  let index = line.lastIndexOf(' from ');
  if (index === -1) {
    index = line.lastIndexOf(' = require(');
    if (index > -1) fallback = true;
  }
  if (index === -1) {
    throw new Error(`this is not import line: '${line}'`);
  }

  if (asterisk) {
    allAs = line.substring(asIndex + 6, index);
  } else {
    let line_ = line.substring(type ? 12 : 7, index);
    const startIndex = line_.indexOf('{'),
      endIndex = line_.lastIndexOf('}');
    if (startIndex > -1 && endIndex > -1) {
      imports.push(
        ...line_
          .substring(startIndex + 1, endIndex)
          .split(',')
          .map((i) => i.trim())
          .filter((i) => i),
      );
    }
    if (startIndex > 0) {
      line_ = line_.substring(0, startIndex);
    } else if (endIndex < line_.length - 1) {
      line_ = line_.substring(endIndex + 1);
    } else {
      line_ = '';
    }
    if (line_) {
      allAs = line_
        .split(',')
        .map((i) => i.trim())
        .filter((i) => i)[0];
    }
  }

  if (
    (asterisk && !allAs) ||
    (type && allAs) ||
    (asterisk && imports.length) ||
    (asterisk && fallback)
  ) {
    throw new Error(`this is not import line: '${line}'`);
  }

  // get module
  module = module = line.substring(
    index + (fallback ? 12 : 7),
    line.lastIndexOf(';') - (fallback ? 2 : 1),
  );

  return {
    type,
    asterisk,
    allAs,
    imports,
    fallback,
    module,
  };
}

export function sort(order: string[], imports: IImport[]): Array<IImport | ''>;
export function sort(
  order: string[],
  imports: IImport[],
  sortType: true,
): Array<IImport>;
export function sort(
  order: string[],
  imports: IImport[],
  sortType = false,
): Array<IImport | ''> {
  let typeImports: IImport[] = [];
  if (!sortType && order.indexOf('<TYPE_MODULES>') > -1) {
    typeImports = imports.filter((i) => i.type);
    imports = imports.filter((i) => !i.type);
  }

  for (const import_ of imports) {
    import_.imports.sort((l, r) => l.localeCompare(r));
  }
  const intermediate: { [key: string]: IImport[] } = order.reduce(
    (r, o) => (o !== '<SEPARATOR>' ? { ...r, [o]: [] } : r),
    {},
  );
  for (const i of imports) {
    let flag = false;
    for (const regexp of order) {
      if (!regexp.startsWith('<') && !regexp.endsWith('>')) {
        if (new RegExp(regexp).test(i.module)) {
          intermediate[regexp].push(i);
          flag = true;
          break;
        }
      }
    }
    if (!flag) intermediate['<THIRD_PARTY_MODULES>'].push(i);
  }
  if (intermediate['<TYPE_MODULES>'] && typeImports.length) {
    intermediate['<TYPE_MODULES>'] = sort(order, typeImports, true);
  }
  const result: Array<IImport | ''> = [];
  for (
    let i = 0, l: string | undefined, o = order[0], length = order.length;
    i < length;
    i += 1, l = order[i - 1], o = order[i]
  ) {
    if (o === '<SEPARATOR>') {
      if (!sortType && (intermediate[l] || []).length) result.push('');
    } else if (intermediate[o].length) {
      result.push(
        ...intermediate[o].sort((l, r) => l.module.localeCompare(r.module)),
      );
    }
  }
  return result;
}

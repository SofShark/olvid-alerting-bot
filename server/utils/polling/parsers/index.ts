// Format → parser registry. To support a new format, drop a new Parser in
// this folder and add it to the map.

import type { Parser } from '../types'
import { xmlParser }  from './xml'
import { htmlParser } from './html'

const parsers: Record<string, Parser> = {
  [xmlParser.format]:  xmlParser,
  [htmlParser.format]: htmlParser,
  // [jsonParser.format]:  jsonParser,
}

export function getParser(format: string): Parser | null {
  return parsers[format] ?? null
}

export function listSupportedFormats(): string[] {
  return Object.keys(parsers)
}

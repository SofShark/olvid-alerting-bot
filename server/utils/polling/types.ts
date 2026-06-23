// Shared types for the polling subsystem.
//
// The polling pipeline is: fetch → parse → evaluate condition. Each stage is
// behind a thin interface so additional content formats (JSON, HTML, …) can be
// added by dropping a new parser into ./parsers/ without touching the engine.

export interface ParserContext {
  raw: string
}

export interface ParseResult {
  raw:    string
  parsed: any
  error?: string
}

export interface Parser {
  format: string
  parse(ctx: ParserContext): ParseResult
}

export interface EvalResult {
  fired:           boolean
  reason:          string
  observedValue?:  any   // current value at the first watched path
  baselineValue?:  any   // either the previous-poll value, or the full per-path verdict array
}

export type RunResult = {
  ok:         boolean
  url:        string
  format:     string
  raw?:       string
  parsed?:    any
  condition?: EvalResult
  error?:     string
}

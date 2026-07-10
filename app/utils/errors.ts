/*
  Caught-error helpers for code running under `useUnknownInCatchVariables: true`.

  Why these exist: that compiler flag types `catch (e)` as `unknown`, which
  is the correct default — anything can be thrown. The downside is that
  every catch site that reads `error.message` / `error.data?.message` then
  needs to either narrow with `instanceof Error` (ladders that don't cover
  ofetch-shaped errors) or annotate `: any` (lints flag it).

  These two helpers do the narrowing once. Call sites stay clean:

    } catch (error: any) {
      console.error('Save failed:', getErrorData(error) ?? error)
      alert(getErrorMessage(error, t('common.unknownError')))
    }

  The single typed cast lives inside `getErrorMessage` and targets a
  narrow shape — no `any` escapes either function.
*/

type ErrorWithBody = {
  data?: { message?: string; statusMessage?: string }
  message?: string
}

/**
 * Pull the most user-friendly message out of an unknown caught error.
 * Probes (in order): `data.message`, `data.statusMessage`, `message`.
 * Falls back to the provided string when none of those is a string.
 */
export const getErrorMessage = (e: unknown, fallback = ''): string => {
  if (typeof e === 'string') return e
  if (typeof e !== 'object' || e === null) return fallback
  const err = e as ErrorWithBody
  return err.data?.message ?? err.data?.statusMessage ?? err.message ?? fallback
}

/**
 * Pull the structured `.data` body off an ofetch-style error so it can be
 * logged separately from the message. Returns undefined when the caught
 * value has no `.data` field — log the raw error in that case.
 */
export const getErrorData = (e: unknown): unknown => {
  if (typeof e !== 'object' || e === null || !('data' in e)) return undefined
  return (e as ErrorWithBody).data
}

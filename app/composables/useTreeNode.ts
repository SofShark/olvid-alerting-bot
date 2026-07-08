import { computed } from "vue";

/**
 * Reactive helpers shared by JsonTreeNode and XmlTreeNode. Both trees
 * walk a plain-JS payload (objects + arrays + primitives) recursively;
 * only the visual chrome around the values differs.
 *
 * Pass the reactive `props` object as-is — the composable reads its
 * fields inside computeds, so reactivity is tracked automatically.
 *
 * The `path` returned by `childPath` always includes the numeric index
 * for array elements ("commits.0.id") so Handlebars references keep
 * resolving even when the tree hides that index visually.
 */
export function useTreeNode(props: { nodeValue: unknown; path: string }) {
  /** Objects and arrays are branches; everything else is a leaf. */
  const isBranch = computed(
    () => props.nodeValue !== null && typeof props.nodeValue === "object",
  );

  /** Arrays are the subset that skip key labels on their children. */
  const isArray = computed(() => Array.isArray(props.nodeValue));

  /** Non-array object (proper branch with named keys). */
  const isObject = computed(() => isBranch.value && !isArray.value);

  /** [key, value] pairs for recursion. Numeric string keys for array
   *  elements (kept out of the label but still used to compose paths). */
  const entries = computed<Array<[string, unknown]>>(() => {
    if (Array.isArray(props.nodeValue)) {
      return props.nodeValue.map((v, i) => [String(i), v]);
    }
    return Object.entries(props.nodeValue ?? {});
  });

  /** Compose the child's absolute dot-path. Used by the `select` emit
   *  so consumers can watch or Handlebars-reference specific leaves. */
  function childPath(key: string): string {
    return props.path ? `${props.path}.${key}` : key;
  }

  return { isBranch, isArray, isObject, entries, childPath };
}

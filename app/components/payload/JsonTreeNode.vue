<script setup lang="ts">
import { ref, computed } from "vue";

/*
  JsonTreeNode — recursive, interactive JSON inspector.

  Renders a JSON value as a click-to-pick tree:
    - Branches (objects / arrays)  → collapsible row, click to toggle.
    - Leaves (string / number / boolean / null) → click emits its dot-path
      (e.g. "commits.0.author.name") so the caller can pipe it into a
      Handlebars editor, a search, etc.

  Drop-in compatible with the previous XmlTreeNode contract (same props,
  same `select` event) — what changes is the visual: JSON-style instead of
  <tag>-style, plus collapse/expand interaction and type-coloured leaves.

  Props:
    nodeName  — the key of this node (string for objects, numeric-string for arrays)
    nodeValue — the value at this node (any JSON value)
    path      — full dot-path from the root (used in select payload)
    depth?    — recursion depth, used for indentation
*/

defineOptions({ name: "JsonTreeNode" });

// No `selected` prop — JSON picker mode is hover-only, not persistent.
// (XmlTreeNode keeps its `selected` for the polling watched-paths use case;
// the two trees diverge here intentionally.)
const props = withDefaults(
  defineProps<{
    nodeName: string;
    nodeValue: any;
    path: string;
    depth?: number;
  }>(),
  {
    depth: 0,
  },
);

defineEmits<{ (e: "select", path: string): void }>();

// Branch  : object or array — collapsible parent.
// Leaf    : everything else (primitive, null, undefined) — click-to-select.
const isBranch = computed(
  () =>
    props.nodeValue !== null &&
    props.nodeValue !== undefined &&
    typeof props.nodeValue === "object",
);
const isArray = computed(() => Array.isArray(props.nodeValue));

// Numeric-string keys (array indices) get [N] notation; everything else is
// shown verbatim. The path itself stays dot-delimited so the existing
// `pathToHandlebars` converter in FormatEditor keeps working.
const isIndex = computed(() => /^\d+$/.test(props.nodeName));
const displayName = computed(() =>
  isIndex.value ? `[${props.nodeName}]` : props.nodeName,
);

// Branches are expanded by default. Click the chevron / key to collapse.
const expanded = ref(true);
const toggle = () => {
  expanded.value = !expanded.value;
};

const childCount = computed(() => {
  if (!isBranch.value) return 0;
  return isArray.value
    ? (props.nodeValue as any[]).length
    : Object.keys(props.nodeValue).length;
});

// Hint text shown next to a collapsed branch — "{ 3 keys }" / "[ 2 ]".
const branchHint = computed(() => {
  const n = childCount.value;
  if (isArray.value) return `[ ${n} ]`;
  return `{ ${n} ${n === 1 ? "key" : "keys"} }`;
});

function entries(v: any): Array<[string, any]> {
  if (Array.isArray(v)) return v.map((item, i) => [String(i), item]);
  return Object.entries(v ?? {});
}

function childPath(key: string): string {
  return props.path ? `${props.path}.${key}` : key;
}

// Uniform light-blue colour to match the JSON textarea (.json-color). The
// only formatting concession we make is wrapping strings in quotes — same
// as how the JSON would look in the textarea — so the two modes feel like
// the same content shown two ways.
const leafDisplay = computed(() => {
  const v = props.nodeValue;
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
});
</script>

<template>
  <div class="tree-node" :style="{ paddingLeft: depth > 0 ? '14px' : '0' }">
    <!-- ── BRANCH ─ object / array, collapsible ─────────────────────── -->
    <template v-if="isBranch">
      <div
        class="branch-line"
        :class="{ 'is-collapsed': !expanded }"
        @click="toggle"
      >
        <span class="chevron" :class="{ open: expanded }" aria-hidden="true" />
        <span class="branch-name">{{ displayName }}</span>
        <span class="branch-sep">:</span>
      </div>

      <div v-if="expanded" class="branch-children">
        <JsonTreeNode
          v-for="[k, v] in entries(nodeValue)"
          :key="k"
          :node-name="k"
          :node-value="v"
          :path="childPath(k)"
          :depth="depth + 1"
          @select="$emit('select', $event)"
        />
      </div>
    </template>

    <!-- ── LEAF ─ primitive, click to emit its path ────────────────── -->
    <div v-else class="leaf-line" :title="path" @click="$emit('select', path)">
      <span class="leaf-name">{{ displayName }}</span>
      <span class="leaf-sep">:</span>
      <span class="leaf-value">{{ leafDisplay }}</span>
      <span class="leaf-path">{{ path }}</span>
    </div>
  </div>
</template>

<style scoped>
/* JSON tree styled to MATCH the JSON textarea exactly — same font, size,
 * colour (light blue `.json-color`). The textarea renders raw JSON in one
 * uniform colour; the tree mirrors that visual contract so toggling
 * between Edit and Picker mode feels like the same content shown two
 * ways, not two different products. Hover is the only visual signal —
 * no persistent selected highlight.
 */

.tree-node {
  font-family: var(--font-mono);
  font-size: 12px; /* matches .editor-textarea / .json-color */
  line-height: 1.5; /* matches .editor-textarea */
  color: #9cdcfe; /* matches .json-color */
}

/* ── Branch ─────────────────────────────────────────────────────── */
.branch-line {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 0;
  margin: 1px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.12s;
}
.branch-line:hover {
  background: color-mix(in srgb, #9cdcfe 14%, transparent);
}

.chevron {
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid currentColor;
  opacity: 0.5;
  margin-right: 2px;
  transition:
    transform 0.12s ease,
    opacity 0.12s ease;
}
.chevron.open {
  transform: rotate(90deg);
  opacity: 0.8;
}

/* Branch name + leaf name share the same light-blue tone — no separate
 * key/value colours, matching the textarea's single-colour rendering. */
.branch-name {
  color: #9cdcfe;
  font-weight: 600;
}
.branch-sep {
  color: #9cdcfe;
  opacity: 0.55;
  margin-left: 1px;
}

.branch-children {
  border-left: 1px solid color-mix(in srgb, #9cdcfe 22%, transparent);
  margin-left: 4px;
  padding-left: 4px;
}

/* ── Leaf — hover only, no persistent .selected state ──────────── */
.leaf-line {
  display: grid;
  grid-template-columns: minmax(60px, auto) auto 1fr auto;
  gap: var(--space-2);
  align-items: center;
  padding: 2px var(--space-2);
  margin: 1px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background-color 0.12s,
    border-color 0.12s;
  min-width: max-content;
}
.leaf-line:hover {
  background: color-mix(in srgb, #9cdcfe 14%, transparent);
  border-color: color-mix(in srgb, #9cdcfe 40%, transparent);
}

.leaf-name {
  color: #9cdcfe;
  font-weight: 600;
  white-space: nowrap;
}
.leaf-sep {
  color: #9cdcfe;
  opacity: 0.55;
}
.leaf-value {
  color: #9cdcfe;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Full dot-path reveals at the right edge on hover so the user sees
 * exactly what {{handlebars}} token will be injected before clicking. */
.leaf-path {
  color: #9cdcfe;
  opacity: 0;
  font-size: 11px;
  white-space: nowrap;
  text-align: right;
  transition: opacity 0.12s;
}
.leaf-line:hover .leaf-path {
  opacity: 0.55;
}
</style>

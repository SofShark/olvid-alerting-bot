<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  nodeName: string
  nodeValue: any
  path:      string
  selected?: string[]       // currently-selected paths (for highlighting)
  depth?:    number
}>(), {
  selected: () => [],
  depth:    0,
})

const emit = defineEmits<{ (e: 'select', path: string): void }>()

// Branch  : object or array — recurse.
// Leaf    : primitive — click to pick its path.
const isBranch = computed(
  () => props.nodeValue !== null && typeof props.nodeValue === 'object',
)

const isArray = computed(() => Array.isArray(props.nodeValue))

// fast-xml-parser surfaces attributes under "@_xxx" keys. We keep them visible
// (they're often the interesting field to watch — e.g. <entry id="…">) but
// flag them so the UI can label them differently.
const isAttribute = computed(() => props.nodeName.startsWith('@_'))
const displayName = computed(() =>
  isAttribute.value ? props.nodeName.slice(2) : props.nodeName,
)

const isSelected = computed(() => props.selected.includes(props.path))

function entries(v: any): Array<[string, any]> {
  if (Array.isArray(v)) return v.map((item, i) => [String(i), item])
  return Object.entries(v ?? {})
}

function childPath(key: string): string {
  return props.path ? `${props.path}.${key}` : key
}

function onLeafClick() {
  if (!isBranch.value) emit('select', props.path)
}
</script>

<template>
  <div class="tree-node" :style="{ paddingLeft: depth > 0 ? '12px' : '0' }">
    <!-- Branch (object / array) — render the tag + recurse over children. -->
    <template v-if="isBranch">
      <div class="branch-line">
        <span class="branch-name">
          &lt;{{ displayName }}{{ isArray ? '[]' : '' }}&gt;
        </span>
      </div>
      <XmlTreeNode
        v-for="([k, v]) in entries(nodeValue)"
        :key="k"
        :node-name="k"
        :node-value="v"
        :path="childPath(k)"
        :selected="selected"
        :depth="depth + 1"
        @select="$emit('select', $event)"
      />
    </template>

    <!-- Leaf (primitive) — clickable. -->
    <div
      v-else
      class="leaf-line"
      :class="{ selected: isSelected, attribute: isAttribute }"
      :title="`Click to watch: ${path}`"
      @click="onLeafClick"
    >
      <span class="leaf-name">
        <span v-if="isAttribute" class="attr-sigil">@</span>{{ displayName }}:
      </span>
      <span class="leaf-value">{{ nodeValue }}</span>
      <span class="leaf-path">{{ path }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Syntax-highlighting-style colors for the parsed-XML tree. Element names
 * sit in the accent color, attribute names in pink (only used here so it
 * doesn't earn a global token), leaf values in normal code color. Hover and
 * selected states tint via the accent / success tokens.
 */

.tree-node {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  line-height: 1.55;
}

.branch-line { color: #60a5fa; }
.branch-name { font-weight: 600; }

.leaf-line {
  display: grid;
  grid-template-columns: minmax(60px, auto) 1fr auto;
  gap: var(--space-3);
  align-items: center;
  padding: 2px var(--space-2);
  margin: 1px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color .12s, border-color .12s;
}
.leaf-line:hover {
  background:    color-mix(in srgb, var(--color-accent) 12%, transparent);
  border-color:  color-mix(in srgb, var(--color-accent) 35%, transparent);
}
.leaf-line.selected {
  background:    color-mix(in srgb, var(--color-success) 16%, transparent);
  border-color:  color-mix(in srgb, var(--color-success) 50%, transparent);
}

.leaf-name  { color: #c4b5fd; font-weight: 600; white-space: nowrap; }
.attribute  .leaf-name { color: #f472b6; }
.attr-sigil { color: #f472b6; margin-right: 1px; }

.leaf-value {
  color:blanchedalmond;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.leaf-path {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  white-space: nowrap;
  text-align: right;
  opacity: 0;
  transition: opacity .12s;
}
.leaf-line:hover    .leaf-path,
.leaf-line.selected .leaf-path { opacity: 1; }
</style>

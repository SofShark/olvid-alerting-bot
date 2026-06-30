<script setup lang="ts">
import { computed, ref } from "vue";

defineOptions({
  name: "JsonTreeNode",
});

const props = withDefaults(
  defineProps<{
    nodeName: string;
    nodeValue: any;
    path: string;
    depth?: number;
    isLast?: boolean;
    isRoot?: boolean;
  }>(),
  {
    depth: 0,
    isLast: true,
    isRoot: false,
  },
);

const emit = defineEmits<{
  (e: "select", path: string): void;
}>();

const expanded = ref(true);

const isObject = computed(() => {
  return (
    props.nodeValue !== null &&
    typeof props.nodeValue === "object" &&
    !Array.isArray(props.nodeValue)
  );
});

const isArray = computed(() => Array.isArray(props.nodeValue));

const isBranch = computed(() => isObject.value || isArray.value);

const entries = computed(() => {
  if (Array.isArray(props.nodeValue))
    return props.nodeValue.map((v, i) => [String(i), v]);

  return Object.entries(props.nodeValue ?? {});
});

function childPath(key: string) {
  return props.path ? `${props.path}.${key}` : key;
}

const openChar = computed(() => (isArray.value ? "[" : "{"));
const closeChar = computed(() => (isArray.value ? "]" : "}"));

const summary = computed(() => {
  if (!isBranch.value) return "";

  return isArray.value
    ? `[${entries.value.length}]`
    : `{${entries.value.length}}`;
});

const primitiveClass = computed(() => {
  const v = props.nodeValue;

  if (typeof v === "string") return "string";
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "boolean";
  return "null";
});

const primitiveValue = computed(() => {
  const v = props.nodeValue;

  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
});
</script>

<template>
<div class="node">

  <!-- OBJECT / ARRAY -->

  <template v-if="isBranch">

    <div
      class="line"
      :style="{ paddingLeft: `${depth*18}px` }"
    >

      <span
        class="chevron"
        @click="expanded=!expanded"
      >
        {{ expanded ? "▼" : "▶" }}
      </span>

      <template v-if="!isRoot">

        <span
          class="key"
          @click="emit('select',path)"
        >
          "{{ nodeName }}"
        </span>

        <span class="punct">:</span>

      </template>

      <span class="punct">{{ openChar }}</span>

      <span
        v-if="!expanded"
        class="summary"
      >
        {{ summary }}
      </span>

      <span
        v-if="!expanded"
        class="punct"
      >
        {{ closeChar }}
      </span>

      <span
        v-if="!isLast && !expanded"
        class="punct"
      >
        ,
      </span>

    </div>

    <template v-if="expanded">

      <JsonTreeNodeExp
        v-for="([k,v],i) in entries"
        :key="k"
        :node-name="k"
        :node-value="v"
        :path="childPath(k)"
        :depth="depth+1"
        :is-last="i===entries.length-1"
        @select="emit('select',$event)"
      />

      <div
        class="line"
        :style="{ paddingLeft: `${depth*18}px` }"
      >
        <span class="close">
          {{ closeChar }}
        </span>

        <span
          v-if="!isLast"
          class="punct"
        >
          ,
        </span>

      </div>

    </template>

  </template>

  <!-- PRIMITIVE -->

  <div
    v-else
    class="line value-line"
    :style="{ paddingLeft: `${depth*18}px` }"
    @click="emit('select',path)"
  >

    <span class="key">
      "{{ nodeName }}"
    </span>

    <span class="punct">:</span>

    <span :class="primitiveClass">
      {{ primitiveValue }}
    </span>

    <span
      v-if="!isLast"
      class="punct"
    >
      ,
    </span>

  </div>

</div>
</template>

<style scoped>

.node{
    font-family:var(--font-mono);
    font-size:12px;
    line-height:1.6;
    color:#d4d4d4;
}

.line{
    white-space:pre;
}

.value-line:hover{
    background:#2a2d2e;
    border-radius:4px;
    cursor:pointer;
}

.chevron{
    display:inline-block;
    width:18px;
    color:#808080;
    cursor:pointer;
}

.key{
    color:#9cdcfe;
}

.string{
    color:#ce9178;
}

.number{
    color:#b5cea8;
}

.boolean{
    color:#569cd6;
}

.null{
    color:#569cd6;
}

.punct{
    color:#d4d4d4;
}

.close{
    color:#d4d4d4;
    margin-left:18px;
}

.summary{
    color:#808080;
    margin:0 4px;
}

</style>
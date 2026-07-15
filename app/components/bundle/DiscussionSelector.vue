<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import type { DiscussionModel } from "#shared/types/discussion";

/*
  WhatsApp-group-creation style destination picker.

  Layout, top to bottom:
    1. Selected strip — one avatar per selected discussion, name in small
       font under the photo, a little ✕ badge to remove.
    2. Search input.
    3. Dropdown — every available discussion with its photo and a ✓ mark
       on the right when already selected. Clicking a row TOGGLES the
       discussion in/out of the list.

  Membership is strictly boolean: a discussion is either in the list or
  not. `toggle` guards against duplicates, so the same id can never
  appear twice regardless of how fast the user clicks.

  Photos come from /api/discussions/photo/:id. When the endpoint has no
  photo for an id (404 / broken image) we fall back to an initials
  circle, tracked per-id in `failedPhotos`.
*/

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    modelValue: DiscussionModel[];
    available?: DiscussionModel[];
    isLoading?: boolean;
    readonly?: boolean;
  }>(),
  {
    available: () => [],
    isLoading: false,
    readonly: false,
  },
);

const emit = defineEmits(["update:modelValue"]);

const searchQuery = ref("");
const isDropdownOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);

const selectedIds = computed(() => new Set(props.modelValue.map((d) => d.id)));

const isSelected = (d: DiscussionModel) => selectedIds.value.has(d.id);

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase();
  return props.available.filter(
    (d) => !q || d.title.toLowerCase().includes(q),
  );
});

/** Boolean membership: in the list → remove; not in it → add. The
 *  Set-based guard makes double-adds impossible. */
const toggle = (d: DiscussionModel) => {
  if (isSelected(d)) {
    emit(
      "update:modelValue",
      props.modelValue.filter((x) => x.id !== d.id),
    );
  } else {
    emit("update:modelValue", [...props.modelValue, d]);
  }
  // Dropdown stays open so the user can keep composing the audience.
};

const remove = (id: string) => {
  emit(
    "update:modelValue",
    props.modelValue.filter((d) => d.id !== id),
  );
};

// ── Avatar fallback ───────────────────────────────────────────────────────
const failedPhotos = ref<Set<string>>(new Set());
const photoFailed = (id: string) => failedPhotos.value.has(id);
const onPhotoError = (id: string) => {
  const next = new Set(failedPhotos.value);
  next.add(id);
  failedPhotos.value = next;
};
/** Up-to-2-char initials for the fallback circle. */
const initials = (title: string): string => {
  const words = (title ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
};

const onClickOutside = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node))
    isDropdownOpen.value = false;
};

onMounted(() => document.addEventListener("click", onClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", onClickOutside));
</script>

<template>
  <div class="selector">
    <!-- ── Selected strip — avatars with name + ✕ badge ────────────────── -->
    <div v-if="modelValue.length > 0" class="selected-strip">
      <div v-for="d in modelValue" :key="d.id" class="strip-item">
        <div class="strip-avatar-wrap">
          <img
            v-if="!photoFailed(d.id)"
            :src="`/api/discussions/photo/${d.id}`"
            :alt="d.title"
            class="strip-avatar"
            @error="onPhotoError(d.id)"
          >
          <div v-else class="strip-avatar strip-avatar-fallback">
            {{ initials(d.title) }}
          </div>
          <button
            v-if="!readonly"
            type="button"
            class="strip-remove"
            :title="`Remove ${d.title}`"
            @click="remove(d.id)"
          >
            ✕
          </button>
        </div>
        <span class="strip-name" :title="d.title">{{ d.title }}</span>
      </div>
    </div>

    <!-- Empty hint in readonly mode -->
    <p v-if="readonly && modelValue.length === 0" class="empty-readonly">
      {{ $t("discussionSelector.empty") }}
    </p>

    <!-- ── Search + dropdown — hidden when readonly ────────────────────── -->
    <div v-if="!readonly" ref="containerRef" class="search-wrap">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="
          isLoading
            ? t('discussionSelector.search.loading')
            : available.length === 0
              ? t('discussionSelector.search.noneAvailable')
              : t('discussionSelector.search.addPlaceholder')
        "
        :disabled="isLoading"
        class="search-input"
        @focus="isDropdownOpen = true"
      >
      <div v-if="isDropdownOpen" class="dropdown">
        <div
          v-for="d in filtered"
          :key="d.id"
          class="dropdown-item"
          :class="{ selected: isSelected(d) }"
          @mousedown.prevent="toggle(d)"
        >
          <img
            v-if="!photoFailed(d.id)"
            :src="`/api/discussions/photo/${d.id}`"
            :alt="d.title"
            class="item-avatar"
            @error="onPhotoError(d.id)"
          >
          <div v-else class="item-avatar item-avatar-fallback">
            {{ initials(d.title) }}
          </div>
          <span class="item-title">{{ d.title }}</span>
          <span v-if="isSelected(d)" class="item-check" aria-hidden="true">
            <FontAwesomeIcon :icon="['fas', 'circle-check']" />
          </span>
          <span v-else class="item-check" aria-hidden="true">
            <FontAwesomeIcon :icon="['far', 'circle']" />
          </span>
          
        </div>
        <div v-if="filtered.length === 0" class="dropdown-empty">
          {{
            available.length === 0
              ? $t("discussionSelector.dropdown.noFound")
              : $t("discussionSelector.dropdown.allAdded")
          }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

/* ── Selected strip ───────────────────────────────────────────────────
 * Horizontal row of avatar+name columns, wraps when the audience grows.
 * Mirrors the WhatsApp "new group" member strip. */
.selected-strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.strip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 56px;
}
.strip-avatar-wrap {
  position: relative;
}
.strip-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 1px solid var(--color-border-subtle);
}
.strip-avatar-fallback {
  /* Typography kept in sync with EmailRecipientSelector's fallback so
   * the two strips look like siblings. Background is the accent-soft
   * token — a single shared color is fine here because most discussions
   * do have real photos; the fallback is the exception. */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: 0.5px;
}
.strip-remove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-size: 9px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: background-color 0.15s, color 0.15s;
}
.strip-remove:hover {
  background: var(--color-danger, #ef4444);
  color: #fff;
}
.strip-name {
  max-width: 56px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Search input ─────────────────────────────────────────────────── */
.search-wrap {
  position: relative;
  width: 100%;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px var(--space-4);
  background: var(--color-bg-input);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 15%, transparent);
}
.search-input::placeholder {
  color: var(--color-border-default);
}
.search-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Dropdown ─────────────────────────────────────────────────────── */
.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  max-height: 240px;
  overflow-y: auto;
  z-index: 50;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
  transition: background-color 0.12s;
}
.dropdown-item:last-child {
  border-bottom: none;
}
.dropdown-item:hover {
  background: var(--color-border-subtle);
}
.dropdown-item.selected {
  background: color-mix(in srgb, var(--color-accent) 6%, transparent);
}

.item-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--color-border-subtle);
}
.item-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  font-size: var(--text-xs);
  font-weight: 700;
}
.item-title {
  flex: 1;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: var(--text-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-check {
  color: var(--color-accent);
  font-weight: 700;
  font-size: var(--text-md);
  flex-shrink: 0;
}

.dropdown-empty {
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-faint);
  font-size: var(--text-base);
  font-style: italic;
}

.empty-readonly {
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-md);
  font-style: italic;
}
</style>

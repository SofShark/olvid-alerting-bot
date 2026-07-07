import { ref, computed, onMounted, onBeforeUnmount, type Ref } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  type RouteLocationNormalized,
} from "vue-router";

/**
 * Unsaved-changes guard for AlertWizard.
 *
 * Snapshots the form on mount, intercepts ANY in-app navigation away from
 * the page while dirty, and warns on tab-close / hard refresh. The consumer
 * decides what to do when blocked (typically: show a "Discard / Save draft /
 * Continue editing" prompt).
 *
 * After the user makes their choice, call `allowNextLeave()` so the one-shot
 * bypass flag lets the next navigation through without re-prompting.
 *
 * `takeSnapshot()` is exposed for the consumer to call after a successful
 * save — the new persisted state becomes the clean baseline.
 */
export const useDirtyGuard = <T>(formRef: Ref<T>) => {
  const snapshot = ref("");
  const pendingLeave = ref<RouteLocationNormalized | null>(null);
  const bypass = ref(false);
  const showDiscardPrompt = ref(false);

  const isDirty = computed(
    () => JSON.stringify(formRef.value) !== snapshot.value,
  );
  const takeSnapshot = () => {
    snapshot.value = JSON.stringify(formRef.value);
  };
  const allowNextLeave = () => {
    bypass.value = true;
  };

  // onBeforeRouteLeave fires when the route definition changes; 
  // onBeforeRouteUpdate when the same definition is reused with different params/query. 
  // Both must be intercepted to cover sidebar nav and intra-list switching.
  const guardNavigation = (to: RouteLocationNormalized) => {
    if (bypass.value) {
      bypass.value = false;
      return true;
    }
    if (!isDirty.value) return true;
    pendingLeave.value = to;
    showDiscardPrompt.value = true;
    return false;
  };
  onBeforeRouteLeave(guardNavigation);
  onBeforeRouteUpdate(guardNavigation);

  // Browser-level: tab close, hard refresh, address-bar nav.
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty.value) e.preventDefault();
  };

  onMounted(() => {
    window.addEventListener("beforeunload", onBeforeUnload);
    takeSnapshot();
  });
  onBeforeUnmount(() =>
    window.removeEventListener("beforeunload", onBeforeUnload),
  );

  const dismissPrompt = () => {
    showDiscardPrompt.value = false;
    pendingLeave.value = null;
  };

  return {
    isDirty,
    showDiscardPrompt,
    pendingLeave,
    takeSnapshot,
    allowNextLeave,
    dismissPrompt,
  };
};

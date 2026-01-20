<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";

import { getCategories, getProducts, type Product } from "@/lib/api";
import { DEFAULT_SORT, isSortKey, sortProducts, SORT_OPTIONS, type SortKey } from "@/lib/sort";

type RouteQueryValue = string | string[] | null | undefined;

function asSingleString(v: RouteQueryValue): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

const router = useRouter();
const route = useRoute();

// Defaults (no query param when these are selected)
const DEFAULT_CATEGORY: string | null = null; // null = all products

// Local filter state (source of truth for UI controls)
const selectedCategory = ref<string | null>(DEFAULT_CATEGORY);
const selectedSort = ref<SortKey>(DEFAULT_SORT);

// Guard to prevent infinite route<->state loops
const syncing = ref(false);

// Load categories
const categoriesQuery = useQuery({
  queryKey: ["categories"],
  queryFn: getCategories,
});

const categories = computed(() => categoriesQuery.data.value ?? []);
const categoryOptions = computed(() => ["all products", ...categories.value]);

function isValidCategoryParam(param: string | null): boolean {
  if (!param) return true; // null means "all products"
  return categories.value.includes(param);
}

// Products query depends on category
const productsQuery = useQuery({
  queryKey: computed(() => ["products", selectedCategory.value] as const),
  queryFn: () => getProducts(selectedCategory.value),
  enabled: computed(() => true),
  placeholderData: (prev) => prev,
});

// Sorted + top 10
const visibleProducts = computed<Product[]>(() => {
  const items = productsQuery.data.value ?? [];
  const sorted = sortProducts(items, selectedSort.value);
  return sorted.slice(0, 10);
});

/**
 * Push current state -> route query (remove defaults)
 */
async function writeStateToRoute() {
  const q: Record<string, any> = { ...route.query };

  // category param: "category"
  if (selectedCategory.value === DEFAULT_CATEGORY) delete q.category;
  else q.category = selectedCategory.value;

  // sort param: "sort"
  if (selectedSort.value === DEFAULT_SORT) delete q.sort;
  else q.sort = selectedSort.value;

  syncing.value = true;
  try {
    // replace avoids polluting history for every filter tap
    await router.replace({ query: q });
  } finally {
    syncing.value = false;
  }
}

async function readRouteToStateAndClean() {
  const rawCategory = asSingleString(route.query.category);
  const rawSort = asSingleString(route.query.sort);

  // sort validation is immediate
  const nextSort: SortKey = isSortKey(rawSort) ? rawSort : DEFAULT_SORT;

  // category validation waits for categories; if categories not loaded yet,
  // we temporarily keep default and re-run once categories arrive.
  let nextCategory: string | null = DEFAULT_CATEGORY;

  // If param is absent => default
  if (rawCategory == null || rawCategory === "" || rawCategory === "all products") {
    nextCategory = DEFAULT_CATEGORY;
  } else if (categories.value.length > 0) {
    // validate only once categories are known
    nextCategory = isValidCategoryParam(rawCategory) ? rawCategory : DEFAULT_CATEGORY;
  } else {
    // categories not loaded yet; defer validation
    nextCategory = DEFAULT_CATEGORY;
  }

  // Apply to state (only if changed)
  const changed = nextSort !== selectedSort.value || nextCategory !== selectedCategory.value;

  if (changed) {
    selectedSort.value = nextSort;
    selectedCategory.value = nextCategory;
  }

  // Clean invalid params (unknown sort OR invalid category once categories loaded)
  const needsCategoryClean =
    categories.value.length > 0 &&
    rawCategory != null &&
    rawCategory !== "" &&
    rawCategory !== "all products" &&
    !isValidCategoryParam(rawCategory);

  const needsSortClean = rawSort != null && rawSort !== "" && !isSortKey(rawSort);

  if (needsCategoryClean || needsSortClean) {
    await writeStateToRoute();
  }
}

// When route changes (back/forward/manual edits), update state
watch(
  () => route.query,
  async () => {
    if (syncing.value) return;
    await readRouteToStateAndClean();
  },
  { immediate: true }
);

// When categories finish loading, re-validate category query param
watchEffect(async () => {
  if (!categoriesQuery.isSuccess.value) return;
  if (syncing.value) return;
  await readRouteToStateAndClean();
});

// When state changes from UI, update route query
watch([selectedCategory, selectedSort], async () => {
  if (syncing.value) return;
  await writeStateToRoute();
});

// UI handlers
function onCategoryChange(v: string) {
  if (v === "all products") selectedCategory.value = DEFAULT_CATEGORY;
  else selectedCategory.value = v;
}

function onSortChange(v: SortKey) {
  selectedSort.value = v;
}
</script>

<template>
  <div class="min-h-dvh bg-neutral-950 text-white">
    <!-- Sticky mobile header -->
    <header class="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/80 backdrop-blur">
      <div class="mx-auto max-w-6xl px-4 py-4">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold tracking-tight">Products</h1>
            <p class="text-xs text-white/60">Showing top 10 (sorted & filtered)</p>
          </div>

          <div class="flex items-center gap-2">
            <span
              v-if="productsQuery.isFetching.value"
              class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70"
            >
              Loading…
            </span>
          </div>
        </div>

        <!-- Filters (mobile first: stacked, then inline on sm+) -->
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- Category -->
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-white/70">Category</span>
            <select
              class="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/20"
              :disabled="categoriesQuery.isLoading.value"
              :value="selectedCategory ? selectedCategory : 'all products'"
              @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
            >
              <option value="all products">all products</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>

          <!-- Sort -->
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-white/70">Sort</span>
            <select
              class="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/20"
              :value="selectedSort"
              @change="onSortChange(($event.target as HTMLSelectElement).value as any)"
            >
              <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </label>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 pb-10 pt-6">
      <!-- Error state -->
      <div
        v-if="productsQuery.isError.value"
        class="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
      >
        Failed to load products. Please try again.
      </div>

      <!-- Skeletons -->
      <div
        v-else-if="productsQuery.isLoading.value && !(productsQuery.data.value?.length)"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div v-for="i in 6" :key="i" class="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="aspect-[4/3] w-full rounded-xl bg-white/10"></div>
          <div class="mt-4 h-4 w-3/4 rounded bg-white/10"></div>
          <div class="mt-2 h-4 w-1/3 rounded bg-white/10"></div>
        </div>
      </div>

      <!-- Empty -->
      <div
        v-else-if="visibleProducts.length === 0"
        class="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70"
      >
        No products found.
      </div>

      <!-- Product grid -->
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="p in visibleProducts"
          :key="p.id"
          class="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:bg-white/10"
        >
          <div class="relative">
            <img
              :src="p.thumbnail"
              :alt="p.title"
              class="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div class="absolute left-3 top-3">
              <span class="rounded-full border border-white/10 bg-neutral-950/70 px-2 py-1 text-xs text-white/80 backdrop-blur">
                {{ p.category }}
              </span>
            </div>
          </div>

          <div class="p-4">
            <h2 class="line-clamp-1 text-sm font-semibold tracking-tight">
              {{ p.title }}
            </h2>

            <p class="mt-1 line-clamp-2 text-xs text-white/60">
              {{ p.description }}
            </p>

            <div class="mt-3 flex items-end justify-between gap-3">
              <div class="min-w-0">
                <div class="text-base font-semibold">${{ p.price }}</div>
                <div class="text-xs text-white/50" v-if="typeof p.rating === 'number'">
                  ⭐ {{ p.rating.toFixed(1) }}
                </div>
              </div>

              <button
                class="shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 active:scale-[0.98]"
                type="button"
              >
                Add
              </button>
            </div>
          </div>
        </article>
      </div>

      <p class="mt-6 text-xs text-white/50">Tip: filters sync to the URL. Defaults remove query params.</p>
    </main>
  </div>
</template>

<style scoped>
/* Tailwind line-clamp without plugin (simple fallback) */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

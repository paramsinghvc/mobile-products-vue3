import { createRouter, createWebHistory } from "vue-router";
import ProductsPage from "./pages/ProductsPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/products" },
    { path: "/products", component: ProductsPage },
  ],
});

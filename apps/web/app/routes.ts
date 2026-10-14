import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // 探す人の入口（ランディング）
  index("routes/home.tsx"),
  // 贈る流れ（場面と予算 → 候補 → 一本を決める → リンク発行）
  route("gift/new", "routes/gift-new.tsx"),
  // 受け取りリンク（贈り主の一言、年齢確認、住所入力）
  route("g/:token", "routes/gift-receive.tsx"),
] satisfies RouteConfig;

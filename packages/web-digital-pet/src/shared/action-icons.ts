/** Monochrome, pixel-aligned paths shared by rendered and client-created controls. */
export const ACTION_ICON_PATHS = {
  save: "M2 1h10l3 3v11H1V1h1zm1 2v4h8V3H3zm1 7v3h8v-3H4zM8 3h2v3H8z",
  list: "M1 2h2v2H1zm4 0h10v2H5zM1 7h2v2H1zm4 0h10v2H5zM1 12h2v2H1zm4 0h10v2H5z",
  download: "M7 1h2v7h3l-4 4-4-4h3zM1 12h2v2h10v-2h2v4H1z",
  restore: "M1 1h2v3h9v2H3v3L0 5zM12 6h2v2h1v5h-2v2H5v-2h7v-1h1V8h-1z",
  cancel: "M2 1l6 6 6-6 1 1-6 6 6 6-1 1-6-6-6 6-1-1 6-6-6-6z",
  preview: "M1 2h14v12H1zm2 2v8h10V4H3zm2 1h6v2H5zm0 3h6v2H5z",
  retry: "M3 1h9v2H4v2h3L3 9 0 5h2V3h1zm10 6 3 4h-2v2h-1v2H4v-2h8v-2H9z",
  delete: "M5 1h6v2h4v2H1V3h4zM3 6h2v7h2V6h2v7h2V6h2v9H3z",
  adopt: "M2 2h6v2H4v4H2zM8 8h2v4h4V8h2v6H8zM5 5h2v2h2v2h2v2H9V9H7V7H5z",
  logout: "M1 1h7v2H3v10h5v2H1zm10 3 5 4-5 4V9H6V7h5z",
} as const
export type ActionIcon = keyof typeof ACTION_ICON_PATHS

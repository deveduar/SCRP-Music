export interface QuickLink {
  id: string
  label: string
  url: (query: string) => string
  icon: string
}

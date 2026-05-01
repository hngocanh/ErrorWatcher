export interface ErrorEntry {
  tabId: number
  tabUrl: string
  message: string
  source?: string
  line?: number
  timestamp: number
}
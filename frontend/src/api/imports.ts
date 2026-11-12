import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { ImportResult, StatementImportLog } from '@/types/models'

export interface ImportStatementParams {
  file: File
  cardId: number
  kind: 'credit' | 'debit'
  year: number
  month: number
  dryRun?: boolean
  categories?: Record<number, number | null>
}

export function useImportStatement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, cardId, kind, year, month, dryRun = false, categories }: ImportStatementParams) => {
      const form = new FormData()
      form.append('file', file)
      form.append('card_id', String(cardId))
      form.append('kind', kind)
      form.append('year', String(year))
      form.append('month', String(month))
      form.append('dry_run', String(dryRun))
      if (categories) form.append('categories', JSON.stringify(categories))
      return api
        .post<ImportResult>('/imports/statement/', form, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data)
    },
    onSuccess: (_r, { dryRun }) => {
      if (dryRun) return
      for (const key of ['transactions', 'summary', 'cards-summary', 'imports'])
        void qc.invalidateQueries({ queryKey: [key] })
    },
  })
}

export function useImports() {
  return useQuery({
    queryKey: ['imports'],
    queryFn: () => api.get<StatementImportLog[]>('/imports/').then((r) => r.data),
  })
}

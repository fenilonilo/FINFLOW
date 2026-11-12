import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePeriod } from '@/contexts/PeriodContext'
import { api } from '@/api/client'
import MonthPicker from '@/components/ui/MonthPicker'
import MoneyText from '@/components/ui/MoneyText'
import { toast } from '@/components/ui/Toast'
import type { Card, ImportResult, PaginatedResponse } from '@/types/models'
import { Upload } from 'lucide-react'

const STATUS_LABEL = { created: 'Criado', duplicate: 'Duplicado', ignored: 'Ignorado', refunded: 'Estornado' } as const
const STATUS_COLOR = {
  created: 'text-accent',
  duplicate: 'text-warning',
  ignored: 'text-text-muted',
  refunded: 'text-text-muted',
} as const

const field =
  'w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent/50 focus:outline-none'

export default function Import() {
  const { year, month } = usePeriod()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [cardId, setCardId] = useState(searchParams.get('card') ?? '')
  const [kind, setKind] = useState<'credit' | 'debit'>('credit')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const { data: cards } = useQuery<PaginatedResponse<Card>>({
    queryKey: ['cards', 'active'],
    queryFn: () => api.get<PaginatedResponse<Card>>('/cards/', { params: { active: true } }).then((r) => r.data),
  })

  const importMutation = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('file', file as File)
      form.append('card_id', cardId)
      form.append('kind', kind)
      form.append('year', String(year))
      form.append('month', String(month))
      return api
        .post<ImportResult>('/imports/statement/', form, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data)
    },
    onSuccess: (r) => {
      setResult(r)
      toast(`Importação concluída: ${r.created} criados, ${r.skipped} ignorados`, 'success')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['cards-summary'] })
    },
    onError: () => toast('Erro ao importar arquivo', 'error'),
  })

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-text-primary">Importar</h1>

      <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5">
        <p className="text-xs text-text-muted">Formatos: PDF fatura Inter, CSV Inter, CSV Nubank, OFX</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Cartão</label>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)} className={field}>
              <option value="">Selecionar...</option>
              {cards?.results.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Tipo</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'credit' | 'debit')} className={field}>
              <option value="credit">Fatura de crédito</option>
              <option value="debit">Extrato débito/conta</option>
            </select>
          </div>
          {kind === 'credit' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">Mês da fatura</label>
              <MonthPicker />
            </div>
          )}
        </div>
        <input
          type="file"
          accept=".csv,.ofx,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-accent/20 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent"
        />
        <button
          disabled={!file || !cardId || importMutation.isPending}
          onClick={() => importMutation.mutate()}
          className="flex items-center gap-2 rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          {importMutation.isPending ? 'Importando...' : 'Importar'}
        </button>
      </div>

      {result && (
        <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5">
          <div className="flex flex-wrap gap-6 text-sm text-text-muted">
            <span>Criados: <b className="text-accent">{result.created}</b></span>
            <span>Ignorados: <b className="text-text-primary">{result.skipped}</b></span>
            <span>Total: <MoneyText value={result.total} className="font-semibold" /></span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-xs text-text-muted">
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Descrição</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-left font-medium">Categoria</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {result.items.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-xs text-text-muted tabular-nums">
                    {new Date(it.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-text-primary">{it.description}</td>
                  <td className="px-3 py-2 text-right"><MoneyText value={it.amount} /></td>
                  <td className="px-3 py-2 text-xs text-text-muted">{it.category ?? '—'}</td>
                  <td className={`px-3 py-2 text-xs ${STATUS_COLOR[it.status]}`}>{STATUS_LABEL[it.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

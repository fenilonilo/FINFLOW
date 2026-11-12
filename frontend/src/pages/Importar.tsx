import { useRef, useState, type DragEvent } from 'react'
import Fan from '@/components/fan/Fan'
import MetalCard from '@/components/card/MetalCard'
import PageHeader from '@/components/shell/PageHeader'
import { toast } from '@/components/ui/Toast'
import { useCards } from '@/api/cards'
import { useCategories } from '@/api/catalog'
import { useImports, useImportStatement } from '@/api/imports'
import { usePeriod } from '@/contexts/PeriodContext'
import { formatMoney } from '@/lib/currency'
import { monthLabelFull } from '@/lib/date'
import { sumMoney } from '@/lib/money'
import type { ImportResult } from '@/types/models'

const pad = (n: number) => String(n).padStart(2, '0')

export default function Importar() {
  const period = usePeriod()
  const cards = (useCards().data?.results ?? []).filter((c) => c.is_active)
  const imports = useImports().data ?? []
  const categories = useCategories().data?.results ?? []
  const mutation = useImportStatement()
  const input = useRef<HTMLInputElement>(null)

  const [top, setTop] = useState(0)
  const [kindSel, setKindSel] = useState<'credit' | 'debit'>('credit')
  const [ym, setYm] = useState({ year: period.year, month: period.month })
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [chosen, setChosen] = useState<Record<number, number | null>>({})
  const [editing, setEditing] = useState<number | null>(null)

  const card = cards[top] ?? cards[0]
  const kind = card?.functions.includes(kindSel) ? kindSel : card?.functions[0] ?? 'credit'
  const reset = () => {
    setFile(null)
    setPreview(null)
    setChosen({})
    setEditing(null)
  }
  const params = (f: File) => ({ file: f, cardId: card.id, kind, year: ym.year, month: ym.month })

  function send(f: File) {
    if (!card) return
    setFile(f)
    mutation.mutate(
      { ...params(f), dryRun: true },
      {
        onSuccess: (r) => {
          setPreview(r)
          setChosen(Object.fromEntries(r.items.filter((i) => i.status === 'created').map((i) => [i.index, i.category_id])))
        },
        onError: () => toast('Erro ao ler a fatura', 'error'),
      },
    )
  }

  function confirm() {
    if (!file) return
    mutation.mutate(
      { ...params(file), dryRun: false, categories: chosen },
      {
        onSuccess: (r) => {
          toast(`${r.created} lançamentos importados para ${card.name}`, 'success')
          reset()
        },
        onError: () => toast('Erro ao importar', 'error'),
      },
    )
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) send(f)
  }

  const items = preview?.items ?? []
  const created = items.filter((i) => i.status === 'created')
  const dups = items.filter((i) => i.status === 'duplicate').length
  const catName = (id: number | null, fallback: string | null) => categories.find((c) => c.id === id)?.name ?? fallback ?? 'Outros'

  return (
    <div>
      <PageHeader eyebrow="Fatura de cartão" title="IMPORTAR" />
      <div className="imp">
        <div className="glass rise">
          <div className="eyebrow plain">1 · Escolha o cartão</div>
          <Fan
            size="big"
            label="Cartões"
            items={cards.map((c) => <MetalCard key={c.id} card={{ name: c.name, bank: c.bank, due_day: c.due_day }} />)}
            onChange={(i) => {
              setTop(i)
              reset()
            }}
          />
          <div className="muted" style={{ fontSize: 12 }}>Arraste o cartão para trocar</div>
          <div className="hist">
            {imports.length === 0 && <div className="r"><span>Nenhuma importação ainda</span></div>}
            {imports.map((h) => (
              <div className="r" key={h.id}>
                <span>{h.card_name} · {monthLabelFull(h.month).toLowerCase()}</span>
                <span className="num">{h.created_count} itens · {formatMoney(h.total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rise c2">
          <div className="eyebrow plain" style={{ marginBottom: 14 }}>2 · Solte a fatura</div>
          {card && (
            <div className="meta">
              <div>Fechamento<b>dia {card.closing_day}</b></div>
              <div>Vencimento<b>dia {card.due_day}</b></div>
            </div>
          )}
          {card && (
            <div className="imp-opts">
              {card.functions.length > 1 && (
                <select aria-label="Tipo" value={kind} onChange={(e) => { setKindSel(e.target.value as 'credit' | 'debit'); reset() }}>
                  <option value="credit">Crédito</option>
                  <option value="debit">Débito</option>
                </select>
              )}
              {kind === 'credit' && (
                <input
                  type="month"
                  aria-label="Mês da fatura"
                  value={`${ym.year}-${pad(ym.month)}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number)
                    if (y && m) { setYm({ year: y, month: m }); reset() }
                  }}
                />
              )}
            </div>
          )}
          <div
            className="drop"
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div className="ic">↓</div>
            <b>Arraste a fatura do {card?.name}</b>
            <span className="muted" style={{ fontSize: 13 }}>CSV ou PDF · ou clique para escolher</span>
            <input
              ref={input}
              type="file"
              hidden
              accept=".csv,.pdf,.ofx"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) send(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="glass rise c3 prev">
          <div className="card-h">
            <div className="eyebrow plain">3 · Conferir</div>
            {preview && (
              <span className="muted" style={{ fontSize: 13 }}>
                {items.length} itens · {formatMoney(sumMoney(created.map((i) => i.amount)))} · {dups} duplicados
              </span>
            )}
          </div>
          {!preview ? (
            <div className="empty">
              <div className="ghost" style={{ width: '90%' }} /><div className="ghost" style={{ width: '75%' }} />
              <div className="ghost" style={{ width: '84%' }} /><div className="ghost" style={{ width: '60%' }} />
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>A conferência aparece aqui assim que a fatura for lida.</div>
            </div>
          ) : (
            <>
              <div className="scroll">
                <table>
                  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.index} className={i.status === 'created' ? '' : i.status === 'duplicate' ? 'dup' : i.status}>
                        <td className="num muted">{i.date.slice(8)}/{i.date.slice(5, 7)}</td>
                        <td>
                          {i.description}
                          {i.status === 'refunded' && <small className="tag"> · estorno</small>}
                          {i.status === 'ignored' && <small className="tag"> · ignorado</small>}
                        </td>
                        <td>
                          {i.status !== 'created' ? (
                            <span className="muted">{i.category ?? '—'}</span>
                          ) : editing === i.index ? (
                            <select
                              aria-label="Categoria"
                              autoFocus
                              value={chosen[i.index] ?? ''}
                              onBlur={() => setEditing(null)}
                              onChange={(e) => {
                                setChosen({ ...chosen, [i.index]: e.target.value ? Number(e.target.value) : null })
                                setEditing(null)
                              }}
                            >
                              <option value="">Outros</option>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <button type="button" className="ai" onClick={() => setEditing(i.index)}>{catName(chosen[i.index], i.category)}</button>
                          )}
                        </td>
                        <td>{formatMoney(i.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="prev-foot">
                <span className="muted" style={{ fontSize: 12 }}>✦ categorias sugeridas pela IA local · clique para trocar</span>
                <button type="button" className="btn solid" disabled={mutation.isPending || created.length === 0} onClick={confirm}>
                  Importar {created.length} lançamentos
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

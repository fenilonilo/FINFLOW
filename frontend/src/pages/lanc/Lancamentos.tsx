import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCardsSummary } from '@/api/cards'
import { useCategories, usePaymentMethods, useRecurring } from '@/api/catalog'
import { useGenerateFixed, useMonthSummary } from '@/api/months'
import { useMonthTransactions, useUpdateTransaction } from '@/api/transactions'
import Sheet from '@/components/sheet/Sheet'
import TransactionForm from '@/components/sheet/TransactionForm'
import MonthNav from '@/components/shell/MonthNav'
import PageHeader from '@/components/shell/PageHeader'
import Skeleton from '@/components/ui/Skeleton'
import { toast } from '@/components/ui/Toast'
import { usePeriod } from '@/contexts/PeriodContext'
import { monthLabelFull } from '@/lib/date'
import type { PendingVariable, Transaction } from '@/types/models'
import FaturasCard from './FaturasCard'
import FixosCard from './FixosCard'
import Ledger from './Ledger'
import ResumoCard from './ResumoCard'
import VariablesSheet from './VariablesSheet'
import VencimentosCard from './VencimentosCard'

export default function Lancamentos() {
  const { year, month } = usePeriod()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [pending, setPending] = useState<PendingVariable[]>([])
  const [pendingOpen, setPendingOpen] = useState(false)
  const txs = useMonthTransactions(year, month)
  const summary = useMonthSummary(year, month)
  const recurring = useRecurring()
  const cards = useCardsSummary(year, month)
  const pms = usePaymentMethods()
  const cats = useCategories()
  const update = useUpdateTransaction()
  const genFixed = useGenerateFixed(year, month)
  const today = new Date().toLocaleDateString('sv')
  const sheetOpen = params.has('new') || editing != null

  function closeSheet() {
    setEditing(null)
    setParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n }, { replace: true })
  }
  function openNew() {
    setParams((p) => { const n = new URLSearchParams(p); n.set('new', '1'); return n }, { replace: true })
  }
  function togglePaid(t: Transaction) {
    update.mutate({ id: t.id, is_paid: !t.is_paid }, { onError: () => toast('Erro ao atualizar lançamento', 'error') })
  }
  async function generate() {
    try {
      const r = await genFixed.mutateAsync()
      if (r.pending_variables?.length) { setPending(r.pending_variables); setPendingOpen(true) }
      else toast('Fixos do mês gerados', 'success')
    } catch {
      toast('Erro ao gerar fixos', 'error')
    }
  }

  const rec = recurring.data?.results ?? []
  const all = txs.data ?? []
  const ready = txs.data && recurring.data
  const failed = txs.isError || recurring.isError

  return (
    <div className="lanc">
      <PageHeader
        eyebrow={`${monthLabelFull(month)} · ${year}`}
        title="Lançamentos"
        right={
          <>
            <MonthNav />
            <button type="button" className="btn solid" onClick={openNew}>+ Novo lançamento <kbd>N</kbd></button>
          </>
        }
      />
      <div className="lgrid">
        <div className="col">
          {ready ? (
            <FixosCard txs={all} recurring={rec} onToggle={togglePaid} onGenerate={generate} generating={genFixed.isPending} hasPending={pending.length > 0} onPending={() => setPendingOpen(true)} />
          ) : failed ? <p className="glass muted">Não foi possível carregar os fixos.</p> : <Skeleton className="h-56" />}
          {summary.data ? <ResumoCard s={summary.data} /> : <Skeleton className="h-48" />}
        </div>
        <div className="col">
          {cards.data ? <FaturasCard cards={cards.data} year={year} month={month} /> : <Skeleton className="h-56" />}
          {txs.data && recurring.data ? <VencimentosCard txs={all} recurring={rec} today={today} /> : <Skeleton className="h-56" />}
        </div>
        {txs.data ? (
          <Ledger txs={all} cats={cats.data?.results ?? []} pms={pms.data?.results ?? []} today={today} onEdit={setEditing} onTogglePaid={togglePaid} />
        ) : txs.isError ? <p className="glass muted movs">Não foi possível carregar as movimentações.</p> : <Skeleton className="h-96 movs" />}
      </div>
      <Sheet open={sheetOpen} onClose={closeSheet} title={editing ? 'Editar lançamento' : 'Novo lançamento'}>
        <TransactionForm key={editing?.id ?? 'new'} tx={editing ?? undefined} onDone={closeSheet} />
      </Sheet>
      {pendingOpen && <VariablesSheet items={pending} year={year} month={month} onClose={() => setPendingOpen(false)} onDone={() => setPending([])} />}
    </div>
  )
}

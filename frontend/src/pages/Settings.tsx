import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/contexts/ThemeContext'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import Skeleton from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ColorPicker from '@/components/ui/ColorPicker'
import IconPicker, { IconComponent } from '@/components/ui/IconPicker'
import { toast } from '@/components/ui/Toast'
import Cards from '@/pages/Cards'
import MoneyText from '@/components/ui/MoneyText'
import type { Category, PaymentMethod, RecurringExpense, PaginatedResponse } from '@/types/models'
import {
  Pencil,
  Archive,
  Plus,
  Tag,
  CreditCard,
  Monitor,
  Trash2,
  Repeat,
  User,
} from 'lucide-react'

type Tab = 'categories' | 'payment-methods' | 'cards' | 'fixed' | 'sessions' | 'profile'

const categorySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  icon: z.string().min(1),
  color: z.string().min(1),
  parent: z.number().optional(),
  monthly_budget: z.string().optional(),
})
type CategoryFormData = z.infer<typeof categorySchema>

const paymentSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  icon: z.string().min(1),
  color: z.string().min(1),
})
type PaymentFormData = z.infer<typeof paymentSchema>

interface Session {
  id: string
  device: string
  last_seen: string
  is_current: boolean
}

function FixedList() {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const { data, isLoading } = useQuery<PaginatedResponse<RecurringExpense>>({
    queryKey: ['recurring-expenses'],
    queryFn: () =>
      api.get<PaginatedResponse<RecurringExpense>>('/recurring-expenses/').then((r) => r.data),
  })
  const { data: cards } = useQuery<PaginatedResponse<{ id: number; name: string }>>({
    queryKey: ['cards'],
    queryFn: () => api.get('/cards/').then((r) => r.data),
  })
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/recurring-expenses/${id}/`),
    onSuccess: () => {
      toast('Fixo removido', 'success')
      queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setDeleteId(null)
    },
    onError: () => toast('Erro ao remover', 'error'),
  })
  if (isLoading) return <Skeleton className="h-40" />
  if (!data?.results.length)
    return <EmptyState icon={<Repeat size={32} />} title="Nenhum fixo cadastrado" description="Marque 'Fixo' ao criar um lançamento" />
  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs text-text-muted">
            <th className="px-4 py-3 text-left font-medium">Tipo</th>
            <th className="px-4 py-3 text-left font-medium">Descrição</th>
            <th className="px-4 py-3 text-right font-medium">Valor atual</th>
            <th className="px-4 py-3 text-center font-medium">Dia</th>
            <th className="px-4 py-3 text-left font-medium">Cartão</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {data.results.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-xs text-text-muted">{r.type === 'income' ? 'Entrada' : 'Saída'}</td>
              <td className="px-4 py-3 text-text-primary">{r.description}</td>
              <td className="px-4 py-3 text-right">
                {r.default_amount ? <MoneyText value={r.default_amount} positive={r.type === 'income'} /> : '—'}
              </td>
              <td className="px-4 py-3 text-center text-text-muted">{r.due_day}</td>
              <td className="px-4 py-3 text-xs text-text-muted">
                {cards?.results.find((c) => c.id === r.card)?.name ?? '—'}
              </td>
              <td className="px-4 py-3 text-center">
                <button onClick={() => setDeleteId(r.id)} className="text-text-muted hover:text-danger transition-colors">
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={deleteId !== null}
        title="Remover fixo"
        description="O fixo deixa de ser gerado nos próximos meses."
        confirmLabel="Remover"
        onConfirm={() => deleteId !== null && del.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

function CategoryModal({
  open,
  editingCategory,
  categories,
  onClose,
}: {
  open: boolean
  editingCategory: Category | null
  categories: Category[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedColor, setSelectedColor] = useState(editingCategory?.color ?? '#34d399')
  const [selectedIcon, setSelectedIcon] = useState(editingCategory?.icon ?? 'tag')

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: editingCategory
      ? {
          name: editingCategory.name,
          icon: editingCategory.icon,
          color: editingCategory.color,
          parent: editingCategory.parent ?? undefined,
          monthly_budget: editingCategory.monthly_budget ?? undefined,
        }
      : { icon: 'tag', color: '#34d399' },
  })

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) => api.post('/categories/', data),
    onSuccess: () => {
      toast('Categoria criada', 'success')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
    onError: () => toast('Erro ao criar categoria', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryFormData }) =>
      api.patch(`/categories/${id}/`, data),
    onSuccess: () => {
      toast('Categoria atualizada', 'success')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
    onError: () => toast('Erro ao atualizar categoria', 'error'),
  })

  const onSubmit = (data: CategoryFormData) => {
    const payload = {
      ...data,
      color: selectedColor,
      icon: selectedIcon,
      monthly_budget: data.monthly_budget || null,
      parent: data.parent || null,
    }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: payload as CategoryFormData })
    } else {
      createMutation.mutate(payload as CategoryFormData)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
        <h2 className="mb-5 text-base font-semibold text-text-primary">
          {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Nome *</label>
            <input
              {...register('name')}
              className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
            />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-text-muted">Ícone</label>
              <IconPicker
                value={selectedIcon}
                onChange={(icon) => { setSelectedIcon(icon); setValue('icon', icon) }}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-text-muted">Budget Mensal (R$)</label>
              <input
                {...register('monthly_budget')}
                type="text"
                inputMode="decimal"
                placeholder="Sem limite"
                className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-text-muted">Cor</label>
            <ColorPicker
              value={selectedColor}
              onChange={(c) => { setSelectedColor(c); setValue('color', c) }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Categoria Pai (subcategoria)</label>
            <select
              {...register('parent', { setValueAs: (v) => v === '' ? undefined : Number(v) })}
              className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-muted focus:border-accent/50 focus:outline-none"
            >
              <option value="">Nenhuma (categoria raiz)</option>
              {categories.filter((c) => !c.parent).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentMethodModal({
  open,
  editingMethod,
  onClose,
}: {
  open: boolean
  editingMethod: PaymentMethod | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedColor, setSelectedColor] = useState(editingMethod?.color ?? '#34d399')
  const [selectedIcon, setSelectedIcon] = useState(editingMethod?.icon ?? 'credit-card')

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: editingMethod
      ? { name: editingMethod.name, icon: editingMethod.icon, color: editingMethod.color }
      : { icon: 'credit-card', color: '#34d399' },
  })

  const createMutation = useMutation({
    mutationFn: (data: PaymentFormData) => api.post('/payment-methods/', data),
    onSuccess: () => {
      toast('Forma de pagamento criada', 'success')
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      onClose()
    },
    onError: () => toast('Erro ao criar', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PaymentFormData }) =>
      api.patch(`/payment-methods/${id}/`, data),
    onSuccess: () => {
      toast('Forma de pagamento atualizada', 'success')
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      onClose()
    },
    onError: () => toast('Erro ao atualizar', 'error'),
  })

  const onSubmit = (data: PaymentFormData) => {
    const payload = { ...data, color: selectedColor, icon: selectedIcon }
    if (editingMethod) {
      updateMutation.mutate({ id: editingMethod.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl">
        <h2 className="mb-5 text-base font-semibold text-text-primary">
          {editingMethod ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Nome *</label>
            <input
              {...register('name')}
              className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent/50 focus:outline-none"
            />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-text-muted">Ícone</label>
            <IconPicker
              value={selectedIcon}
              onChange={(icon) => { setSelectedIcon(icon); setValue('icon', icon) }}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-text-muted">Cor</label>
            <ColorPicker
              value={selectedColor}
              onChange={(c) => { setSelectedColor(c); setValue('color', c) }}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-text-muted hover:bg-elevated transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-xl bg-accent/20 px-5 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('categories')

  // Category state
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [archiveCatId, setArchiveCatId] = useState<number | null>(null)

  // Payment method state
  const [pmModalOpen, setPmModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null)
  const [archivePmId, setArchivePmId] = useState<number | null>(null)

  // Sessions
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null)

  const { data: categories, isLoading: catLoading } = useQuery<PaginatedResponse<Category>>({
    queryKey: ['categories'],
    queryFn: () => api.get<PaginatedResponse<Category>>('/categories/').then((r) => r.data),
  })

  const { data: paymentMethods, isLoading: pmLoading } = useQuery<PaginatedResponse<PaymentMethod>>({
    queryKey: ['payment-methods'],
    queryFn: () => api.get<PaginatedResponse<PaymentMethod>>('/payment-methods/').then((r) => r.data),
  })

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get<Session[]>('/auth/sessions/').then((r) => r.data),
    enabled: activeTab === 'sessions',
  })

  const archiveCategoryMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/categories/${id}/`, { is_archived: true }),
    onSuccess: () => {
      toast('Categoria arquivada', 'success')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setArchiveCatId(null)
    },
    onError: () => toast('Erro ao arquivar', 'error'),
  })

  const archivePaymentMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/payment-methods/${id}/`, { is_archived: true }),
    onSuccess: () => {
      toast('Forma de pagamento arquivada', 'success')
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
      setArchivePmId(null)
    },
    onError: () => toast('Erro ao arquivar', 'error'),
  })

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}/`),
    onSuccess: () => {
      toast('Sessão revogada', 'success')
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setRevokeSessionId(null)
    },
    onError: () => toast('Erro ao revogar sessão', 'error'),
  })

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'categories', label: 'Categorias', icon: <Tag size={15} /> },
    { id: 'payment-methods', label: 'Formas de Pagamento', icon: <CreditCard size={15} /> },
    { id: 'cards', label: 'Cartões', icon: <CreditCard size={15} /> },
    { id: 'fixed', label: 'Fixos', icon: <Repeat size={15} /> },
    { id: 'sessions', label: 'Dispositivos', icon: <Monitor size={15} /> },
    { id: 'profile', label: 'Perfil', icon: <User size={15} /> },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-text-primary">Configurações</h1>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-border-subtle bg-surface p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-elevated font-medium text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Gerencie categorias de transações</p>
            <button
              onClick={() => { setEditingCategory(null); setCatModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
            >
              <Plus size={15} />
              Nova Categoria
            </button>
          </div>

          {catLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : !categories?.results.length ? (
            <EmptyState icon={<Tag size={32} />} title="Nenhuma categoria" />
          ) : (
            <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Pai</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Budget/mês</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Lançamentos</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {categories.results.map((cat) => (
                    <tr
                      key={cat.id}
                      className={`hover:bg-elevated/50 transition-colors ${cat.is_archived ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex-shrink-0"
                            style={{ color: cat.color }}
                          >
                            <IconComponent name={cat.icon || 'tag'} size={16} />
                          </span>
                          <span className="font-medium text-text-primary">{cat.name}</span>
                          {cat.is_archived && (
                            <span className="rounded-full bg-text-muted/10 px-1.5 py-0.5 text-xs text-text-muted">
                              arquivada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {cat.parent
                          ? categories.results.find((c) => c.id === cat.parent)?.name ?? '—'
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-text-muted">
                        {cat.monthly_budget
                          ? new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(parseFloat(cat.monthly_budget))
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-text-muted">
                        {cat.transaction_count}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditingCategory(cat); setCatModalOpen(true) }}
                            className="text-text-muted hover:text-info transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          {!cat.is_archived && (
                            <button
                              onClick={() => setArchiveCatId(cat.id)}
                              className="text-text-muted hover:text-warning transition-colors"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payment Methods Tab */}
      {activeTab === 'payment-methods' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">Gerencie formas de pagamento</p>
            <button
              onClick={() => { setEditingPayment(null); setPmModalOpen(true) }}
              className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
            >
              <Plus size={15} />
              Nova Forma
            </button>
          </div>

          {pmLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : !paymentMethods?.results.length ? (
            <EmptyState icon={<CreditCard size={32} />} title="Nenhuma forma de pagamento" />
          ) : (
            <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Nome</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Padrão</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {paymentMethods.results.map((pm) => (
                    <tr
                      key={pm.id}
                      className={`hover:bg-elevated/50 transition-colors ${pm.is_archived ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex-shrink-0"
                            style={{ color: pm.color }}
                          >
                            <IconComponent name={pm.icon || 'credit-card'} size={16} />
                          </span>
                          <span className="font-medium text-text-primary">{pm.name}</span>
                          {pm.is_archived && (
                            <span className="rounded-full bg-text-muted/10 px-1.5 py-0.5 text-xs text-text-muted">
                              arquivada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {pm.is_default ? (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">Padrão</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { setEditingPayment(pm); setPmModalOpen(true) }}
                            className="text-text-muted hover:text-info transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          {!pm.is_archived && (
                            <button
                              onClick={() => setArchivePmId(pm.id)}
                              className="text-text-muted hover:text-warning transition-colors"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'cards' && <Cards />}
      {activeTab === 'fixed' && <FixedList />}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Dispositivos com sessão ativa</p>
          {sessionsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : !sessions?.length ? (
            <EmptyState icon={<Monitor size={32} />} title="Nenhuma sessão ativa" />
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between rounded-2xl border p-4 ${
                    session.is_current
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border-subtle bg-surface'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Monitor size={18} className={session.is_current ? 'text-accent' : 'text-text-muted'} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{session.device}</p>
                      <p className="text-xs text-text-muted">
                        Último acesso:{' '}
                        {new Date(session.last_seen).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  {session.is_current ? (
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">
                      Sessão atual
                    </span>
                  ) : (
                    <button
                      onClick={() => setRevokeSessionId(session.id)}
                      className="rounded-xl border border-danger/20 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 transition-colors"
                    >
                      Revogar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-subtle bg-surface p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Aparência</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Tema</p>
                <p className="text-xs text-text-muted">{theme === 'dark' ? 'Modo escuro' : 'Modo claro'}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="rounded-xl border border-border-subtle bg-elevated px-4 py-2 text-sm text-text-primary hover:border-accent/50 transition-colors"
              >
                {theme === 'dark' ? 'Claro' : 'Escuro'}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-xl font-bold text-accent">
                {user?.first_name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-text-primary">{user?.first_name}</p>
                <p className="text-sm text-text-muted">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Nome</label>
                <input
                  defaultValue={user?.first_name}
                  readOnly
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary opacity-70 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-muted">Email</label>
                <input
                  defaultValue={user?.email}
                  readOnly
                  className="w-full rounded-xl border border-border-subtle bg-elevated px-3 py-2 text-sm text-text-primary opacity-70 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-text-muted">
                  Email gerenciado pelo seu provedor de identidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CategoryModal
        open={catModalOpen}
        editingCategory={editingCategory}
        categories={categories?.results ?? []}
        onClose={() => { setCatModalOpen(false); setEditingCategory(null) }}
      />

      <PaymentMethodModal
        open={pmModalOpen}
        editingMethod={editingPayment}
        onClose={() => { setPmModalOpen(false); setEditingPayment(null) }}
      />

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={archiveCatId !== null}
        title="Arquivar categoria"
        description="Esta categoria não aparecerá mais como opção em novos lançamentos."
        confirmLabel="Arquivar"
        onConfirm={() => archiveCatId !== null && archiveCategoryMutation.mutate(archiveCatId)}
        onCancel={() => setArchiveCatId(null)}
      />

      <ConfirmDialog
        open={archivePmId !== null}
        title="Arquivar forma de pagamento"
        description="Esta forma não aparecerá mais como opção em novos lançamentos."
        confirmLabel="Arquivar"
        onConfirm={() => archivePmId !== null && archivePaymentMutation.mutate(archivePmId)}
        onCancel={() => setArchivePmId(null)}
      />

      <ConfirmDialog
        open={revokeSessionId !== null}
        title="Revogar sessão"
        description="Este dispositivo será desconectado imediatamente."
        confirmLabel="Revogar"
        onConfirm={() => revokeSessionId !== null && revokeSessionMutation.mutate(revokeSessionId)}
        onCancel={() => setRevokeSessionId(null)}
      />
    </div>
  )
}

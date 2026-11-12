import { useState, type CSSProperties } from 'react'
import { useCategories } from '@/api/catalog'
import Sheet from '@/components/sheet/Sheet'
import Skeleton from '@/components/ui/Skeleton'
import { IconComponent } from '@/components/ui/IconPicker'
import { catCols } from '@/lib/month'
import type { Category } from '@/types/models'
import { CategoryForm } from './forms'

export default function CategoriasTab() {
  const { data, isLoading, isError } = useCategories({ is_archived: false })
  const [sheet, setSheet] = useState<Category | 'new' | null>(null)
  if (isLoading) return <Skeleton className="h-40" />
  if (isError) return <p className="muted">Erro ao carregar categorias</p>
  const cats = (data?.results ?? []).filter((c) => !c.is_archived)
  const close = () => setSheet(null)
  return (
    <>
      <div className="bar"><button type="button" className="btn solid" onClick={() => setSheet('new')}>+ Nova categoria</button></div>
      {cats.length === 0 && <p className="muted">Nenhuma categoria ainda.</p>}
      <div className="cats" data-cols={catCols(cats.length)} style={{ '--cols': catCols(cats.length) } as CSSProperties}>
        {cats.map((c) => (
          <button key={c.id} type="button" onClick={() => setSheet(c)}>
            <span style={{ color: c.color, display: 'inline-flex' }}><IconComponent name={c.icon} size={18} /></span>
            {c.name}
          </button>
        ))}
      </div>
      <Sheet open={sheet != null} onClose={close} title="Categoria">
        {sheet != null && <CategoryForm key={sheet === 'new' ? 'new' : sheet.id} item={sheet === 'new' ? undefined : sheet} onDone={close} />}
      </Sheet>
    </>
  )
}

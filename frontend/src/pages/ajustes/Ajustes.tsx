import { Navigate, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '@/components/shell/PageHeader'
import CartoesTab from './CartoesTab'
import CategoriasTab from './CategoriasTab'
import FixosTab from './FixosTab'
import PagamentosTab from './PagamentosTab'
import Tabs from './Tabs'

const TABS = [
  { id: 'categories', label: 'Categorias' },
  { id: 'payments', label: 'Formas de pagamento' },
  { id: 'cards', label: 'Cartões' },
  { id: 'fixed', label: 'Fixos' },
]
const PANES = { categories: CategoriasTab, payments: PagamentosTab, cards: CartoesTab, fixed: FixosTab }

export default function Ajustes() {
  const tab = useParams().tab ?? 'categories'
  const navigate = useNavigate()
  if (!Object.keys(PANES).includes(tab)) return <Navigate to="/settings/categories" replace />
  const Pane = PANES[tab as keyof typeof PANES]
  return (
    <div className="aj-page">
      <PageHeader eyebrow="Cadastros" title="Ajustes" />
      <div className="aj">
        <Tabs tabs={TABS} value={tab} onChange={(id) => navigate(`/settings/${id}`)} />
        <div className="glass rise aj-panel">
          <div className="pane" key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}><Pane /></div>
        </div>
      </div>
    </div>
  )
}

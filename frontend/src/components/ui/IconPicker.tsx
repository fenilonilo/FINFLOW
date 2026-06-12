import { useState, useRef, useEffect } from 'react'
import {
  HeartPulse, Utensils, Gamepad2, Car, Home, Zap, CreditCard,
  ShoppingBag, TrendingUp, TrendingDown, DollarSign, BarChart3,
  PiggyBank, Wallet, Coffee, Phone, Wifi, Music, Book, Dumbbell,
  Shirt, Bus, Plane, Gift, Briefcase, Wrench, Stethoscope,
  Tag, ShoppingCart, Pizza, Bike, Train, Ship, Fuel,
  Tv, Monitor, Tablet, Camera, Headphones, Printer,
  Apple, Leaf, Flower2, Sun, Moon, Star, Heart,
  Baby, Dog, Cat, Fish, Bird,
  GraduationCap, School, Landmark, Building2, Hospital,
  Scissors, Paintbrush, Palette, PenTool, Pencil,
  Globe, Map, Compass, MapPin, Navigation,
  Flame, Snowflake, Umbrella, CloudRain,
  Package, Box, Archive, FolderOpen, Layers,
  Banknote, Receipt, Coins, Calculator, PieChart,
  Trophy, Medal, Target, Rocket, Sparkles, Search,
  type LucideIcon,
} from 'lucide-react'

interface IconEntry {
  icon: LucideIcon
  bg: string
  color: string
}

const ICON_MAP: Record<string, IconEntry> = {
  // Finanças — verde
  'wallet':        { icon: Wallet,       bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'credit-card':   { icon: CreditCard,   bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'banknote':      { icon: Banknote,     bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'coins':         { icon: Coins,        bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'dollar-sign':   { icon: DollarSign,   bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'receipt':       { icon: Receipt,      bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'calculator':    { icon: Calculator,   bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'pie-chart':     { icon: PieChart,     bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'piggy-bank':    { icon: PiggyBank,    bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'trending-up':   { icon: TrendingUp,   bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  'trending-down': { icon: TrendingDown, bg: 'bg-rose-500/15',    color: 'text-rose-400'    },
  'bar-chart-3':   { icon: BarChart3,    bg: 'bg-emerald-500/15', color: 'text-emerald-400' },
  // Alimentação — laranja
  'utensils':      { icon: Utensils, bg: 'bg-orange-500/15', color: 'text-orange-400' },
  'coffee':        { icon: Coffee,   bg: 'bg-orange-500/15', color: 'text-orange-400' },
  'pizza':         { icon: Pizza,    bg: 'bg-orange-500/15', color: 'text-orange-400' },
  'apple':         { icon: Apple,    bg: 'bg-orange-500/15', color: 'text-orange-400' },
  // Transporte — azul
  'car':           { icon: Car,   bg: 'bg-blue-500/15', color: 'text-blue-400' },
  'plane':         { icon: Plane, bg: 'bg-blue-500/15', color: 'text-blue-400' },
  'bus':           { icon: Bus,   bg: 'bg-blue-500/15', color: 'text-blue-400' },
  'train':         { icon: Train, bg: 'bg-blue-500/15', color: 'text-blue-400' },
  'bike':          { icon: Bike,  bg: 'bg-blue-500/15', color: 'text-blue-400' },
  'ship':          { icon: Ship,  bg: 'bg-blue-500/15', color: 'text-blue-400' },
  'fuel':          { icon: Fuel,  bg: 'bg-blue-500/15', color: 'text-blue-400' },
  // Casa — índigo
  'home':          { icon: Home,      bg: 'bg-indigo-500/15', color: 'text-indigo-400' },
  'building-2':    { icon: Building2, bg: 'bg-indigo-500/15', color: 'text-indigo-400' },
  'landmark':      { icon: Landmark,  bg: 'bg-indigo-500/15', color: 'text-indigo-400' },
  // Saúde — vermelho
  'heart-pulse':   { icon: HeartPulse,  bg: 'bg-rose-500/15', color: 'text-rose-400' },
  'stethoscope':   { icon: Stethoscope, bg: 'bg-rose-500/15', color: 'text-rose-400' },
  'hospital':      { icon: Hospital,    bg: 'bg-rose-500/15', color: 'text-rose-400' },
  'dumbbell':      { icon: Dumbbell,    bg: 'bg-rose-500/15', color: 'text-rose-400' },
  // Compras — roxo
  'shopping-bag':  { icon: ShoppingBag,  bg: 'bg-purple-500/15', color: 'text-purple-400' },
  'shopping-cart': { icon: ShoppingCart, bg: 'bg-purple-500/15', color: 'text-purple-400' },
  'gift':          { icon: Gift,         bg: 'bg-purple-500/15', color: 'text-purple-400' },
  'shirt':         { icon: Shirt,        bg: 'bg-purple-500/15', color: 'text-purple-400' },
  // Tecnologia — ciano
  'phone':         { icon: Phone,     bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'monitor':       { icon: Monitor,   bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'tv':            { icon: Tv,        bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'tablet':        { icon: Tablet,    bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'camera':        { icon: Camera,    bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'headphones':    { icon: Headphones, bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'printer':       { icon: Printer,   bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  'wifi':          { icon: Wifi,      bg: 'bg-cyan-500/15', color: 'text-cyan-400' },
  // Entretenimento — amarelo
  'music':         { icon: Music,    bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'gamepad-2':     { icon: Gamepad2, bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'book':          { icon: Book,     bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'trophy':        { icon: Trophy,   bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'medal':         { icon: Medal,    bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  // Natureza — verde-escuro
  'leaf':          { icon: Leaf,      bg: 'bg-green-500/15',  color: 'text-green-400'  },
  'flower-2':      { icon: Flower2,   bg: 'bg-pink-500/15',   color: 'text-pink-400'   },
  'sun':           { icon: Sun,       bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'moon':          { icon: Moon,      bg: 'bg-slate-500/15',  color: 'text-slate-400'  },
  'star':          { icon: Star,      bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'heart':         { icon: Heart,     bg: 'bg-pink-500/15',   color: 'text-pink-400'   },
  'flame':         { icon: Flame,     bg: 'bg-orange-500/15', color: 'text-orange-400' },
  'snowflake':     { icon: Snowflake, bg: 'bg-sky-500/15',    color: 'text-sky-400'    },
  'umbrella':      { icon: Umbrella,  bg: 'bg-sky-500/15',    color: 'text-sky-400'    },
  'cloud-rain':    { icon: CloudRain, bg: 'bg-sky-500/15',    color: 'text-sky-400'    },
  // Animais — teal
  'dog':           { icon: Dog,  bg: 'bg-teal-500/15', color: 'text-teal-400' },
  'cat':           { icon: Cat,  bg: 'bg-teal-500/15', color: 'text-teal-400' },
  'fish':          { icon: Fish, bg: 'bg-teal-500/15', color: 'text-teal-400' },
  'bird':          { icon: Bird, bg: 'bg-teal-500/15', color: 'text-teal-400' },
  'baby':          { icon: Baby, bg: 'bg-pink-500/15', color: 'text-pink-400' },
  // Educação — violeta
  'graduation-cap': { icon: GraduationCap, bg: 'bg-violet-500/15', color: 'text-violet-400' },
  'school':          { icon: School,        bg: 'bg-violet-500/15', color: 'text-violet-400' },
  // Trabalho — âmbar
  'briefcase':     { icon: Briefcase,  bg: 'bg-amber-500/15', color: 'text-amber-400' },
  'wrench':        { icon: Wrench,     bg: 'bg-amber-500/15', color: 'text-amber-400' },
  'scissors':      { icon: Scissors,   bg: 'bg-amber-500/15', color: 'text-amber-400' },
  'paintbrush':    { icon: Paintbrush, bg: 'bg-amber-500/15', color: 'text-amber-400' },
  'palette':       { icon: Palette,    bg: 'bg-amber-500/15', color: 'text-amber-400' },
  'pen-tool':      { icon: PenTool,    bg: 'bg-amber-500/15', color: 'text-amber-400' },
  'pencil':        { icon: Pencil,     bg: 'bg-amber-500/15', color: 'text-amber-400' },
  // Localização — azul-céu
  'globe':         { icon: Globe,       bg: 'bg-sky-500/15', color: 'text-sky-400' },
  'map':           { icon: Map,         bg: 'bg-sky-500/15', color: 'text-sky-400' },
  'compass':       { icon: Compass,     bg: 'bg-sky-500/15', color: 'text-sky-400' },
  'map-pin':       { icon: MapPin,      bg: 'bg-sky-500/15', color: 'text-sky-400' },
  'navigation':    { icon: Navigation,  bg: 'bg-sky-500/15', color: 'text-sky-400' },
  // Geral
  'tag':           { icon: Tag,        bg: 'bg-slate-500/15',  color: 'text-slate-400'  },
  'package':       { icon: Package,    bg: 'bg-slate-500/15',  color: 'text-slate-400'  },
  'box':           { icon: Box,        bg: 'bg-slate-500/15',  color: 'text-slate-400'  },
  'archive':       { icon: Archive,    bg: 'bg-slate-500/15',  color: 'text-slate-400'  },
  'folder-open':   { icon: FolderOpen, bg: 'bg-amber-500/15',  color: 'text-amber-400'  },
  'layers':        { icon: Layers,     bg: 'bg-slate-500/15',  color: 'text-slate-400'  },
  'zap':           { icon: Zap,        bg: 'bg-yellow-500/15', color: 'text-yellow-400' },
  'rocket':        { icon: Rocket,     bg: 'bg-violet-500/15', color: 'text-violet-400' },
  'sparkles':      { icon: Sparkles,   bg: 'bg-pink-500/15',   color: 'text-pink-400'   },
  'target':        { icon: Target,     bg: 'bg-rose-500/15',   color: 'text-rose-400'   },
}

const ICONS = Object.keys(ICON_MAP)

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

function IconComponent({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const entry = ICON_MAP[name]
  if (!entry) return <Tag size={size} className={className} />
  const { icon: Icon } = entry
  return <Icon size={size} className={className} />
}

export { IconComponent }

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = search.trim()
    ? ICONS.filter((i) => i.includes(search.toLowerCase()))
    : ICONS

  const selected = ICON_MAP[value]
  const SelectedIcon = selected?.icon || Tag

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
          selected
            ? `${selected.bg} ${selected.color} border-current/30 hover:border-current/60`
            : 'border-border-subtle bg-elevated text-text-secondary hover:border-accent hover:text-accent hover:bg-accent/10'
        }`}
      >
        <SelectedIcon size={20} />
      </button>

      {open && (
        <div
          className="absolute left-0 z-50 w-80 rounded-2xl border border-border-subtle bg-surface shadow-2xl overflow-hidden"
          style={{ top: '3.25rem' }}
        >
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
            <Search size={14} className="text-text-muted flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar ícone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>

          <div className="grid grid-cols-6 gap-1.5 p-3 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="col-span-6 py-6 text-center text-sm text-text-muted">Nenhum ícone encontrado</p>
            ) : filtered.map((key) => {
              const entry = ICON_MAP[key]!
              const { icon: Icon, bg, color } = entry
              const isSelected = value === key
              return (
                <button
                  key={key}
                  type="button"
                  title={key}
                  onClick={() => { onChange(key); setOpen(false); setSearch('') }}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 ${bg} ${color} ${
                    isSelected
                      ? 'ring-2 ring-current ring-offset-1 ring-offset-surface scale-110 shadow-lg'
                      : 'opacity-70 hover:opacity-100 hover:scale-110'
                  }`}
                >
                  <Icon size={20} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

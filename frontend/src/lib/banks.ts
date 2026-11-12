import type { BankKey } from '@/types/models'

export interface BankStyle {
  label: string
  /** CSS background do cartão */
  gradient: string
  /** cor do texto */
  ink: string
  /** detalhe / cor representativa (usada como `color` do cartão) */
  accent: string
  /** logotipo curto do cartão metálico (fallback: label) */
  wm?: string
  wmStyle?: { fontWeight?: number; letterSpacing?: string; fontSize?: string }
}

export const BANKS: Record<BankKey, BankStyle> = {
  nubank: { label: 'Nubank', gradient: 'linear-gradient(135deg,#9a1fe8,#5B0A93 70%)', ink: '#ffffff', accent: '#820AD1', wm: 'nu', wmStyle: { fontWeight: 800, letterSpacing: '-.05em', fontSize: '30px' } },
  inter: { label: 'Inter', gradient: 'linear-gradient(135deg,#ff8a1f,#d65800 75%)', ink: '#ffffff', accent: '#FF7A00', wm: 'inter', wmStyle: { fontWeight: 700 } },
  itau: { label: 'Itaú', gradient: 'linear-gradient(135deg,#EC7000 0 78%,#003399 78%)', ink: '#ffffff', accent: '#EC7000' },
  bradesco: { label: 'Bradesco', gradient: 'linear-gradient(135deg,#CC092F,#8A0020)', ink: '#ffffff', accent: '#CC092F' },
  santander: { label: 'Santander', gradient: 'linear-gradient(135deg,#EC0000,#A30000)', ink: '#ffffff', accent: '#EC0000' },
  bb: { label: 'Banco do Brasil', gradient: 'linear-gradient(135deg,#FCFC30,#F2E600)', ink: '#003DA5', accent: '#FCFC30' },
  caixa: { label: 'Caixa', gradient: 'linear-gradient(135deg,#005CA9,#004380)', ink: '#ffffff', accent: '#F39200' },
  c6: { label: 'C6 Bank', gradient: 'linear-gradient(135deg,#3a3a3a,#0c0c0c 70%)', ink: '#ffffff', accent: '#242424', wm: 'C6', wmStyle: { fontWeight: 800 } },
  xp: { label: 'XP', gradient: 'linear-gradient(135deg,#000000,#111111)', ink: '#ffffff', accent: '#FFD400' },
  btg: { label: 'BTG Pactual', gradient: 'linear-gradient(135deg,#0B2341,#051226)', ink: '#ffffff', accent: '#0B2341' },
  picpay: { label: 'PicPay', gradient: 'linear-gradient(135deg,#21C25E,#11A047)', ink: '#ffffff', accent: '#21C25E' },
  mercadopago: { label: 'Mercado Pago', gradient: 'linear-gradient(135deg,#00B1EA,#0089C6)', ink: '#2D3277', accent: '#00B1EA' },
  neon: { label: 'Neon', gradient: 'linear-gradient(135deg,#00E5FF,#0099CC)', ink: '#04202b', accent: '#00E5FF' },
  pan: { label: 'Banco Pan', gradient: 'linear-gradient(135deg,#00AFEF,#0077B6)', ink: '#ffffff', accent: '#00AFEF' },
  other: { label: 'Outro', gradient: '', ink: '#ffffff', accent: '#818cf8' },
}

export const BANK_KEYS = Object.keys(BANKS) as BankKey[]

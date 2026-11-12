import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSessions } from '@/api/sessions'
import { useAuth } from '@/contexts/AuthContext'
import { usePeriod } from '@/contexts/PeriodContext'
import { monthLabelFull } from '@/lib/date'
import FlipCard, { type FlipHandle } from '@/components/flip/FlipCard'

const User = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>
)

export default function ProfileCard() {
  const { user, logout } = useAuth()
  const { year, month } = usePeriod()
  const { data: sessions } = useSessions()
  const nav = useNavigate()
  const flip = useRef<FlipHandle>(null)
  const onAccount = useLocation().pathname.startsWith('/account')
  const name = user?.first_name ?? ''
  const go = (to: string) => { nav(to); setTimeout(() => flip.current?.flipFront(), 300) }

  return (
    <FlipCard
      ref={flip}
      className={onAccount ? 'on-account' : ''}
      front={
        <>
          <div className="pf-photo">
            {user?.avatar_url ? (
              <img className="pf-img" src={user.avatar_url} alt="" />
            ) : (
              <svg className="sil" viewBox="0 0 100 120" aria-hidden="true">
                <defs><linearGradient id="silg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5fbf6e" /><stop offset="1" stopColor="#1d4a26" /></linearGradient></defs>
                <circle cx="50" cy="34" r="19" fill="url(#silg)" />
                <path d="M10 120V92c0-24 18-36 40-36s40 12 40 36v28z" fill="url(#silg)" />
              </svg>
            )}
            <span className="pf-cam" title="Adicionar foto"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg></span>
            <div className="pf-name"><b>{name}</b><small>{monthLabelFull(month)} · {year}</small></div>
          </div>
          <div className="pf-foot">
            <div><b>Conta pessoal</b><small>Sessão ativa</small></div>
            <span className="fpill"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0114-5.3M20 4v4h-4M20 12a8 8 0 01-14 5.3M4 20v-4h4" /></svg>Conta</span>
          </div>
        </>
      }
      back={
        <>
          <div className="bk-h">
            <span className="bk-av">{user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <User />}</span>
            <div><b>{name}</b><small>{user?.email}</small></div>
          </div>
          <div className="eyebrow plain" style={{ margin: '4px 0 2px 2px' }}>Conta</div>
          <button className="fb" onClick={() => go('/account/profile')}><User /><span>Perfil<small>nome, e-mail e foto</small></span></button>
          <button className="fb" onClick={() => go('/account/devices')}>
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="14" height="10" rx="1.5" /><path d="M7 18h6" /><rect x="17" y="9" width="5" height="11" rx="1" /></svg>
            <span>Dispositivos<small>{sessions?.length ?? 0} {sessions?.length === 1 ? 'sessão' : 'sessões'}</small></span>
          </button>
          <button className="fb out" onClick={() => void logout()}>
            <svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>Sair
          </button>
        </>
      }
    />
  )
}

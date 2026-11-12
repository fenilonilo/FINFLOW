import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateMe, useUploadAvatar } from '@/api/account'
import { useRevokeSession, useSessions } from '@/api/sessions'
import { useAuth } from '@/contexts/AuthContext'
import PageHeader from '@/components/shell/PageHeader'
import Tabs from '@/pages/ajustes/Tabs'
import { toast } from '@/components/ui/Toast'

const TABS = [
  { id: 'profile', label: 'Perfil' },
  { id: 'devices', label: 'Dispositivos' },
]
const MAX_AVATAR = 2 * 1024 * 1024

// dias de calendário entre last_seen_at e agora (determinístico: now injetável)
export function daysAgo(iso: string, now = new Date()) {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((day(now) - day(new Date(iso))) / 86400000))
}

const schema = z.object({
  first_name: z.string().trim().min(1, 'Informe o nome'),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
})
type Data = z.infer<typeof schema>

const Sil = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>

function Perfil() {
  const { user } = useAuth()
  const update = useUpdateMe()
  const upload = useUploadAvatar()
  const file = useRef<HTMLInputElement>(null)
  const [photoErr, setPhotoErr] = useState('')
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Data>({
    resolver: zodResolver(schema),
    defaultValues: { first_name: user?.first_name ?? '', email: user?.email ?? '' },
  })

  const onSubmit = (d: Data) =>
    update.mutate(d, {
      onSuccess: () => toast('Perfil salvo', 'success'),
      onError: (err) => {
        const e = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors ?? {}
        for (const [k, v] of Object.entries(e)) if ((k === 'email' || k === 'first_name') && v?.[0]) setError(k, { message: v[0] })
        toast('Não foi possível salvar o perfil', 'error')
      },
    })

  function onFile(f?: File) {
    if (!f) return
    if (!['image/jpeg', 'image/png'].includes(f.type)) return setPhotoErr('A foto deve ser JPG ou PNG')
    if (f.size > MAX_AVATAR) return setPhotoErr('A foto deve ter até 2 MB')
    setPhotoErr('')
    upload.mutate(f, {
      onSuccess: () => toast('Foto atualizada', 'success'),
      onError: (err) => {
        const d = (err as { response?: { data?: { detail?: string; errors?: { avatar?: string[] } } } })?.response?.data
        setPhotoErr(d?.errors?.avatar?.[0] ?? d?.detail ?? 'Não foi possível enviar a foto')
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="me-top">
        <div className="cph lg">
          {user?.avatar_url ? <img src={user.avatar_url} alt="" /> : <Sil />}
          <i><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg></i>
        </div>
        <div>
          <b>Foto do perfil</b><small>JPG ou PNG · até 2 MB</small>
          <button type="button" className="btn line" disabled={upload.isPending} onClick={() => file.current?.click()}>Enviar foto</button>
          <input ref={file} type="file" hidden accept="image/jpeg,image/png" aria-label="Arquivo da foto"
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          {photoErr && <p className="ferr" role="alert">{photoErr}</p>}
        </div>
      </div>
      <label className="field"><span>Nome</span><input {...register('first_name')} />
        {errors.first_name && <p className="ferr">{errors.first_name.message}</p>}</label>
      <label className="field"><span>E-mail</span><input type="email" {...register('email')} />
        {errors.email && <p className="ferr">{errors.email.message}</p>}</label>
      <button type="submit" className="btn solid" style={{ marginTop: 6 }} disabled={update.isPending}>Salvar</button>
    </form>
  )
}

function Dispositivos() {
  const { data, isLoading, isError } = useSessions()
  const revoke = useRevokeSession()
  const list = (data ?? []).filter((s) => !s.revoked)
  if (isLoading) return null
  if (isError) return <p className="mu">Não foi possível carregar as sessões</p>
  if (!list.length) return <p className="mu">Nenhuma sessão registrada</p>
  const end = (id: number) =>
    revoke.mutate(id, { onSuccess: () => toast('Sessão encerrada', 'success'), onError: () => toast('Não foi possível encerrar', 'error') })
  return (
    <div className="rows">
      {list.map((s) => {
        const d = daysAgo(s.last_seen_at)
        return (
          <div className="rw" key={s.id}>
            <div className="ic">{/mobile|iphone|ios|android/i.test(s.device_name) ? '📱' : '💻'}</div>
            <div className="tt">
              <b>{s.device_name}</b>
              <small>{s.is_current ? 'este dispositivo · ativo agora' : d === 0 ? 'último acesso hoje' : `último acesso há ${d} ${d === 1 ? 'dia' : 'dias'}`}</small>
            </div>
            {s.is_current
              ? <span className="end pill">Ativo</span>
              : <button type="button" className="end pill line" disabled={revoke.isPending && revoke.variables === s.id} onClick={() => end(s.id)}>Encerrar</button>}
          </div>
        )
      })}
    </div>
  )
}

export default function Conta() {
  const tab = useParams().tab ?? 'profile'
  const navigate = useNavigate()
  if (!TABS.some((t) => t.id === tab)) return <Navigate to="/account/profile" replace />
  return (
    <div className="aj-page conta">
      <PageHeader eyebrow="Configuração" title="Conta" />
      <div className="aj">
        <Tabs tabs={TABS} value={tab} onChange={(id) => navigate(`/account/${id}`)} />
        <div className="glass rise aj-panel">
          <div className="pane" key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'profile' ? <Perfil /> : <Dispositivos />}
          </div>
        </div>
      </div>
    </div>
  )
}

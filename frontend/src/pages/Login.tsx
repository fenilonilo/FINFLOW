import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
type Data = z.infer<typeof schema>

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Data>({
    resolver: zodResolver(schema),
  })

  if (user) return <Navigate to="/" replace />

  async function onSubmit({ email, password }: Data) {
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status
      setError(status === 401 ? 'E-mail ou senha incorretos' : 'Não foi possível entrar. Tente novamente.')
    }
  }

  return (
    <div className="login">
      <div className="login-logo">Fin<b>flow</b></div>
      <div className="tagline">Money,<br /><span>energy.</span></div>
      <form className="card" noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <div className="eyebrow">Bem-vindo de volta</div>
        <h2>Entrar</h2>
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="username" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined} {...register('email')} />
        </label>
        {errors.email && <em id="email-err" className="ferr" role="alert">{errors.email.message}</em>}
        <label className="field">
          <span>Senha</span>
          <input type="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined} {...register('password')} />
        </label>
        {errors.password && <em id="password-err" className="ferr" role="alert">{errors.password.message}</em>}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn solid" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
        {/* ponytail: UI-only, backend sem semântica de "lembrar dispositivo" */}
        <div className="row">
          <label><input type="checkbox" defaultChecked style={{ accentColor: '#7ee08a' }} /> Lembrar este dispositivo</label>
          <span>v2.0</span>
        </div>
      </form>
    </div>
  )
}

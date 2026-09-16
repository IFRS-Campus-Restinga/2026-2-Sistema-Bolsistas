import { useEffect, useState } from 'react'
import {
  Modal,
  Button,
  FormField,
  TextInput,
  Select,
  FormActions,
  DataTable,
  PageHeader,
} from '../../components'
import {
  deleteEmailCoordenador,
  getEmailsCoordenadores,
  getUsuarios,
  patchEmailCoordenador,
  patchStatusUsuario,
  patchTipoArea,
  postEmailCoordenador,
} from '../../api'

const ROLE_LABEL = {
  ADMINISTRADOR: 'Administrador',
  COORDENADOR_AREA: 'Coordenador de Área',
  COORDENADOR_PROJETO: 'Coordenador de Projeto',
  ALUNO: 'Aluno',
}

const TIPO_AREA_OPTIONS = [
  { value: 'ENSINO', label: 'Ensino' },
  { value: 'PESQUISA', label: 'Pesquisa' },
  { value: 'EXTENSAO', label: 'Extensão' },
]

function tipoAreaLabel(value) {
  return TIPO_AREA_OPTIONS.find((o) => o.value === value)?.label || value
}

function StatusBadge({ ativo }) {
  return (
    <span className={`badge ${ativo ? 'badge--green' : 'badge--red'}`}>
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function UsuariosPage() {
  // usuários
  const [usuarios, setUsuarios] = useState([])
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true)
  const [erroUsuarios, setErroUsuarios] = useState(null)

  // modal editar usuário
  const [modalUsuarioAberto, setModalUsuarioAberto] = useState(false)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null)
  const [tipoAreaEditado, setTipoAreaEditado] = useState('')
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [erroSalvarUsuario, setErroSalvarUsuario] = useState(null)

  // e-mails de coordenadores
  const [emails, setEmails] = useState([])
  const [carregandoEmails, setCarregandoEmails] = useState(true)
  const [erroEmails, setErroEmails] = useState(null)

  // modal add/editar e-mail
  const [modalEmailAberto, setModalEmailAberto] = useState(false)
  const [emailSelecionado, setEmailSelecionado] = useState(null) // null = novo
  const [emailEditado, setEmailEditado] = useState('')
  const [tipoAreaEmailEditado, setTipoAreaEmailEditado] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)
  const [erroSalvarEmail, setErroSalvarEmail] = useState(null)

  useEffect(() => {
    carregarUsuarios()
    carregarEmails()
  }, [])

  function carregarUsuarios() {
    setCarregandoUsuarios(true)
    getUsuarios()
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar usuários')
        setUsuarios(await res.json())
      })
      .catch((e) => setErroUsuarios(e.message))
      .finally(() => setCarregandoUsuarios(false))
  }

  function carregarEmails() {
    setCarregandoEmails(true)
    getEmailsCoordenadores()
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao carregar e-mails')
        setEmails(await res.json())
      })
      .catch((e) => setErroEmails(e.message))
      .finally(() => setCarregandoEmails(false))
  }

  // ── modal usuário ──
  const abrirModalUsuario = (usuario) => {
    setUsuarioSelecionado(usuario)
    setTipoAreaEditado(usuario.tipo_area || '')
    setErroSalvarUsuario(null)
    setModalUsuarioAberto(true)
  }

  const fecharModalUsuario = () => {
    setModalUsuarioAberto(false)
    setUsuarioSelecionado(null)
  }

  const alternarStatus = async (usuario) => {
    const novoStatus = !usuario.is_active
    const acao = novoStatus ? 'ativar' : 'desativar'
    if (!confirm(`Deseja ${acao} ${usuario.nome || usuario.email}?`)) return
    const res = await patchStatusUsuario(usuario.id, novoStatus)
    if (res.ok) {
      const atualizado = await res.json()
      setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)))
    }
  }

  const salvarUsuario = async () => {
    setSalvandoUsuario(true)
    setErroSalvarUsuario(null)
    try {
      const res = await patchTipoArea(usuarioSelecionado.id, tipoAreaEditado)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.tipo_area?.[0] || body?.detail || 'Erro ao salvar')
      }
      const atualizado = await res.json()
      setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)))
      setEmails((prev) =>
        prev.map((e) =>
          e.email?.toLowerCase() === usuarioSelecionado.email?.toLowerCase()
            ? { ...e, tipo_area: tipoAreaEditado }
            : e
        )
      )
      fecharModalUsuario()
    } catch (e) {
      setErroSalvarUsuario(e.message)
    } finally {
      setSalvandoUsuario(false)
    }
  }

  // ── modal e-mail ──
  const abrirModalNovoEmail = () => {
    setEmailSelecionado(null)
    setEmailEditado('')
    setTipoAreaEmailEditado('')
    setErroSalvarEmail(null)
    setModalEmailAberto(true)
  }

  const abrirModalEditarEmail = (entrada) => {
    setEmailSelecionado(entrada)
    setEmailEditado(entrada.email)
    setTipoAreaEmailEditado(entrada.tipo_area)
    setErroSalvarEmail(null)
    setModalEmailAberto(true)
  }

  const fecharModalEmail = () => {
    setModalEmailAberto(false)
    setEmailSelecionado(null)
  }

  const salvarEmail = async () => {
    setSalvandoEmail(true)
    setErroSalvarEmail(null)
    try {
      const res = emailSelecionado
        ? await patchEmailCoordenador(emailSelecionado.id, emailEditado, tipoAreaEmailEditado)
        : await postEmailCoordenador(emailEditado, tipoAreaEmailEditado)

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.email?.[0] || body?.tipo_area?.[0] || body?.detail || 'Erro ao salvar'
        )
      }

      const salvo = await res.json()
      setEmails((prev) =>
        emailSelecionado ? prev.map((e) => (e.id === salvo.id ? salvo : e)) : [...prev, salvo]
      )
      carregarUsuarios()
      fecharModalEmail()
    } catch (e) {
      setErroSalvarEmail(e.message)
    } finally {
      setSalvandoEmail(false)
    }
  }

  const removerEmail = async (entrada) => {
    if (!confirm(`Remover ${entrada.email}?`)) return
    const res = await deleteEmailCoordenador(entrada.id)
    if (res.ok) {
      setEmails((prev) => prev.filter((e) => e.id !== entrada.id))
      carregarUsuarios()
    } else {
      const body = await res.json().catch(() => null)
      alert(body?.detail || 'Erro ao remover e-mail.')
    }
  }

  const rowsUsuarios = usuarios.map((u) => [
    u.nome || '—',
    u.email || '—',
    <span key="role">
      {ROLE_LABEL[u.role] || u.role}
      {u.tipo_area && (
        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
          ({tipoAreaLabel(u.tipo_area)})
        </span>
      )}
    </span>,
    <StatusBadge key="status" ativo={u.is_active} />,
    <div key="acoes" style={{ display: 'flex', gap: 8 }}>
      {u.role === 'COORDENADOR_AREA' && (
        <Button variant="outline" size="sm" onClick={() => abrirModalUsuario(u)}>
          Editar
        </Button>
      )}
      <Button
        variant={u.is_active ? 'danger' : 'accent'}
        size="sm"
        onClick={() => alternarStatus(u)}
      >
        {u.is_active ? 'Desativar' : 'Ativar'}
      </Button>
    </div>,
  ])

  const rowsEmails = emails.map((e) => [
    e.email,
    tipoAreaLabel(e.tipo_area),
    <div key="acoes" style={{ display: 'flex', gap: 8 }}>
      <Button variant="outline" size="sm" onClick={() => abrirModalEditarEmail(e)}>
        Editar
      </Button>
      <Button variant="danger" size="sm" onClick={() => removerEmail(e)}>
        Remover
      </Button>
    </div>,
  ])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {/* ── Usuários ── */}
        <section>
          <PageHeader title="Usuários" />
          {carregandoUsuarios && <p style={{ color: '#6b7280', fontSize: 14 }}>Carregando...</p>}
          {erroUsuarios && <p style={{ color: '#dc2626', fontSize: 14 }}>{erroUsuarios}</p>}
          {!carregandoUsuarios && !erroUsuarios && (
            <DataTable
              columns={['Nome', 'E-mail', 'Grupo / Perfil', 'Status', 'Ações']}
              rows={rowsUsuarios}
              emptyMessage="Nenhum usuário encontrado."
            />
          )}
        </section>

        {/* ── E-mails de Coordenadores de Área ── */}
        <section>
          <PageHeader
            title="E-mails de Coordenadores de Área"
            action={
              <Button variant="primary" onClick={abrirModalNovoEmail}>
                + Adicionar
              </Button>
            }
          />
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: -16, marginBottom: 16 }}>
            Servidores cujo e-mail estiver nesta lista serão reconhecidos como Coordenadores de Área
            ao fazer login.
          </p>
          {carregandoEmails && <p style={{ color: '#6b7280', fontSize: 14 }}>Carregando...</p>}
          {erroEmails && <p style={{ color: '#dc2626', fontSize: 14 }}>{erroEmails}</p>}
          {!carregandoEmails && !erroEmails && (
            <DataTable
              columns={['E-mail', 'Tipo de Área', 'Ações']}
              rows={rowsEmails}
              emptyMessage="Nenhum e-mail cadastrado."
            />
          )}
        </section>
      </div>

      {/* ── Modal editar usuário ── */}
      {modalUsuarioAberto && usuarioSelecionado && (
        <Modal
          onClose={fecharModalUsuario}
          title={`Editar Usuário — ${ROLE_LABEL[usuarioSelecionado.role] || ''}`}
        >
          <FormField label="Nome">
            <TextInput readOnly disabled value={usuarioSelecionado.nome || ''} />
          </FormField>
          <FormField label="E-mail">
            <TextInput readOnly disabled value={usuarioSelecionado.email || ''} />
          </FormField>
          {usuarioSelecionado.role === 'COORDENADOR_AREA' && (
            <FormField label="Tipo de Área">
              <Select value={tipoAreaEditado} onChange={(e) => setTipoAreaEditado(e.target.value)}>
                <option value="">Selecione...</option>
                {TIPO_AREA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {erroSalvarUsuario && (
            <p style={{ fontSize: 12, color: '#dc2626' }}>{erroSalvarUsuario}</p>
          )}
          <FormActions>
            <Button variant="outline" onClick={fecharModalUsuario}>
              Cancelar
            </Button>
            {usuarioSelecionado.role === 'COORDENADOR_AREA' && (
              <Button
                variant="primary"
                onClick={salvarUsuario}
                disabled={salvandoUsuario || !tipoAreaEditado}
              >
                {salvandoUsuario ? 'Salvando...' : 'Salvar'}
              </Button>
            )}
          </FormActions>
        </Modal>
      )}

      {modalEmailAberto && (
        <Modal
          onClose={fecharModalEmail}
          title={
            emailSelecionado ? 'Editar E-mail de Coordenador' : 'Adicionar E-mail de Coordenador'
          }
        >
          <FormField label="E-mail">
            <TextInput
              type="email"
              value={emailEditado}
              onChange={(e) => setEmailEditado(e.target.value)}
              placeholder="coordenador@ifrs.edu.br"
            />
          </FormField>
          <FormField label="Tipo de Área">
            <Select
              value={tipoAreaEmailEditado}
              onChange={(e) => setTipoAreaEmailEditado(e.target.value)}
            >
              <option value="">Selecione...</option>
              {TIPO_AREA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          {erroSalvarEmail && <p style={{ fontSize: 12, color: '#dc2626' }}>{erroSalvarEmail}</p>}
          <FormActions>
            <Button variant="outline" onClick={fecharModalEmail}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={salvarEmail}
              disabled={salvandoEmail || !emailEditado || !tipoAreaEmailEditado}
            >
              {salvandoEmail ? 'Salvando...' : 'Salvar'}
            </Button>
          </FormActions>
        </Modal>
      )}
    </>
  )
}

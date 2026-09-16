import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
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
  { value: 'INDISSOCIAVEL', label: 'Indissociável' },
]

function tipoAreaLabel(value) {
  return TIPO_AREA_OPTIONS.find((o) => o.value === value)?.label || value
}

// ─── seção: tabela de usuários ────────────────────────────────────────────────

function TabelaUsuarios({ usuarios, onEditar, onAtivarDesativar }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Grupo / Perfil</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{u.nome || '—'}</td>
              <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
              <td className="px-4 py-3 text-gray-600">
                {ROLE_LABEL[u.role] || u.role}
                {u.tipo_area && (
                  <span className="ml-1 text-xs text-gray-400">({tipoAreaLabel(u.tipo_area)})</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {u.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {u.role === 'COORDENADOR_AREA' && (
                    <button
                      onClick={() => onEditar(u)}
                      className="px-3 py-1 text-xs rounded border border-green-600 text-green-700 hover:bg-green-50 transition-colors"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => onAtivarDesativar(u)}
                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                      u.is_active
                        ? 'border-red-400 text-red-500 hover:bg-red-50'
                        : 'border-green-600 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    {u.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                Nenhum usuário encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── seção: tabela de e-mails de coordenadores ────────────────────────────────

function TabelaEmailsCoordenadores({ emails, onEditar, onRemover }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo de Área</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Ações</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((e) => (
            <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{e.email}</td>
              <td className="px-4 py-3 text-gray-600">{tipoAreaLabel(e.tipo_area)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditar(e)}
                    className="px-3 py-1 text-xs rounded border border-green-600 text-green-700 hover:bg-green-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onRemover(e)}
                    className="px-3 py-1 text-xs rounded border border-red-400 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {emails.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">
                Nenhum e-mail cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
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
      // Reflete a mudança na tabela de e-mails se o registro já existir
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

  return (
    <>
      <div className="p-6 space-y-10">
        {/* ── Usuários ── */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Usuários</h2>
          {carregandoUsuarios && <p className="text-gray-500 text-sm">Carregando usuários...</p>}
          {!carregandoUsuarios && erroUsuarios && (
            <p className="text-red-600 text-sm">{erroUsuarios}</p>
          )}
          {!carregandoUsuarios && !erroUsuarios && (
            <TabelaUsuarios
              usuarios={usuarios}
              onEditar={abrirModalUsuario}
              onAtivarDesativar={alternarStatus}
            />
          )}
        </section>

        {/* ── E-mails de Coordenadores de Área ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                E-mails de Coordenadores de Área
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Servidores cujo e-mail estiver nesta lista serão reconhecidos como Coordenadores de
                Área ao fazer login.
              </p>
            </div>
            <button
              onClick={abrirModalNovoEmail}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              + Adicionar
            </button>
          </div>

          {carregandoEmails && <p className="text-gray-500 text-sm">Carregando...</p>}
          {!carregandoEmails && erroEmails && <p className="text-red-600 text-sm">{erroEmails}</p>}
          {!carregandoEmails && !erroEmails && (
            <TabelaEmailsCoordenadores
              emails={emails}
              onEditar={abrirModalEditarEmail}
              onRemover={removerEmail}
            />
          )}
        </section>
      </div>

      {/* ── Modal editar usuário ── */}
      <Modal
        isOpen={modalUsuarioAberto}
        onClose={fecharModalUsuario}
        title={`Editar Usuário — ${ROLE_LABEL[usuarioSelecionado?.role] || ''}`}
      >
        {usuarioSelecionado && (
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-nome" className="block text-xs font-medium text-gray-500 mb-1">
                Nome
              </label>
              <input
                id="edit-nome"
                readOnly
                value={usuarioSelecionado.nome || ''}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="edit-email" className="block text-xs font-medium text-gray-500 mb-1">
                E-mail
              </label>
              <input
                id="edit-email"
                readOnly
                value={usuarioSelecionado.email || ''}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
            {usuarioSelecionado.role === 'COORDENADOR_AREA' && (
              <div>
                <label
                  htmlFor="edit-tipo-area"
                  className="block text-xs font-medium text-gray-500 mb-1"
                >
                  Tipo de Área
                </label>
                <select
                  id="edit-tipo-area"
                  value={tipoAreaEditado}
                  onChange={(e) => setTipoAreaEditado(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Selecione...</option>
                  {TIPO_AREA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {erroSalvarUsuario && <p className="text-xs text-red-600">{erroSalvarUsuario}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={fecharModalUsuario}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              {usuarioSelecionado.role === 'COORDENADOR_AREA' && (
                <button
                  onClick={salvarUsuario}
                  disabled={salvandoUsuario || !tipoAreaEditado}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvandoUsuario ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal add/editar e-mail ── */}
      <Modal
        isOpen={modalEmailAberto}
        onClose={fecharModalEmail}
        title={
          emailSelecionado ? 'Editar E-mail de Coordenador' : 'Adicionar E-mail de Coordenador'
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="email-coord" className="block text-xs font-medium text-gray-500 mb-1">
              E-mail
            </label>
            <input
              id="email-coord"
              type="email"
              value={emailEditado}
              onChange={(e) => setEmailEditado(e.target.value)}
              placeholder="coordenador@ifrs.edu.br"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label
              htmlFor="tipo-area-coord"
              className="block text-xs font-medium text-gray-500 mb-1"
            >
              Tipo de Área
            </label>
            <select
              id="tipo-area-coord"
              value={tipoAreaEmailEditado}
              onChange={(e) => setTipoAreaEmailEditado(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">Selecione...</option>
              {TIPO_AREA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {erroSalvarEmail && <p className="text-xs text-red-600">{erroSalvarEmail}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={fecharModalEmail}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={salvarEmail}
              disabled={salvandoEmail || !emailEditado || !tipoAreaEmailEditado}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvandoEmail ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

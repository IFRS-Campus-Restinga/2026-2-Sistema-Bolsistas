import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { editaisFetch, bolsasFetch } from '../api'
import {
  Layout,
  PageHeader,
  Button,
  FormField,
  FormActions,
  Select,
  TextArea,
  TextInput,
  Alert,
  IconHome,
  IconBriefcase,
  IconUsers,
  IconFileText,
  IconArrowLeft,
} from '../components'
import './SolicitarBolsaPage.css'

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'projetos', label: 'Meus Projetos', icon: <IconBriefcase /> },
  { id: 'bolsistas', label: 'Bolsistas', icon: <IconUsers /> },
  { id: 'bolsas', label: 'Minhas Bolsas', icon: <IconFileText /> },
]

const MODALIDADES = [
  { value: 'BICT', label: 'Bolsa de Iniciação Científica (BICT)' },
  { value: 'BIDTI', label: 'Bolsa de Iniciação ao Desenv. Tecnológico e Inovação (BIDTI)' },
  { value: 'BAT', label: 'Bolsa de Apoio Técnico (BAT)' },
]

const CARGAS = [
  { value: '8', label: '8h semanais' },
  { value: '12', label: '12h semanais' },
  { value: '16', label: '16h semanais' },
]

export default function SolicitarBolsaPage({ me, initials, onVoltarHub }) {
  const navigate = useNavigate()
  const [active, setActive] = useState('bolsas')

  const [editais, setEditais] = useState([])
  const [editalId, setEditalId] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [cargaHoraria, setCargaHoraria] = useState('')
  const [prerequisitos, setPrerequisitos] = useState('')
  const [notaMinima, setNotaMinima] = useState('')
  const [dataInicioVigencia, setDataInicioVigencia] = useState('')
  const [dataFimVigencia, setDataFimVigencia] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    editaisFetch('/')
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setEditais(data.filter((e) => e.status === 'EM_VIGOR'))
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro(null)
    setEnviando(true)

    try {
      const res = await bolsasFetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edital: Number(editalId),
          modalidade,
          carga_horaria_semanal: Number(cargaHoraria),
          prerequisitos,
          nota_minima: notaMinima ? Number(notaMinima) : null,
          data_inicio_vigencia: dataInicioVigencia || null,
          data_fim_vigencia: dataFimVigencia || null,
        }),
      })

      if (!res.ok) {
        const corpo = await res.json().catch(() => null)
        const msg =
          corpo?.detail ||
          corpo?.non_field_errors?.[0] ||
          Object.values(corpo || {})
            .flat()
            .join(' ') ||
          'Erro ao solicitar bolsa.'
        throw new Error(msg)
      }

      setSucesso(true)
      setTimeout(() => navigate('/coordenador-projeto'), 2000)
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const handleNav = (id) => {
    if (id === 'dashboard') navigate('/coordenador-projeto')
    else setActive(id)
  }

  return (
    <Layout
      role="Coordenador de Projeto"
      menuItems={menuItems}
      active={active}
      onNav={handleNav}
      onLogout={onVoltarHub}
      campus="Campus Restinga"
      userName={me.nome || '(sem nome)'}
      initials={initials}
    >
      <PageHeader
        title="Solicitar Bolsa"
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/coordenador-projeto')}>
            <IconArrowLeft /> Voltar
          </Button>
        }
      />

      {sucesso && <Alert tone="success">Bolsa solicitada com sucesso! Redirecionando...</Alert>}
      {erro && <Alert tone="error">{erro}</Alert>}

      <div className="solicitar-bolsa__form-card">
        <form onSubmit={handleSubmit}>
          <FormField label="Edital">
            <Select value={editalId} onChange={(e) => setEditalId(e.target.value)} required>
              <option value="">Selecione um edital</option>
              {editais.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.nome} ({ed.ano_codigo})
                </option>
              ))}
            </Select>
          </FormField>

          <div className="solicitar-bolsa__row">
            <FormField label="Modalidade">
              <Select
                value={modalidade}
                onChange={(e) => setModalidade(e.target.value)}
                required
              >
                <option value="">Selecione a modalidade</option>
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Carga Horária Semanal">
              <Select
                value={cargaHoraria}
                onChange={(e) => setCargaHoraria(e.target.value)}
                required
              >
                <option value="">Selecione a CH</option>
                {CARGAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Pré-requisitos">
            <TextArea
              rows={3}
              placeholder="Descreva os pré-requisitos para o candidato..."
              value={prerequisitos}
              onChange={(e) => setPrerequisitos(e.target.value)}
            />
          </FormField>

          <div className="solicitar-bolsa__row">
            <FormField label="Nota mínima (opcional)">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                max="10"
                placeholder="Ex: 7.00"
                value={notaMinima}
                onChange={(e) => setNotaMinima(e.target.value)}
              />
            </FormField>
          </div>

          <div className="solicitar-bolsa__row">
            <FormField label="Início da vigência (opcional)">
              <TextInput
                type="date"
                value={dataInicioVigencia}
                onChange={(e) => setDataInicioVigencia(e.target.value)}
              />
            </FormField>
            <FormField label="Fim da vigência (opcional)">
              <TextInput
                type="date"
                value={dataFimVigencia}
                onChange={(e) => setDataFimVigencia(e.target.value)}
              />
            </FormField>
          </div>

          <FormActions>
            <Button variant="outline" onClick={() => navigate('/coordenador-projeto')} disabled={enviando}>
              Cancelar
            </Button>
            <Button variant="accent" type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Solicitar Bolsa'}
            </Button>
          </FormActions>
        </form>
      </div>
    </Layout>
  )
}
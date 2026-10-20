import { useState } from 'react'
import {
  Layout,
  Button,
  StatCard,
  DataTable,
  Badge,
  Banner,
  PageHeader,
  Alert,
  FormField,
  FormActions,
  TextInput,
  TextArea,
  Select,
  FileField,
  Modal,
  ConfirmProvider,
  useConfirm,
  AcoesCell,
  Carregando,
  Spinner,
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconPlus,
  IconSearch,
} from '../components'
import './Showcase.css'

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const LINHAS_PAGINADAS = Array.from({ length: 47 }, (_, i) => [
  `Edital ${String(i + 1).padStart(2, '0')}/2026`,
  `2026-${String(i + 1).padStart(3, '0')}`,
  <Badge key="status" status={i % 3 === 0 ? 'RASCUNHO' : 'EM_VIGOR'} />,
])

/* ── Conteúdo interno do showcase ──────────────────────────── */
function ShowcaseContent() {
  const [modalOpen, setModalOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [botaoCarregando, setBotaoCarregando] = useState(null)
  const [tabelaCarregando, setTabelaCarregando] = useState(false)
  const [linhaOcupada, setLinhaOcupada] = useState(false)
  const [mostrarCarregando, setMostrarCarregando] = useState(false)
  const confirm = useConfirm()

  async function simularBotao(nome, ms) {
    setBotaoCarregando(nome)
    await esperar(ms)
    setBotaoCarregando(null)
  }

  async function simularTabela() {
    setTabelaCarregando(true)
    await esperar(1500)
    setTabelaCarregando(false)
  }

  async function simularLinha() {
    setLinhaOcupada(true)
    await esperar(1500)
    setLinhaOcupada(false)
  }

  async function simularCarregando() {
    setMostrarCarregando(true)
    await esperar(1500)
    setMostrarCarregando(false)
  }

  return (
    <div className="showcase">
      <h1 className="showcase__title">Componentes Sistema de Bolsistas</h1>
      <p className="showcase__subtitle">
        Biblioteca de componentes React reutilizáveis com CSS puro
      </p>

      {/* ── BOTÕES (#178) ──────────────────────────────────── */}
      <section className="showcase__section">
        <h2 className="showcase__section-title">Botões</h2>
        <span className="showcase__task">#178</span>

        <p className="showcase__label">Variantes (md)</p>
        <div className="showcase__row">
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
        </div>

        <p className="showcase__label">Variantes (sm)</p>
        <div className="showcase__row">
          <Button variant="primary" size="sm">
            Primary
          </Button>
          <Button variant="accent" size="sm">
            Accent
          </Button>
          <Button variant="outline" size="sm">
            Outline
          </Button>
          <Button variant="danger" size="sm">
            Danger
          </Button>
          <Button variant="ghost" size="sm">
            Ghost
          </Button>
        </div>

        <p className="showcase__label">Desabilitado</p>
        <div className="showcase__row">
          <Button variant="primary" disabled>
            Primary
          </Button>
          <Button variant="accent" disabled>
            Accent
          </Button>
          <Button variant="danger" disabled>
            Danger
          </Button>
        </div>

        <p className="showcase__label">Com ícone</p>
        <div className="showcase__row">
          <Button variant="accent">
            <IconPlus /> Novo Edital
          </Button>
          <Button variant="outline">
            <IconSearch /> Buscar
          </Button>
        </div>
      </section>

      {/* ── CARDS & TABELA (#180) ──────────────────────────── */}
      <section className="showcase__section">
        <h2 className="showcase__section-title">Cards e Tabela</h2>
        <span className="showcase__task">#180</span>

        <p className="showcase__label">Stat Cards</p>
        <div className="showcase__grid-4">
          <StatCard label="Editais Ativos" value={1} icon={<IconCalendar />} color="green" />
          <StatCard label="Projetos Cadastrados" value={2} icon={<IconBriefcase />} color="blue" />
          <StatCard label="Usuários Ativos" value={9} icon={<IconCheck />} color="green" />
          <StatCard label="Usuários Inativos" value={1} icon={<IconUsers />} color="red" />
        </div>

        <p className="showcase__label">Badges de Status</p>
        <div className="showcase__row">
          <Badge status="ATIVO" />
          <Badge status="DESLIGADO" />
          <Badge status="PENDENTE" />
          <Badge status="EM_SELECAO" />
          <Badge status="RASCUNHO" />
          <Badge status="PUBLICADO" />
          <Badge status="REJEITADA" />
          <Badge status="HOMOLOGADA" />
        </div>

        <p className="showcase__label">Banner</p>
        <Banner
          title="Bem-vindo ao Sistema de Bolsistas"
          description="Gerencie editais, projetos e bolsistas do IFRS Campus Restinga."
          action={
            <Button variant="outline" className="showcase__banner-btn">
              Ver Editais
            </Button>
          }
        />

        <p className="showcase__label">Page Header</p>
        <PageHeader
          title="Usuários do Sistema"
          action={
            <Button variant="accent">
              <IconPlus /> Novo Usuário
            </Button>
          }
        />

        <p className="showcase__label">Data Table</p>
        <DataTable
          columns={['Nome', 'E-mail', 'Grupo/Perfil', 'Status', '']}
          rows={[
            [
              'Ana Souza',
              'admin@if.edu.br',
              'Administrador',
              <Badge status="ATIVO" />,
              <div className="showcase__row-actions">
                <Button variant="outline" size="sm">
                  Editar
                </Button>
                <Button variant="danger" size="sm">
                  Desativar
                </Button>
              </div>,
            ],
            [
              'Carlos Lima',
              'pesquisa@if.edu.br',
              'Coordenador de Área',
              <Badge status="ATIVO" />,
              <div className="showcase__row-actions">
                <Button variant="outline" size="sm">
                  Editar
                </Button>
                <Button variant="danger" size="sm">
                  Desativar
                </Button>
              </div>,
            ],
            [
              'Beatriz Nunes',
              'aluno2@estudante.if.edu.br',
              'Aluno',
              <Badge status="ATIVO" />,
              <div className="showcase__row-actions">
                <Button variant="outline" size="sm">
                  Editar
                </Button>
                <Button variant="danger" size="sm">
                  Desativar
                </Button>
              </div>,
            ],
            [
              'Gustavo Pires',
              'aluno5@estudante.if.edu.br',
              'Aluno',
              <Badge status="DESLIGADO" />,
              <div className="showcase__row-actions">
                <Button variant="outline" size="sm">
                  Editar
                </Button>
                <Button variant="accent" size="sm">
                  Ativar
                </Button>
              </div>,
            ],
          ]}
        />

        <p className="showcase__label">Data Table com paginação (10 por página)</p>
        <DataTable columns={['Edital', 'Ano-Código', 'Status']} rows={LINHAS_PAGINADAS} />
      </section>

      {/* ── FORMULÁRIOS (#179) ─────────────────────────────── */}
      <section className="showcase__section">
        <h2 className="showcase__section-title">Formulários e Inputs</h2>
        <span className="showcase__task">#179</span>

        <p className="showcase__label">Alerts</p>
        <div style={{ maxWidth: 560 }}>
          <Alert tone="success">Usuário cadastrado com sucesso!</Alert>
          <Alert tone="error">Erro ao salvar. Verifique os campos obrigatórios.</Alert>
        </div>

        <p className="showcase__label">Campos de formulário</p>
        <div className="showcase__grid-2">
          <div>
            <FormField label="Nome">
              <TextInput type="text" defaultValue="Ana Souza" />
            </FormField>
            <FormField label="E-mail">
              <TextInput type="email" defaultValue="admin@if.edu.br" />
            </FormField>
            <FormField label="Perfil">
              <Select>
                <option>Administrador</option>
                <option>Coordenador de Área</option>
                <option>Coordenador de Projeto</option>
                <option>Aluno</option>
              </Select>
            </FormField>
          </div>
          <div>
            <FormField label="Observações">
              <TextArea rows={4} placeholder="Observações gerais..." />
            </FormField>
            <FormField label="Documento">
              <FileField
                value={fileName}
                onChange={(file) => setFileName(file?.name ?? '')}
                accept=".pdf,.doc,.docx"
              />
            </FormField>
            <FormField label="Campo desabilitado">
              <TextInput type="text" defaultValue="Somente leitura" disabled />
            </FormField>
          </div>
        </div>

        <FormActions>
          <Button variant="danger">Cancelar</Button>
          <Button variant="accent">Salvar</Button>
        </FormActions>

        <div className="showcase__spacer" />

        <p className="showcase__label">Modal</p>
        <div className="showcase__row">
          <Button variant="accent" onClick={() => setModalOpen(true)}>
            Abrir Modal
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              confirm({
                title: 'Desativar usuário?',
                message: 'O acesso de Gustavo Pires será revogado imediatamente.',
                confirmLabel: 'Desativar',
                tone: 'danger',
                onConfirm: () => alert('Usuário desativado!'),
              })
            }
          >
            Testar Confirm
          </Button>
        </div>

        {modalOpen && (
          <Modal title="Editar Usuário: Ana Souza" onClose={() => setModalOpen(false)}>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Perfil: Administrador (não editável nesta tela)
            </p>
            <FormField label="Nome">
              <TextInput type="text" defaultValue="Ana Souza" />
            </FormField>
            <FormField label="E-mail">
              <TextInput type="email" defaultValue="admin@if.edu.br" />
            </FormField>
            <FormActions>
              <Button variant="danger" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="accent" onClick={() => setModalOpen(false)}>
                Salvar
              </Button>
            </FormActions>
          </Modal>
        )}
      </section>

      {/* ── CARREGAMENTO ──────────────────────────────────── */}
      <section className="showcase__section">
        <h2 className="showcase__section-title">Carregamento</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Indicadores só aparecem se a ação passar de 300ms e, uma vez exibidos, ficam no mínimo
          400ms. O botão fica desabilitado na hora do clique, evitando envio duplicado.
        </p>

        <p className="showcase__label">Spinner</p>
        <div className="showcase__row">
          <Spinner size={12} />
          <Spinner size={16} />
          <Spinner size={24} />
          <span style={{ color: 'var(--if-green)' }}>
            <Spinner size={24} />
          </span>
        </div>

        <p className="showcase__label">Botão com loading</p>
        <div className="showcase__row">
          <Button
            variant="accent"
            loading={botaoCarregando === 'lento'}
            onClick={() => simularBotao('lento', 1500)}
          >
            Salvar (1,5s)
          </Button>
          <Button
            variant="outline"
            loading={botaoCarregando === 'rapido'}
            onClick={() => simularBotao('rapido', 200)}
          >
            Ação rápida (200ms, sem spinner)
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={botaoCarregando === 'pequeno'}
            onClick={() => simularBotao('pequeno', 1500)}
          >
            Tamanho sm
          </Button>
        </div>

        <p className="showcase__label">Confirmação assíncrona</p>
        <div className="showcase__row">
          <Button
            variant="accent"
            onClick={() =>
              confirm({
                title: 'Aprovar bolsa?',
                message: 'O diálogo fica aberto com spinner até a ação terminar.',
                confirmLabel: 'Aprovar',
                tone: 'accent',
                onConfirm: () => esperar(1500),
              })
            }
          >
            Confirmação com sucesso
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              confirm({
                title: 'Publicar edital?',
                message: 'Se a ação falhar, o erro aparece dentro do diálogo.',
                confirmLabel: 'Publicar',
                tone: 'primary',
                onConfirm: async () => {
                  await esperar(1000)
                  throw new Error('Preencha o cronograma antes de publicar.')
                },
              })
            }
          >
            Confirmação com erro
          </Button>
        </div>

        <p className="showcase__label">Tabela carregando (linhas-esqueleto)</p>
        <div className="showcase__row">
          <Button variant="outline" size="sm" onClick={simularTabela} disabled={tabelaCarregando}>
            Recarregar tabela
          </Button>
        </div>
        <DataTable
          columns={['Projeto', 'Edital', 'Status', 'Ações']}
          loading={tabelaCarregando}
          rows={[
            [
              'Projeto de Extensão',
              'Edital 2026-1',
              <Badge key="status" status="ABERTA" />,
              <AcoesCell
                key="acoes"
                ocupado={linhaOcupada}
                acoes={[
                  { label: 'Editar', onClick: simularLinha },
                  { label: 'Cancelar', variant: 'danger', onClick: () => {} },
                ]}
              />,
            ],
          ]}
        />
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          No menu "..." da linha, "Editar" simula uma ação de linha (spinner só naquela linha).
        </p>

        <p className="showcase__label">Seção / página carregando</p>
        <div className="showcase__row">
          <Button
            variant="outline"
            size="sm"
            onClick={simularCarregando}
            disabled={mostrarCarregando}
          >
            Simular carregamento
          </Button>
        </div>
        {mostrarCarregando && <Carregando texto="Carregando projeto..." />}

        <p className="showcase__label">Barra de progresso global</p>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Barra fina no topo da tela, ligada automaticamente a toda chamada à API que passe de
          300ms. Não precisa de código nas páginas.
        </p>
      </section>
    </div>
  )
}

/* ── Layout wrapper do showcase (usa o Layout real) ────────── */
const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconHome /> },
  { id: 'editais', label: 'Editais', icon: <IconCalendar /> },
  { id: 'projetos', label: 'Projetos', icon: <IconBriefcase /> },
  { id: 'usuarios', label: 'Usuários', icon: <IconUsers /> },
]

export default function Showcase() {
  const [active, setActive] = useState('dashboard')

  return (
    <ConfirmProvider>
      <Layout
        role="Administrador"
        menuItems={menuItems}
        active={active}
        onNav={setActive}
        onLogout={() => alert('Logout!')}
        campus="Campus Restinga"
        userName="Ana Souza"
        initials="AS"
      >
        <ShowcaseContent />
      </Layout>
    </ConfirmProvider>
  )
}

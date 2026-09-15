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
  IconHome,
  IconCalendar,
  IconBriefcase,
  IconUsers,
  IconCheck,
  IconPlus,
  IconSearch,
} from '../components'
import './Showcase.css'

/* ── Conteúdo interno do showcase ──────────────────────────── */
function ShowcaseContent() {
  const [modalOpen, setModalOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const confirm = useConfirm()

  return (
    <div className="showcase">
      <h1 className="showcase__title">Componentes — Sistema de Bolsistas</h1>
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
              <FileField value={fileName} onChange={setFileName} accept=".pdf,.doc,.docx" />
            </FormField>
            <FormField label="Campo desabilitado">
              <TextInput type="text" defaultValue="Somente leitura" disabled />
            </FormField>
          </div>
        </div>

        <FormActions>
          <Button variant="outline">Cancelar</Button>
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
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="accent" onClick={() => setModalOpen(false)}>
                Salvar
              </Button>
            </FormActions>
          </Modal>
        )}
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

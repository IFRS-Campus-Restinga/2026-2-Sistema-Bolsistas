/**
 * Ícones SVG reutilizáveis do Sistema de Bolsistas, os mesmos do protótipo.
 *
 * Uso: <IconHome size={20} className="minha-classe" />
 *
 * Cada ícone herda a cor do texto via `currentColor`.
 */

// Traço no estilo lucide (stroke 1.75) para combinar com a direção visual mais leve.
function base(paths, defaultSize = 18) {
  return function Icon({ size = defaultSize, className } = {}) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        {paths}
      </svg>
    )
  }
}

// ── Navegação: um ícone exclusivo por tab ────────────────────────
export const IconHome = base(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>
)
/** Edital: documento com selo/assinatura. */
export const IconEdital = base(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" />
    <path d="M14 2v6h6" />
    <path d="M20 8v3" />
    <path d="M8 13h5M8 17h3" />
    <circle cx="18" cy="17" r="3" />
    <path d="m16.5 19.5-.5 2.5 2-1 2 1-.5-2.5" />
  </>
)
/** Projeto: pasta. */
export const IconFolder = base(
  <>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    <path d="M8 13h8M8 16h5" />
  </>
)
/** Bolsa: carteira/valor. */
export const IconBolsa = base(
  <>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </>
)
/** Inscrição: prancheta com check. */
export const IconClipboardCheck = base(
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </>
)
/** Usuários (admin): usuário com engrenagem. */
export const IconUserCog = base(
  <>
    <circle cx="9" cy="7" r="4" />
    <path d="M2 21v-2a4 4 0 0 1 4-4h6" />
    <circle cx="18" cy="17" r="2.5" />
    <path d="M18 13v1.5M18 19.5V21M21.5 17H20M16 17h-1.5M20.5 14.5l-1 1M16.5 18.5l-1 1M20.5 19.5l-1-1M16.5 15.5l-1-1" />
  </>
)
/** Auditoria: histórico (relógio com seta). */
export const IconHistory = base(
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </>
)
/** Solicitações de bolsa: caixa de entrada. */
export const IconInbox = base(
  <>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>
)
/** Finalização: bandeira de chegada. */
export const IconFlag = base(
  <>
    <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.33 2q2 0 3.67-.8a1 1 0 0 1 1.4.9v10.8a1 1 0 0 1-.5.86A7 7 0 0 1 15.33 17c-2.33 0-4.33-2-7.33-2a6 6 0 0 0-4 1.5" />
  </>
)
/** Movimentações (desligamentos/cancelamentos): setas trocando. */
export const IconArrowLeftRight = base(
  <>
    <path d="M8 3 4 7l4 4" />
    <path d="M4 7h16" />
    <path d="m16 21 4-4-4-4" />
    <path d="M20 17H4" />
  </>
)
/** Frequência: calendário com check. */
export const IconCalendarCheck = base(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="m9 16 2 2 4-4" />
  </>
)
/** Pendências: triângulo de alerta. */
export const IconAlertTriangle = base(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4M12 17h.01" />
  </>
)
/** Seleção: funil. */
export const IconFunnel = base(
  <path d="M10 20a1 1 0 0 0 .55.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .52-1.34L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.74 1.67l7.22 7.99A2 2 0 0 1 10 14z" />
)
/** Convites: envelope com seta. */
export const IconSend = base(
  <>
    <path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z" />
    <path d="m21.85 2.15-10.94 10.94" />
  </>
)
export const IconMail = base(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>
)
/** Bolsistas: grupo de pessoas. */
export const IconUsers = base(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>
)
/** Recursos: martelo de juiz. */
export const IconGavel = base(
  <>
    <path d="m14.5 12.5-8 8a2.12 2.12 0 1 1-3-3l8-8" />
    <path d="m16 16 6-6" />
    <path d="m8 8 6-6" />
    <path d="m9 7 8 8" />
    <path d="m21 11-8-8" />
  </>
)
/** Oportunidades / descobrir: bússola. */
export const IconCompass = base(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
  </>
)
/** Minha bolsa: medalha. */
export const IconAward = base(
  <>
    <circle cx="12" cy="8" r="6" />
    <path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11" />
  </>
)
export const IconBank = base(
  <>
    <path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10" />
    <path d="M12 2 21 8H3z" />
  </>
)

// ── Interface ───────────────────────────────────────────────────
export const IconBell = base(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
)
export const IconChevronDown = base(<path d="m6 9 6 6 6-6" />, 16)
export const IconChevronRight = base(<path d="m9 18 6-6-6-6" />, 16)
export const IconChevronLeft = base(<path d="m15 18-6-6 6-6" />, 16)
export const IconMore = base(
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>,
  16
)
export const IconEye = base(
  <>
    <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
    <circle cx="12" cy="12" r="3" />
  </>,
  16
)
export const IconDownload = base(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </>,
  16
)
export const IconZoomIn = base(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
  </>,
  16
)
export const IconZoomOut = base(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3M8 11h6" />
  </>,
  16
)
export const IconCheckCircle = base(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>
)
export const IconXCircle = base(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </>
)
export const IconClock = base(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>
)
export const IconInfo = base(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
  16
)
export const IconFilter = base(<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />, 16)
export const IconExternal = base(
  <>
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
  14
)
export const IconSparkles = base(
  <>
    <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z" />
  </>,
  16
)
export const IconUser = base(
  <>
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </>,
  16
)
export const IconHub = base(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </>,
  16
)
export const IconPanelLeft = base(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </>,
  16
)

// ── Editor de texto rico ─────────────────────────────────────────
export const IconBold = base(
  <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />,
  15
)
export const IconItalic = base(<path d="M19 4h-9M14 20H5M15 4 9 20" />, 15)
export const IconH1 = base(<path d="M4 12h8M4 18V6M12 18V6M17 12l3-2v8" />, 15)
export const IconH2 = base(
  <path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />,
  15
)
export const IconList = base(<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13" />, 15)
export const IconListOrdered = base(
  <path d="M10 12h11M10 18h11M10 6h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />,
  15
)
export const IconQuote = base(
  <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />,
  15
)

// ── Legado (ainda usados pelas páginas) ──────────────────────────
export const IconCalendar = base(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>
)
export const IconBriefcase = base(
  <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>
)
export const IconCheck = base(<path d="M20 6 9 17l-5-5" />)
export const IconFileText = base(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8" />
  </>
)
export const IconBarChart = base(<path d="M18 20V10M12 20V4M6 20v-6M2 20h20" />)
export const IconLogOut = base(
  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  16
)
export const IconSearch = base(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
)
export const IconScale = base(
  <path d="M12 3v18M6 8l-3 7a3 3 0 0 0 6 0zM18 8l-3 7a3 3 0 0 0 6 0zM6 8h12M9 3h6" />
)
export const IconTrendingUp = base(<path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" />)
export const IconClipboardList = base(
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 12h6M9 16h6" />
  </>
)
export const IconGear = base(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>,
  36
)
// 18 (e não 36 como no protótipo): no menu o ícone maior estourava o item.
export const IconGradCap = base(<path d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />)
export const IconPlus = base(<path d="M12 5v14M5 12h14" />, 16)
export const IconX = base(<path d="M18 6 6 18M6 6l12 12" />, 18)
export const IconUpload = base(
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
)
export const IconPaperclip = base(
  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
)
export const IconArrowLeft = base(<path d="M19 12H5M12 19l-7-7 7-7" />, 16)

// ── Usados só no sistema (não existem no protótipo) ─────────────
export const IconDotsVertical = base(
  <>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
  </>,
  18
)

export const IconDotsHorizontal = base(
  <>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </>,
  18
)

export const IconMessageCircle = base(
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
)

export const IconInfoCircle = base(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </>
)

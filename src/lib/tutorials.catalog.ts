import { type UserRole } from "@/hooks/use-auth";
import { type PermissionKey } from "@/hooks/use-permissions";

export interface TutorialItem {
  id: string;
  title: string;
  description: string;
  targetRoles: UserRole[];
  requiredPermission?: PermissionKey;
  moduleKey?: string;
  route: string;
  steps: string[];
  status: "available" | "requires_configuration" | "plan_dependent";
  badge?: string;
  notes?: string;
}

export interface QuickActionItem {
  label: string;
  route: string;
  iconName: string;
  requiredPermission?: PermissionKey;
  moduleKey?: string;
  description: string;
}

export interface RoleWelcomeConfig {
  role: UserRole;
  title: string;
  badge: string;
  iconName: string;
  summary: string;
  quickActions: QuickActionItem[];
  recommendedTutorialIds: string[];
  operationalTip: string;
}

/**
 * Catálogo Canônico de Orientações e Tutoriais do Barbex
 * Estritamente alinhado a funcionalidades reais, homologadas e ativas no código.
 */
export const TUTORIALS_CATALOG: TutorialItem[] = [
  // ---------------------------------------------------------------------------
  // PROPRIETÁRIO / ADMINISTRADOR
  // ---------------------------------------------------------------------------
  {
    id: "owner-config-barbershop",
    title: "Configurações da Barbearia e Chave PIX",
    description: "Defina dados do estabelecimento, horários de funcionamento, logotipo e a chave PIX para pagamentos diretos.",
    targetRoles: ["tenant_admin", "admin"],
    requiredPermission: "settings:manage",
    moduleKey: "settings",
    route: "/settings",
    steps: [
      "Acesse o menu Configurações na barra lateral.",
      "Preencha o nome comercial, telefone de contato e horários de abertura e fechamento.",
      "Adicione sua Chave PIX oficial para agilizar o recebimento dos clientes.",
      "Envie a logo da barbearia para personalização da marca e clique em 'Salvar'."
    ],
    status: "available",
    badge: "Essencial",
  },
  {
    id: "owner-services-setup",
    title: "Cadastro de Serviços e Comissões Padrão",
    description: "Cadastre cortes, barbas e combos com preço, tempo de atendimento em minutos e comissão.",
    targetRoles: ["tenant_admin", "admin"],
    requiredPermission: "settings:manage",
    moduleKey: "services",
    route: "/services",
    steps: [
      "No menu lateral, clique em 'Serviços' e depois em 'Novo Serviço'.",
      "Informe o título (ex: Corte Degradê), categoria e valor em Reais.",
      "Defina o tempo estimado em minutos (ex: 30 min, 45 min).",
      "Configure a comissão percentual padrão para repasse aos profissionais e salve."
    ],
    status: "available",
    badge: "Essencial",
  },
  {
    id: "owner-team-management",
    title: "Gestão da Equipe e Barbeiros",
    description: "Cadastre profissionais da barbearia, configure escalas de trabalho, folgas e comissões individuais.",
    targetRoles: ["tenant_admin", "admin"],
    requiredPermission: "professionals:manage",
    moduleKey: "barbers",
    route: "/barbers",
    steps: [
      "Acesse a aba 'Barbeiros' (ou 'Equipe').",
      "Clique em 'Novo Barbeiro' e insira o nome, WhatsApp e e-mail do colaborador.",
      "Configure a escala semanal definindo dias e turnos de atendimento.",
      "Se necessário, atribua comissão diferenciada exclusiva para o profissional."
    ],
    status: "available",
    badge: "Operação",
  },
  {
    id: "owner-calendar-multiprofile",
    title: "Agenda Avançada Multiperfil",
    description: "Navegue nos 4 modos homologados: Dia, Semana, Mês e Período Personalizado de até 90 dias com filtros rápidos.",
    targetRoles: ["tenant_admin", "admin", "manager"],
    requiredPermission: "appointments:view",
    moduleKey: "calendar",
    route: "/calendar",
    steps: [
      "Abra a Agenda e alterne entre Dia, Semana, Mês ou Período Personalizado.",
      "Filtre por profissional específico, status do agendamento ou busque pelo nome do cliente.",
      "Clique em qualquer agendamento para abrir detalhes, iniciar comanda ou concluir atendimento.",
      "Use os botões de ação rápidos para 'Novo Agendamento' ou 'Fila de Espera (Walk-in)'."
    ],
    status: "available",
    badge: "Homologado",
  },
  {
    id: "owner-finances-reconciliation",
    title: "Fechamento Financeiro e Liquidação de Comissões",
    description: "Acompanhe faturamento em tempo real, fluxo de caixa e liquide comissões com a RPC segura.",
    targetRoles: ["tenant_admin", "admin", "financial", "finance"],
    requiredPermission: "finances:manage",
    moduleKey: "finances",
    route: "/finances",
    steps: [
      "Acesse o módulo Financeiro para visualizar faturamento bruto, custos e lucro.",
      "Navegue até a seção de 'Comissões de Barbeiros'.",
      "Confira a lista de atendimentos concluídos com comissões pendentes de pagamento.",
      "Selecione o profissional e execute a liquidação segura com registro contábil imediato."
    ],
    status: "available",
    badge: "Financeiro",
  },
  {
    id: "owner-whatsapp-automation",
    title: "Notificações e Mensagens via WhatsApp (Z-API)",
    description: "Configure confirmações e lembretes de agendamento automáticos disparados por WhatsApp.",
    targetRoles: ["tenant_admin", "admin"],
    requiredPermission: "integrations:manage",
    moduleKey: "whatsapp",
    route: "/settings",
    steps: [
      "Acesse a área de Integrações em Configurações.",
      "Insira sua Instance ID e Token de autenticação da Z-API.",
      "Ative as notificações automáticas de confirmação de agendamento e lembrete prévio.",
      "Realize um disparo de teste para validar a conexão da instância."
    ],
    status: "requires_configuration",
    badge: "Terceiro",
    notes: "Atenção: A plataforma Barbex não inclui WhatsApp nativo. O disparo de mensagens depende da contratação e configuração de serviço externo compatível (como Z-API), com assinatura e custos mantidos separadamente pelo proprietário.",
  },

  // ---------------------------------------------------------------------------
  // RECEPCIONISTA
  // ---------------------------------------------------------------------------
  {
    id: "reception-agenda-operation",
    title: "Operação da Agenda da Recepção",
    description: "Consulte agendamentos nos modos Dia, Semana, Mês e Personalizado, filtre por barbeiro e busque clientes.",
    targetRoles: ["reception", "receptionist", "manager"],
    requiredPermission: "appointments:view",
    moduleKey: "calendar",
    route: "/reception/agenda",
    steps: [
      "Acesse a Agenda da Recepção pelo menu lateral.",
      "Selecione o modo de visualização desejado (Dia para operação diária, Semana ou Mês para planejamento).",
      "Filtre pelo barbeiro desejado ou pesquise o cliente pelo campo de busca.",
      "Acompanhe as tags de status: Confirmado, Em Andamento, Concluído ou Cancelado."
    ],
    status: "available",
    badge: "Recepção",
  },
  {
    id: "reception-checkin-arrival",
    title: "Check-in e Confirmação de Chegada",
    description: "Registre a chegada física do cliente na barbearia para alertar a equipe e o profissional.",
    targetRoles: ["reception", "receptionist"],
    requiredPermission: "appointments:manage",
    moduleKey: "calendar",
    route: "/reception",
    steps: [
      "Na lista de agendamentos do dia, localize o cliente ao chegar ao estabelecimento.",
      "Clique no botão 'Check-in' para marcar sua presença física.",
      "O agendamento mudará para 'Confirmado/Aguardando', sinalizando ao barbeiro que o cliente está no local."
    ],
    status: "available",
    badge: "Operação",
  },
  {
    id: "reception-walkin-queue",
    title: "Adicionar Cliente na Fila de Espera (Walk-in)",
    description: "Encaixe clientes sem agendamento prévio rapidamente na fila operacional.",
    targetRoles: ["reception", "receptionist"],
    requiredPermission: "appointments:create",
    moduleKey: "calendar",
    route: "/reception/waiting-list",
    steps: [
      "Clique no botão 'Walk-in' no topo da recepção ou acesse 'Lista de espera'.",
      "Informe o nome do cliente, telefone e selecione os serviços desejados.",
      "Atribua a um profissional livre ou selecione 'Qualquer Barbeiro Disponível'.",
      "O cliente entrará na fila operacional em tempo real."
    ],
    status: "available",
    badge: "Recepção",
  },
  {
    id: "reception-comanda-digital",
    title: "Uso da Comanda Digital e Lançamento de Produtos",
    description: "Adicione pomadas, bebidas e itens consumidos à comanda antes do fechamento da conta.",
    targetRoles: ["reception", "receptionist", "manager"],
    requiredPermission: "appointments:manage",
    moduleKey: "products",
    route: "/reception/agenda",
    steps: [
      "Clique no agendamento do cliente e abra o botão 'Comanda Digital'.",
      "Selecione os produtos consumidos (pomadas, tônicos, bebidas) no catálogo.",
      "Confira os totais consolidados de serviços e produtos.",
      "Escolha a forma de pagamento (PIX, Cartão, Dinheiro) e confirme o fechamento."
    ],
    status: "available",
    badge: "Comanda",
  },

  // ---------------------------------------------------------------------------
  // BARBEIRO / PROFISSIONAL
  // ---------------------------------------------------------------------------
  {
    id: "barber-daily-agenda",
    title: "Visualizar Sua Agenda Individual",
    description: "Acompanhe seus horários de atendimento do dia em uma linha do tempo clara e exclusiva.",
    targetRoles: ["barber", "professional"],
    requiredPermission: "appointments:view",
    moduleKey: "calendar",
    route: "/profissional",
    steps: [
      "Acesse sua Área do Profissional no Barbex.",
      "Veja a lista cronológica dos clientes agendados para você no dia.",
      "Verifique os serviços solicitados, horários de início e observações deixadas pelo cliente."
    ],
    status: "available",
    badge: "Profissional",
  },
  {
    id: "barber-complete-appointment",
    title: "Concluir Atendimento com Segurança",
    description: "Finalize o atendimento ao término do corte para registrar a produção e gerar sua comissão.",
    targetRoles: ["barber", "professional"],
    requiredPermission: "appointments:manage",
    moduleKey: "calendar",
    route: "/profissional",
    steps: [
      "Ao concluir o serviço na cadeira, localize o agendamento correspondente.",
      "Clique em 'Concluir Atendimento'.",
      "A RPC segura do Barbex atualizará o status para 'Concluído' e registrará sua comissão imediatamente."
    ],
    status: "available",
    badge: "Comissão",
  },
  {
    id: "barber-commissions-statement",
    title: "Consultar Extrato de Comissões Pessoais",
    description: "Veja quanto você já produziu no mês, valores a receber e repasses já liquidados pela gerência.",
    targetRoles: ["barber", "professional"],
    requiredPermission: "appointments:view",
    moduleKey: "finances",
    route: "/profissional",
    steps: [
      "Na sua área profissional, acesse a aba 'Comissões' ou 'Métricas'.",
      "Consulte os cards de faturamento bruto gerado, taxa de comissão e total líquido.",
      "Acompanhe a relação de atendimentos que já foram pagos pela administração."
    ],
    status: "available",
    badge: "Extrato",
  },

  // ---------------------------------------------------------------------------
  // OPERADOR FINANCEIRO
  // ---------------------------------------------------------------------------
  {
    id: "finance-cash-flow",
    title: "Fluxo de Caixa e Lançamentos Diários",
    description: "Controle as entradas de pagamentos por modalidade (PIX, Débito, Crédito, Dinheiro) e despesas.",
    targetRoles: ["financial", "finance", "cashier", "tenant_admin"],
    requiredPermission: "finances:view",
    moduleKey: "finances",
    route: "/finances",
    steps: [
      "Acesse o painel Financeiro para checar o resumo diário e mensal.",
      "Filtre por período e analise a distribuição por método de pagamento.",
      "Registre sangrias de caixa ou despesas operacionais avulsas quando necessário."
    ],
    status: "available",
    badge: "Caixa",
  },
  {
    id: "finance-commission-payout",
    title: "Auditoria e Liquidação de Comissões",
    description: "Realize a conferência e pagamento de comissões devidas aos profissionais de forma auditada.",
    targetRoles: ["financial", "finance", "tenant_admin"],
    requiredPermission: "finances:manage",
    moduleKey: "finances",
    route: "/finances",
    steps: [
      "No módulo Financeiro, selecione a aba 'Comissões'.",
      "Filtre pelo profissional desejado e confira o relatório de atendimentos executados.",
      "Clique em 'Pagar Comissões' para registrar a quitação definitiva com respaldo contábil."
    ],
    status: "available",
    badge: "Comissões",
  },

  // ---------------------------------------------------------------------------
  // CLIENTE FINAL (PORTAL E AGENDAMENTO PÚBLICO)
  // ---------------------------------------------------------------------------
  {
    id: "client-online-booking",
    title: "Como Agendar Seu Horário Online",
    description: "Escolha serviços, profissional de sua preferência e marque seu atendimento em segundos.",
    targetRoles: ["client", "customer"],
    moduleKey: "calendar",
    route: "/portal",
    steps: [
      "Acesse a página pública da barbearia.",
      "Selecione o serviço desejado (ex: Corte, Barba ou Combo).",
      "Escolha o profissional de sua preferência ou opte por 'Primeiro Disponível'.",
      "Escolha o dia e horário e confirme seu agendamento informando seu telefone."
    ],
    status: "available",
    badge: "Agendamento",
  },
  {
    id: "client-portal-management",
    title: "Gerenciar Seus Agendamentos no Portal",
    description: "Consulte agendamentos futuros, histórico de visitas anteriores e solicite remarcações.",
    targetRoles: ["client", "customer"],
    moduleKey: "calendar",
    route: "/portal",
    steps: [
      "Acesse o Portal do Cliente informando seu telefone.",
      "Na aba 'Agendamentos', veja todos os seus horários marcados.",
      "Clique em 'Remarcar' ou 'Cancelar' caso precise alterar a data com antecedência permitida."
    ],
    status: "available",
    badge: "Portal",
  },
  {
    id: "client-loyalty-cashback",
    title: "Consultar Pontos de Fidelidade e Benefícios",
    description: "Acompanhe seus créditos acumulados e resgate benefícios em seus próximos atendimentos.",
    targetRoles: ["client", "customer"],
    moduleKey: "loyalty",
    route: "/portal",
    steps: [
      "No Portal do Cliente, acesse a aba 'Fidelidade'.",
      "Confira seu saldo de pontos ou cashback disponível na barbearia.",
      "Utilize os créditos acumulados no momento de pagar sua comanda na recepção."
    ],
    status: "available",
    badge: "Fidelidade",
  },

  // ---------------------------------------------------------------------------
  // SUPER ADMINISTRADOR (GOVERNANÇA GLOBAL)
  // ---------------------------------------------------------------------------
  {
    id: "superadmin-tenants-governance",
    title: "Governança Global de Barbearias",
    description: "Monitore estabelecimentos cadastrados, status de assinatura, ativação e bloqueios preventivos.",
    targetRoles: ["super_admin"],
    requiredPermission: "*",
    moduleKey: "admin",
    route: "/admin/tenants",
    steps: [
      "Acesse o painel Super Admin em /admin/tenants.",
      "Consulte a listagem de tenants com filtros por plano, status de trial e adimplência.",
      "Acesse ações operacionais de auditoria e impersonação quando formalmente autorizado."
    ],
    status: "available",
    badge: "Plataforma",
  },
  {
    id: "superadmin-knowledge-base",
    title: "Central de Aprendizado e Knowledge Base",
    description: "Publique novos tutoriais, edite categorias e gerencie notas de versão para toda a base.",
    targetRoles: ["super_admin"],
    requiredPermission: "*",
    moduleKey: "admin",
    route: "/admin/knowledge-base",
    steps: [
      "Acesse /admin/knowledge-base.",
      "Crie novos artigos categorizados com versionamento e histórico de alterações.",
      "Publique notas de changelog para perfis específicos da plataforma."
    ],
    status: "available",
    badge: "Conteúdo",
  },
];

/**
 * Configuração de Boas-vindas e Ações Rápidas por Perfil Canônico
 */
export const ROLE_WELCOME_CONFIGS: Record<string, RoleWelcomeConfig> = {
  tenant_admin: {
    role: "tenant_admin",
    title: "Painel do Proprietário",
    badge: "👑 PROPRIETÁRIO",
    iconName: "Crown",
    summary: "Gerencie sua barbearia, equipe, agendamentos, serviços e finanças em uma visão completa.",
    quickActions: [
      {
        label: "Ver Agenda Completa",
        route: "/calendar",
        iconName: "Calendar",
        requiredPermission: "appointments:view",
        description: "Dia, semana, mês e 90 dias com filtros rápidos",
      },
      {
        label: "Cadastrar Serviços",
        route: "/services",
        iconName: "Scissors",
        requiredPermission: "settings:manage",
        description: "Defina preços, tempos e comissões da equipe",
      },
      {
        label: "Gerenciar Barbeiros",
        route: "/barbers",
        iconName: "Users",
        requiredPermission: "professionals:manage",
        description: "Horários, folgas e comissões personalizadas",
      },
      {
        label: "Fluxo Financeiro",
        route: "/finances",
        iconName: "DollarSign",
        requiredPermission: "finances:view",
        description: "Entradas, despesas e liquidação de comissões",
      },
    ],
    recommendedTutorialIds: [
      "owner-config-barbershop",
      "owner-services-setup",
      "owner-team-management",
      "owner-calendar-multiprofile",
      "owner-finances-reconciliation",
      "owner-whatsapp-automation",
    ],
    operationalTip: "Dica de Sucesso: Defina horários e serviços antes de compartilhar o link da sua barbearia nas redes sociais.",
  },

  admin: {
    role: "admin",
    title: "Painel do Administrador",
    badge: "👑 ADMINISTRADOR",
    iconName: "Crown",
    summary: "Controle total sobre a operação da barbearia, equipe e faturamento diário.",
    quickActions: [
      {
        label: "Ver Agenda Completa",
        route: "/calendar",
        iconName: "Calendar",
        requiredPermission: "appointments:view",
        description: "Gestão completa de atendimentos e comandas",
      },
      {
        label: "Serviços e Preços",
        route: "/services",
        iconName: "Scissors",
        requiredPermission: "settings:manage",
        description: "Catálogo de serviços e regras de comissão",
      },
      {
        label: "Profissionais",
        route: "/barbers",
        iconName: "Users",
        requiredPermission: "professionals:manage",
        description: "Escalas de trabalho e cadastro da equipe",
      },
      {
        label: "Financeiro & Comissões",
        route: "/finances",
        iconName: "DollarSign",
        requiredPermission: "finances:view",
        description: "Acompanhamento de caixa e repasses",
      },
    ],
    recommendedTutorialIds: [
      "owner-config-barbershop",
      "owner-services-setup",
      "owner-team-management",
      "owner-calendar-multiprofile",
      "owner-finances-reconciliation",
    ],
    operationalTip: "Mantenha as escalas da equipe atualizadas para evitar horários indisponíveis na agenda online.",
  },

  manager: {
    role: "manager",
    title: "Central de Gestão",
    badge: "💼 GERENTE",
    iconName: "Briefcase",
    summary: "Supervisione a agenda, equipe e o fluxo operacional diário do estabelecimento.",
    quickActions: [
      {
        label: "Agenda Operacional",
        route: "/calendar",
        iconName: "Calendar",
        requiredPermission: "appointments:view",
        description: "Navegação por profissional e status",
      },
      {
        label: "Lista de Espera",
        route: "/reception/waiting-list",
        iconName: "ListChecks",
        requiredPermission: "appointments:create",
        description: "Gerencie a fila de clientes Walk-in",
      },
      {
        label: "Clientes Cadastrados",
        route: "/customers",
        iconName: "Users",
        requiredPermission: "clients:view",
        description: "Histórico e contatos de clientes",
      },
    ],
    recommendedTutorialIds: [
      "owner-calendar-multiprofile",
      "reception-agenda-operation",
      "reception-walkin-queue",
      "reception-comanda-digital",
    ],
    operationalTip: "Acompanhe a lista de espera para distribuir clientes de forma equilibrada entre os barbeiros livres.",
  },

  reception: {
    role: "reception",
    title: "Painel da Recepção",
    badge: "🛎️ RECEPÇÃO",
    iconName: "Bell",
    summary: "Coordene a chegada de clientes, confirmações, fila de espera e comandas digitais com agilidade.",
    quickActions: [
      {
        label: "Agenda da Recepção",
        route: "/reception/agenda",
        iconName: "CalendarDays",
        requiredPermission: "appointments:view",
        description: "Dia, semana, mês e busca rápida por cliente",
      },
      {
        label: "Fila de Espera (Walk-in)",
        route: "/reception/waiting-list",
        iconName: "ListChecks",
        requiredPermission: "appointments:create",
        description: "Encaixe clientes sem hora marcada",
      },
      {
        label: "Clientes da Barbearia",
        route: "/reception/customers",
        iconName: "Users",
        requiredPermission: "clients:view",
        description: "Cadastro rápido e histórico",
      },
    ],
    recommendedTutorialIds: [
      "reception-agenda-operation",
      "reception-checkin-arrival",
      "reception-walkin-queue",
      "reception-comanda-digital",
    ],
    operationalTip: "Realize o Check-in assim que o cliente pisar na barbearia para alertar imediatamente o barbeiro responsável.",
  },

  receptionist: {
    role: "receptionist",
    title: "Painel da Recepção",
    badge: "🛎️ RECEPCIONISTA",
    iconName: "Bell",
    summary: "Coordene a chegada de clientes, confirmações, fila de espera e comandas digitais com agilidade.",
    quickActions: [
      {
        label: "Agenda da Recepção",
        route: "/reception/agenda",
        iconName: "CalendarDays",
        requiredPermission: "appointments:view",
        description: "Dia, semana, mês e busca rápida por cliente",
      },
      {
        label: "Fila de Espera (Walk-in)",
        route: "/reception/waiting-list",
        iconName: "ListChecks",
        requiredPermission: "appointments:create",
        description: "Encaixe clientes sem hora marcada",
      },
      {
        label: "Clientes da Barbearia",
        route: "/reception/customers",
        iconName: "Users",
        requiredPermission: "clients:view",
        description: "Cadastro rápido e histórico",
      },
    ],
    recommendedTutorialIds: [
      "reception-agenda-operation",
      "reception-checkin-arrival",
      "reception-walkin-queue",
      "reception-comanda-digital",
    ],
    operationalTip: "Realize o Check-in assim que o cliente pisar na barbearia para alertar imediatamente o barbeiro responsável.",
  },

  barber: {
    role: "barber",
    title: "Área do Profissional",
    badge: "✂️ BARBEIRO / PROFISSIONAL",
    iconName: "Scissors",
    summary: "Sua agenda do dia, atendimentos na cadeira e controle pessoal de comissões em tempo real.",
    quickActions: [
      {
        label: "Minha Agenda do Dia",
        route: "/profissional",
        iconName: "Calendar",
        requiredPermission: "appointments:view",
        description: "Veja os clientes agendados para hoje",
      },
      {
        label: "Meus Ganhos & Comissões",
        route: "/profissional",
        iconName: "CircleDollarSign",
        requiredPermission: "appointments:view",
        description: "Extrato transparente de comissões líquidas",
      },
    ],
    recommendedTutorialIds: [
      "barber-daily-agenda",
      "barber-complete-appointment",
      "barber-commissions-statement",
    ],
    operationalTip: "Lembre-se de clicar em 'Concluir Atendimento' ao finalizar o serviço para computar sua comissão no mesmo instante.",
  },

  professional: {
    role: "professional",
    title: "Área do Profissional",
    badge: "✂️ PROFISSIONAL",
    iconName: "Scissors",
    summary: "Sua agenda do dia, atendimentos na cadeira e controle pessoal de comissões em tempo real.",
    quickActions: [
      {
        label: "Minha Agenda do Dia",
        route: "/profissional",
        iconName: "Calendar",
        requiredPermission: "appointments:view",
        description: "Veja os clientes agendados para hoje",
      },
      {
        label: "Meus Ganhos & Comissões",
        route: "/profissional",
        iconName: "CircleDollarSign",
        requiredPermission: "appointments:view",
        description: "Extrato transparente de comissões líquidas",
      },
    ],
    recommendedTutorialIds: [
      "barber-daily-agenda",
      "barber-complete-appointment",
      "barber-commissions-statement",
    ],
    operationalTip: "Lembre-se de clicar em 'Concluir Atendimento' ao finalizar o serviço para computar sua comissão no mesmo instante.",
  },

  financial: {
    role: "financial",
    title: "Controle Financeiro",
    badge: "💰 FINANCEIRO",
    iconName: "Wallet",
    summary: "Gestão do fluxo de caixa, conciliação de métodos de pagamento e quitação de comissões da equipe.",
    quickActions: [
      {
        label: "Visão Geral de Caixa",
        route: "/finances",
        iconName: "TrendingUp",
        requiredPermission: "finances:view",
        description: "Receitas, despesas e saldo do período",
      },
      {
        label: "Liquidação de Comissões",
        route: "/finances",
        iconName: "CircleDollarSign",
        requiredPermission: "finances:manage",
        description: "Repasses seguros com validação contábil",
      },
    ],
    recommendedTutorialIds: [
      "finance-cash-flow",
      "finance-commission-payout",
      "owner-finances-reconciliation",
    ],
    operationalTip: "Confira se todos os atendimentos do dia foram marcados como concluídos antes de rodar o fechamento de comissões.",
  },

  finance: {
    role: "finance",
    title: "Controle Financeiro",
    badge: "💰 FINANCEIRO",
    iconName: "Wallet",
    summary: "Gestão do fluxo de caixa, conciliação de métodos de pagamento e quitação de comissões da equipe.",
    quickActions: [
      {
        label: "Visão Geral de Caixa",
        route: "/finances",
        iconName: "TrendingUp",
        requiredPermission: "finances:view",
        description: "Receitas, despesas e saldo do período",
      },
      {
        label: "Liquidação de Comissões",
        route: "/finances",
        iconName: "CircleDollarSign",
        requiredPermission: "finances:manage",
        description: "Repasses seguros com validação contábil",
      },
    ],
    recommendedTutorialIds: [
      "finance-cash-flow",
      "finance-commission-payout",
      "owner-finances-reconciliation",
    ],
    operationalTip: "Confira se todos os atendimentos do dia foram marcados como concluídos antes de rodar o fechamento de comissões.",
  },

  cashier: {
    role: "cashier",
    title: "Caixa Operacional",
    badge: "💵 CAIXA",
    iconName: "DollarSign",
    summary: "Registro e conferência de entradas e fechamento de comandas da barbearia.",
    quickActions: [
      {
        label: "Conferir Caixa",
        route: "/finances",
        iconName: "TrendingUp",
        requiredPermission: "finances:view",
        description: "Fluxo de pagamentos do dia",
      },
    ],
    recommendedTutorialIds: [
      "finance-cash-flow",
      "reception-comanda-digital",
    ],
    operationalTip: "Separe os comprovantes de cartão para bater os valores com o relatório do sistema no final do expediente.",
  },

  client: {
    role: "client",
    title: "Portal do Cliente",
    badge: "👤 CLIENTE",
    iconName: "User",
    summary: "Consulte seus agendamentos, histórico de cortes, benefícios do clube e pontos de fidelidade.",
    quickActions: [
      {
        label: "Meus Agendamentos",
        route: "/portal",
        iconName: "Calendar",
        description: "Consulte horários e faça remarcações",
      },
      {
        label: "Pontos & Fidelidade",
        route: "/portal",
        iconName: "Gift",
        description: "Acompanhe seus créditos acumulados",
      },
    ],
    recommendedTutorialIds: [
      "client-online-booking",
      "client-portal-management",
      "client-loyalty-cashback",
    ],
    operationalTip: "Você pode reagendar seu horário diretamente pelo portal com até 2 horas de antecedência.",
  },

  customer: {
    role: "customer",
    title: "Portal do Cliente",
    badge: "👤 CLIENTE",
    iconName: "User",
    summary: "Consulte seus agendamentos, histórico de cortes, benefícios do clube e pontos de fidelidade.",
    quickActions: [
      {
        label: "Meus Agendamentos",
        route: "/portal",
        iconName: "Calendar",
        description: "Consulte horários e faça remarcações",
      },
      {
        label: "Pontos & Fidelidade",
        route: "/portal",
        iconName: "Gift",
        description: "Acompanhe seus créditos acumulados",
      },
    ],
    recommendedTutorialIds: [
      "client-online-booking",
      "client-portal-management",
      "client-loyalty-cashback",
    ],
    operationalTip: "Você pode reagendar seu horário diretamente pelo portal com até 2 horas de antecedência.",
  },

  super_admin: {
    role: "super_admin",
    title: "Super Administração Barbex",
    badge: "🛡️ SUPER ADMIN",
    iconName: "ShieldCheck",
    summary: "Governança da plataforma SaaS, monitoramento de saúde de tenants, planos e infraestrutura global.",
    quickActions: [
      {
        label: "Gestão de Barbearias",
        route: "/admin/tenants",
        iconName: "Building2",
        requiredPermission: "*",
        description: "Status de operação e planos de todos os clientes",
      },
      {
        label: "Planos Comerciais",
        route: "/admin/plans",
        iconName: "CreditCard",
        requiredPermission: "*",
        description: "Catálogo de planos, preços Stripe e limites",
      },
      {
        label: "Knowledge Base Admin",
        route: "/admin/knowledge-base",
        iconName: "GraduationCap",
        requiredPermission: "*",
        description: "Publicação e versionamento de tutoriais",
      },
    ],
    recommendedTutorialIds: [
      "superadmin-tenants-governance",
      "superadmin-knowledge-base",
    ],
    operationalTip: "Verifique o painel de auditoria antes de realizar qualquer concessão manual de recursos em tenants.",
  },
};

/**
 * Retorna a configuração de boas-vindas adequada para o perfil fornecido
 */
export function getRoleWelcomeConfig(role: UserRole | string | null | undefined): RoleWelcomeConfig {
  const normalized = String(role || "unknown").toLowerCase();
  const config = ROLE_WELCOME_CONFIGS[normalized];
  if (config) return config;

  // Fallback seguro (Client / Visitante)
  return {
    role: "unknown",
    title: "Bem-vindo ao Barbex",
    badge: "✨ BARBEX",
    iconName: "Sparkles",
    summary: "Plataforma de gestão inteligente para barbearias de alto padrão.",
    quickActions: [],
    recommendedTutorialIds: ["client-online-booking"],
    operationalTip: "Acesse os tutoriais na Central de Ajuda para conhecer todas as funcionalidades da plataforma.",
  };
}

/**
 * Filtra os tutoriais autorizados para o perfil, permissões e módulos ativos
 */
export function getTutorialsForRole({
  role,
  hasPermission,
  isModuleEnabled,
}: {
  role: UserRole | string | null | undefined;
  hasPermission?: (key: PermissionKey) => boolean;
  isModuleEnabled?: (key: string) => boolean;
}): TutorialItem[] {
  const normalizedRole = (role || "unknown") as UserRole;
  if (!role || normalizedRole === "unknown") return [];

  // Super Admin visualiza todos os tutoriais
  if (normalizedRole === "super_admin") {
    return TUTORIALS_CATALOG;
  }

  return TUTORIALS_CATALOG.filter((item) => {
    // 1. Verificação de Perfil
    const matchesRole = item.targetRoles.includes(normalizedRole);
    if (!matchesRole) return false;

    // 2. Proteção de Conteúdo Interno Super Admin:
    // Não-superadmins NUNCA podem visualizar tutoriais com target exclusivo super_admin
    if (item.targetRoles.length === 1 && item.targetRoles[0] === "super_admin") {
      return false;
    }

    // 3. Verificação de Permissão Efetiva
    if (item.requiredPermission && item.requiredPermission !== "*") {
      if (hasPermission && !hasPermission(item.requiredPermission)) {
        return false;
      }
    }

    // 4. Verificação de Módulo Habilitado (se aplicável)
    if (item.moduleKey && isModuleEnabled) {
      if (!isModuleEnabled(item.moduleKey)) {
        // Se o módulo está desligado no tenant e o tutorial depende dele, não exibe
        return false;
      }
    }

    return true;
  });
}


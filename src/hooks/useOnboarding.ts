import { useEffect, useRef } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'

type OnboardingRole = 'buyer' | 'supplier' | 'admin'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'floating'

interface OnboardingStep {
  element: string
  intro: string
  position: TooltipPosition
}

const STORAGE_KEY_PREFIX = 'verdemar_onboarding_done_'

function getSteps(role: OnboardingRole): OnboardingStep[] {
  if (role === 'buyer') {
    return [
      {
        element: '#onboarding-welcome',
        intro: 'Bem-vindo ao VerdeMar! Aqui você encontra os melhores fornecedores de hortifrúti para o seu negócio.',
        position: 'bottom',
      },
      {
        element: '#onboarding-categories',
        intro: 'Navegue pelas categorias para encontrar frutas, legumes, verduras e muito mais.',
        position: 'bottom',
      },
      {
        element: '#onboarding-products',
        intro: 'Veja os produtos mais vendidos e adicione ao carrinho com um toque.',
        position: 'top',
      },
      {
        element: '#onboarding-suppliers',
        intro: 'Conheça os fornecedores em destaque e veja seus produtos e condições de entrega.',
        position: 'top',
      },
      {
        element: '#nav-search',
        intro: 'Use a busca para encontrar produtos ou fornecedores específicos.',
        position: 'top',
      },
      {
        element: '#nav-cart',
        intro: 'Seu carrinho fica aqui. Adicione produtos e finalize o pedido via WhatsApp.',
        position: 'top',
      },
      {
        element: '#nav-profile',
        intro: 'Acesse seu perfil, histórico de pedidos e configurações da conta.',
        position: 'top',
      },
    ]
  }

  if (role === 'supplier') {
    return [
      {
        element: '#onboarding-supplier-welcome',
        intro: 'Bem-vindo ao painel do fornecedor! Gerencie sua loja, produtos e pedidos por aqui.',
        position: 'bottom',
      },
      {
        element: '#onboarding-add-product',
        intro: 'Adicione novos produtos ao seu catálogo rapidamente.',
        position: 'bottom',
      },
      {
        element: '#onboarding-stats',
        intro: 'Acompanhe seus pedidos de hoje, pendentes e o faturamento do mês.',
        position: 'bottom',
      },
      {
        element: '#onboarding-recent-orders',
        intro: 'Veja os pedidos mais recentes e gerencie o status de cada um.',
        position: 'top',
      },
      {
        element: '#nav-supplier-products',
        intro: 'Gerencie todos os seus produtos: edite preços, ative ou desative itens.',
        position: 'top',
      },
      {
        element: '#nav-supplier-orders',
        intro: 'Acompanhe e atualize o status dos pedidos recebidos.',
        position: 'top',
      },
      {
        element: '#nav-supplier-settings',
        intro: 'Configure sua loja: horários de entrega, valor mínimo e dados de contato.',
        position: 'top',
      },
    ]
  }

  // admin
  return [
    {
      element: '#onboarding-admin-stats',
      intro: 'Veja um resumo geral: fornecedores, compradores, produtos e pedidos da plataforma.',
      position: 'bottom',
    },
    {
      element: '#nav-admin-suppliers',
      intro: 'Gerencie fornecedores: ative, desative ou remova da plataforma.',
      position: 'top',
    },
    {
      element: '#nav-admin-products',
      intro: 'Visualize e gerencie todos os produtos cadastrados.',
      position: 'top',
    },
    {
      element: '#nav-admin-orders',
      intro: 'Acompanhe todos os pedidos realizados na plataforma.',
      position: 'top',
    },
    {
      element: '#nav-admin-logout',
      intro: 'Saia da conta com segurança quando terminar.',
      position: 'top',
    },
  ]
}

export function useOnboarding(role: OnboardingRole) {
  const introRef = useRef<ReturnType<typeof introJs> | null>(null)

  useEffect(() => {
    const key = STORAGE_KEY_PREFIX + role
    if (localStorage.getItem(key)) return

    // Small delay to ensure DOM elements are rendered
    const timer = setTimeout(() => {
      try {
        const steps = getSteps(role)

        // Filter out steps whose elements don't exist yet
        const validSteps = steps.filter((step) =>
          typeof step.element === 'string' ? document.querySelector(step.element) : true
        )

        if (validSteps.length === 0) return

        const intro = introJs()
        introRef.current = intro

        intro.setOptions({
          steps: validSteps,
          nextLabel: 'Próximo',
          prevLabel: 'Anterior',
          doneLabel: 'Entendi!',
          skipLabel: 'Pular',
          showProgress: true,
          showBullets: false,
          exitOnOverlayClick: false,
          disableInteraction: true,
        })

        intro.oncomplete(() => {
          localStorage.setItem(key, '1')
        })

        intro.onexit(() => {
          localStorage.setItem(key, '1')
        })

        intro.start()
      } catch (err) {
        // intro.js sometimes throws on DOM mutations or re-mounts — never
        // let the onboarding tour crash the whole page.
        console.warn('Onboarding tour skipped:', err)
        localStorage.setItem(key, '1')
      }
    }, 800)

    return () => {
      clearTimeout(timer)
      const intro = introRef.current
      if (intro) {
        // Set the key before exit so it's always marked done on unmount,
        // regardless of whether exit(true) fires the onexit callback.
        localStorage.setItem(key, '1')
        try {
          intro.exit(true)
        } catch {
          // Ignore — intro may already be detached (StrictMode double-mount).
        }
        introRef.current = null
      }
    }
  }, [role])
}

export function resetOnboarding(role?: OnboardingRole) {
  if (role) {
    localStorage.removeItem(STORAGE_KEY_PREFIX + role)
  } else {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'buyer')
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'supplier')
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'admin')
  }
}

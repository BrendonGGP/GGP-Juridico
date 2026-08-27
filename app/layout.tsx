import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

/**
 * O manual da marca usa uma sans geométrica de traço uniforme (o próprio
 * logotipo é geométrico). Poppins é a correspondência mais próxima disponível
 * no Google Fonts e sustenta bem número em tabela.
 */
const ggpSans = Poppins({
  variable: '--font-ggp-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GGP-Jurídico',
  description: 'Sistema de Gestão e Indicadores do Jurídico — Grupo Gomes Pires',
  // O símbolo isolado, não a marca completa: em 16px o lettering vira borrão.
  icons: { icon: '/marca/ggp-simbolo.png' },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${ggpSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  )
}

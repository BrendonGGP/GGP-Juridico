import { usuarioParaNavegacao } from '@/components/shell/usuario-para-nav'
import { FormularioImportacao } from './Formulario'

/**
 * Importação mensal.
 *
 * Esta página existe só para buscar o usuário e repassá-lo: o formulário é
 * Client Component (precisa de estado para o upload e o preview), e Client
 * Component não pode ler a sessão do servidor.
 */
export default async function ImportacaoPage() {
  const usuario = await usuarioParaNavegacao()
  return <FormularioImportacao usuario={usuario} />
}
